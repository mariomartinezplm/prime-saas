/**
 * PRUEBAS — integración con Google Calendar (Paso 28.A de BLUEPRINT.md).
 *
 * Mismo patrón que el resto de backend/tests/ (vitest + vi.spyOn, sin BD real).
 * Sin credenciales reales de Google: se mockea el módulo `googleapis` entero.
 * Foco de estas pruebas (lo que pedía el checkpoint del blueprint):
 *   - los tokens jamás aparecen en una consulta normal de usuario (select:false)
 *   - el `state` del flujo OAuth se valida (firma, expiración, y que sea del
 *     mismo usuario que lo generó) — así se previene CSRF
 *   - un profesional no puede sincronizar la cita de otro
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-para-vitest';
process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');
process.env.FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:8080';

const mockGetToken = vi.fn();
const mockGenerateAuthUrl = vi.fn();
const mockSetCredentials = vi.fn();
const mockEventsInsert = vi.fn();
const mockEventsUpdate = vi.fn();

vi.mock('googleapis', () => ({
  google: {
    auth: {
      // Implementación con `function`, no arrow — un mock invocado con `new`
      // necesita poder actuar como constructor (una arrow function no puede).
      OAuth2: vi.fn().mockImplementation(function () {
        return {
          generateAuthUrl: mockGenerateAuthUrl,
          getToken: mockGetToken,
          setCredentials: mockSetCredentials
        };
      })
    },
    calendar: vi.fn().mockImplementation(function () {
      return { events: { insert: mockEventsInsert, update: mockEventsUpdate } };
    })
  }
}));

const User = (await import('../models/User.js')).default;
const Appointment = (await import('../models/Appointment.js')).default;
const {
  getAuthUrl,
  handleCallback,
  getStatus,
  syncAppointment
} = await import('../controllers/googleCalendarController.js');

const nuevoId = () => new mongoose.Types.ObjectId();

const fakeRes = () => ({
  status: vi.fn(function (code) { this.statusCode = code; return this; }),
  json: vi.fn(function (body) { this.body = body; return this; })
});

const validState = (uid, overrides = {}) =>
  jwt.sign({ uid: uid.toString(), purpose: 'gcal-oauth', ...overrides }, process.env.JWT_SECRET, {
    expiresIn: overrides.expiresIn || '10m'
  });

beforeEach(() => {
  vi.restoreAllMocks();
  mockGetToken.mockReset();
  mockGenerateAuthUrl.mockReset();
  mockSetCredentials.mockReset();
  mockEventsInsert.mockReset();
  mockEventsUpdate.mockReset();
});

describe('GET /google-calendar/auth-url', () => {
  it('genera una URL con scope mínimo (calendar.events, no calendar completo)', () => {
    mockGenerateAuthUrl.mockReturnValue('https://accounts.google.com/o/oauth2/auth?fake=1');
    const req = { user: { _id: nuevoId() } };
    const res = fakeRes();

    getAuthUrl(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.authUrl).toContain('accounts.google.com');
    const callArgs = mockGenerateAuthUrl.mock.calls[0][0];
    expect(callArgs.scope).toEqual(['https://www.googleapis.com/auth/calendar.events']);
    expect(typeof callArgs.state).toBe('string');
  });
});

describe('POST /google-calendar/callback — validación del state (CSRF)', () => {
  it('rechaza si falta code o state', async () => {
    const req = { user: { _id: nuevoId() }, body: {} };
    const res = fakeRes();

    await handleCallback(req, res);

    expect(res.statusCode).toBe(400);
    expect(mockGetToken).not.toHaveBeenCalled();
  });

  it('rechaza un state con firma inválida', async () => {
    const req = { user: { _id: nuevoId() }, body: { code: 'abc', state: 'esto-no-es-un-jwt-valido' } };
    const res = fakeRes();

    await handleCallback(req, res);

    expect(res.statusCode).toBe(400);
    expect(mockGetToken).not.toHaveBeenCalled();
  });

  it('rechaza un state expirado', async () => {
    const userId = nuevoId();
    const expiredState = jwt.sign({ uid: userId.toString(), purpose: 'gcal-oauth' }, process.env.JWT_SECRET, {
      expiresIn: -10
    });
    const req = { user: { _id: userId }, body: { code: 'abc', state: expiredState } };
    const res = fakeRes();

    await handleCallback(req, res);

    expect(res.statusCode).toBe(400);
    expect(mockGetToken).not.toHaveBeenCalled();
  });

  it('rechaza un state válido pero emitido para OTRO usuario (ataque CSRF)', async () => {
    const atacante = nuevoId();
    const victima = nuevoId();
    const stateDelAtacante = validState(atacante);

    // La víctima, autenticada como sí misma, termina el flujo con el state del atacante
    const req = { user: { _id: victima }, body: { code: 'codigo-del-atacante', state: stateDelAtacante } };
    const res = fakeRes();

    await handleCallback(req, res);

    expect(res.statusCode).toBe(400);
    expect(mockGetToken).not.toHaveBeenCalled();
  });

  it('con state válido y del mismo usuario: guarda los tokens cifrados', async () => {
    const userId = nuevoId();
    mockGetToken.mockResolvedValue({ tokens: { access_token: 'a', refresh_token: 'r' } });
    const updateSpy = vi.spyOn(User, 'findByIdAndUpdate').mockResolvedValue({});

    const req = { user: { _id: userId }, body: { code: 'codigo-real', state: validState(userId) } };
    const res = fakeRes();

    await handleCallback(req, res);

    expect(res.statusCode).toBe(200);
    expect(updateSpy).toHaveBeenCalledTimes(1);
    const [id, update] = updateSpy.mock.calls[0];
    expect(id).toBe(userId);
    // Nunca se guarda el token en texto plano
    expect(update.googleTokens).not.toContain('access_token');
    expect(update.googleTokens).not.toContain('refresh_token');
  });
});

describe('GET /google-calendar/status — los tokens nunca salen de la BD', () => {
  it('devuelve solo un booleano, nunca el token', async () => {
    const userId = nuevoId();
    vi.spyOn(User, 'findById').mockReturnValue({
      select: vi.fn().mockResolvedValue({ googleTokens: 'iv:tag:cipher' })
    });

    const req = { user: { _id: userId } };
    const res = fakeRes();

    await getStatus(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.data).toEqual({ connected: true });
    expect(JSON.stringify(res.body)).not.toMatch(/iv:tag:cipher/);
  });
});

describe('GET /users/:id — el campo googleTokens no aparece nunca', () => {
  it('select:false en el schema: una consulta normal no lo trae aunque no se excluya explícitamente', async () => {
    const created = await User.hydrate({
      _id: nuevoId(),
      firstName: 'Ana',
      lastName: 'Pérez',
      email: 'ana@test.cl',
      role: 'professional',
      googleTokens: 'iv:tag:cipher-secreto'
    });

    // toJSON() es lo que sale por la API — select:false ya lo excluye de por sí,
    // sin necesitar un transform adicional (a diferencia de password).
    const serialized = created.toJSON();
    expect(serialized.googleTokens).toBeUndefined();
  });
});

describe('POST /google-calendar/sync/:appointmentId — pertenencia', () => {
  it('un profesional no puede sincronizar la cita de OTRO profesional (404, no 403)', async () => {
    const propio = nuevoId();
    const otro = nuevoId();

    vi.spyOn(Appointment, 'findById').mockResolvedValue({
      _id: nuevoId(),
      professional: otro
    });

    const req = { user: { _id: propio }, params: { appointmentId: nuevoId().toString() } };
    const res = fakeRes();

    await syncAppointment(req, res);

    expect(res.statusCode).toBe(404);
    expect(mockEventsInsert).not.toHaveBeenCalled();
  });

  it('si no ha conectado Google Calendar, responde NOT_CONNECTED sin llamar a la API', async () => {
    const profId = nuevoId();

    vi.spyOn(Appointment, 'findById').mockResolvedValue({ _id: nuevoId(), professional: profId });
    vi.spyOn(User, 'findById').mockReturnValue({ select: vi.fn().mockResolvedValue({ googleTokens: undefined }) });

    const req = { user: { _id: profId }, params: { appointmentId: nuevoId().toString() } };
    const res = fakeRes();

    await syncAppointment(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.code).toBe('NOT_CONNECTED');
    expect(mockEventsInsert).not.toHaveBeenCalled();
  });

  it('con cita propia y calendario conectado: crea el evento con los campos correctos', async () => {
    const profId = nuevoId();
    const { encrypt } = await import('../utils/encryption.js');
    const tokenCifrado = encrypt(JSON.stringify({ access_token: 'a' }));

    const appointment = {
      _id: nuevoId(),
      professional: profId,
      date: new Date('2026-10-01T00:00:00Z'),
      startTime: '10:00',
      endTime: '11:00',
      type: 'kinesiologia',
      notes: 'Trae informe',
      googleEventId: undefined,
      save: vi.fn().mockResolvedValue(undefined)
    };

    vi.spyOn(Appointment, 'findById').mockResolvedValue(appointment);
    vi.spyOn(User, 'findById').mockReturnValue({ select: vi.fn().mockResolvedValue({ googleTokens: tokenCifrado }) });
    mockEventsInsert.mockResolvedValue({ data: { id: 'evento-google-123' } });

    const req = { user: { _id: profId }, params: { appointmentId: appointment._id.toString() } };
    const res = fakeRes();

    await syncAppointment(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.eventId).toBe('evento-google-123');
    expect(appointment.googleEventId).toBe('evento-google-123');
    expect(appointment.save).toHaveBeenCalledTimes(1);

    const eventArg = mockEventsInsert.mock.calls[0][0].requestBody;
    expect(eventArg.start.dateTime).toBe('2026-10-01T10:00:00');
    expect(eventArg.end.dateTime).toBe('2026-10-01T11:00:00');
    expect(eventArg.start.timeZone).toBe('America/Santiago');
    expect(eventArg.summary).toContain('Kinesiología');
  });
});
