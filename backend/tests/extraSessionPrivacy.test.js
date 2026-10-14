/**
 * PRUEBAS — privacidad de las sesiones extra: lo que recibe un PACIENTE por la API.
 *
 * Hallazgo: GET /api/extra-sessions/patient/(me|:id) devolvía al paciente el documento completo: el motivo que escribe el
 * personal (`reason`), quién la otorgó (`grantedBy`, con su nombre) y el id interno de la cita en que se usó.
 *
 * Regla: el paciente recibe solo los datos propios de la sesión (lista cerrada); admin y profesional con acceso siguen
 * recibiendo el documento completo. Cada paciente solo consulta lo suyo.
 *
 * Mismo patrón que clientPlanPrivacy.test.js (vitest + vi.spyOn, sin BD real, con un documento de Mongoose real).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import mongoose from 'mongoose';

import ExtraSession from '../models/ExtraSession.js';
import { getPatientExtraSessions } from '../controllers/extraSessionController.js';
import extraSessionRouter from '../routes/extraSessionRoutes.js';

const nuevoId = () => new mongoose.Types.ObjectId();
const PACIENTE = nuevoId();
const OTRO_PACIENTE = nuevoId();
const PERSONAL = nuevoId();
const MOTIVO_INTERNO = 'MOTIVO INTERNO: compensación por una sesión cancelada por el centro';

const sesionCompleta = () =>
  new ExtraSession({
    patient: PACIENTE,
    serviceType: 'entrenamiento',
    grantedBy: PERSONAL,
    reason: MOTIVO_INTERNO,
    date: new Date('2026-10-05T12:00:00Z'),
    used: true,
    usedAt: new Date('2026-10-08T12:00:00Z'),
    usedInAppointment: nuevoId(),
    createdAt: new Date('2026-10-05T12:00:00Z'),
    updatedAt: new Date('2026-10-08T12:00:00Z')
  });

const fakeRes = () => ({
  status: vi.fn(function (code) { this.statusCode = code; return this; }),
  json: vi.fn(function (body) { this.body = body; return this; })
});
const cuerpo = (res) => JSON.parse(JSON.stringify(res.body));
const paciente = (id = PACIENTE) => ({ _id: id, role: 'patient' });

const CAMPOS_DEL_PACIENTE = ['_id', 'createdAt', 'date', 'patient', 'serviceType', 'updatedAt', 'used', 'usedAt'];
const CAMPOS_INTERNOS = ['reason', 'grantedBy', 'usedInAppointment'];

function mockLista(sesiones) {
  const cadena = { populate: () => cadena, sort: () => Promise.resolve(sesiones) };
  return vi.spyOn(ExtraSession, 'find').mockReturnValue(cadena);
}

beforeEach(() => vi.restoreAllMocks());

describe('sesiones extra: GET /api/extra-sessions/patient/(me|:id)', () => {
  it('un PACIENTE no recibe el motivo del personal, quién la otorgó ni la cita interna', async () => {
    mockLista([sesionCompleta()]);
    const res = fakeRes();
    await getPatientExtraSessions({ user: paciente(), params: {} }, res);

    const texto = JSON.stringify(cuerpo(res));
    expect(res.statusCode).toBe(200);
    expect(texto).not.toContain(MOTIVO_INTERNO);
    for (const campo of CAMPOS_INTERNOS) expect(texto, `no debe salir "${campo}"`).not.toContain(`"${campo}"`);
    expect(texto).not.toContain(String(PERSONAL));
  });

  it('el paciente sí recibe los datos propios de la sesión (lista cerrada)', async () => {
    mockLista([sesionCompleta()]);
    const res = fakeRes();
    await getPatientExtraSessions({ user: paciente(), params: {} }, res);
    const { extraSessions } = cuerpo(res).data;
    expect(Object.keys(extraSessions[0]).sort()).toEqual([...CAMPOS_DEL_PACIENTE].sort());
    expect(extraSessions[0]).toMatchObject({ serviceType: 'entrenamiento', used: true });
    expect(cuerpo(res).count).toBe(1);
  });

  it('una lista vacía sigue funcionando', async () => {
    mockLista([]);
    const res = fakeRes();
    await getPatientExtraSessions({ user: paciente(), params: {} }, res);
    expect(cuerpo(res)).toMatchObject({ success: true, count: 0, data: { extraSessions: [] } });
  });

  it('admin y profesional SÍ reciben el documento completo, con el motivo y quién la otorgó', async () => {
    for (const user of [{ _id: nuevoId(), role: 'admin' }, { _id: PERSONAL, role: 'professional' }]) {
      mockLista([sesionCompleta()]);
      const res = fakeRes();
      await getPatientExtraSessions({ user, params: { patientId: String(PACIENTE) } }, res);
      const [sesion] = cuerpo(res).data.extraSessions;
      expect(sesion.reason).toBe(MOTIVO_INTERNO);
      expect(sesion.grantedBy).toBeDefined();
      vi.restoreAllMocks();
    }
  });

  it('un paciente no puede pedir las sesiones extra de OTRO paciente (403 y no se consulta nada)', async () => {
    const find = vi.spyOn(ExtraSession, 'find');
    const res = fakeRes();
    await getPatientExtraSessions({ user: paciente(OTRO_PACIENTE), params: { patientId: String(PACIENTE) } }, res);
    expect(res.statusCode).toBe(403);
    expect(find).not.toHaveBeenCalled();
  });

  it('la ruta «me» usa SOLO el id de la sesión (nunca uno que mande el cliente)', async () => {
    const find = mockLista([]);
    const res = fakeRes();
    await getPatientExtraSessions({ user: paciente(), params: {}, query: { patientId: String(OTRO_PACIENTE) }, body: { patientId: String(OTRO_PACIENTE) } }, res);
    expect(find).toHaveBeenCalledWith({ patient: String(PACIENTE) });
  });
});

describe('pertenencia a nivel de ruta', () => {
  it('toda la API pide sesión; otorgar es solo del personal; la lectura con :patientId pasa por authorizePatientAccess', () => {
    expect(extraSessionRouter.stack[0].name).toBe('protect');
    const lectura = extraSessionRouter.stack.filter((l) => l.route && l.route.path === '/patient/:patientId');
    expect(lectura).toHaveLength(1);
    expect(lectura[0].route.stack).toHaveLength(2); // authorizePatientAccess + controlador
    expect(lectura[0].route.stack[1].name).toBe('getPatientExtraSessions');
    const crear = extraSessionRouter.stack.find((l) => l.route && l.route.path === '/' && l.route.methods.post);
    expect(crear.route.stack).toHaveLength(2); // authorize('admin','professional') + controlador
  });
});
