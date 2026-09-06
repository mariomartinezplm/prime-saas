/**
 * PRUEBAS DE SEGURIDAD — red de protección de la Fase A del BLUEPRINT.
 *
 * Estas pruebas existen para que los agujeros que cerramos NO se vuelvan a abrir
 * sin que nadie se entere. Si alguien (persona o IA) modifica el código y rompe
 * una de estas reglas, `npm test` falla y lo dice.
 *
 * No necesitan base de datos ni servidor encendido: se sustituyen las consultas
 * por dobles de prueba. Corren en segundos con `npm test`.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import mongoose from 'mongoose';

import User from '../models/User.js';
import { canAccessPatient } from '../middleware/auth.js';
import { escapeHtml, escapeRegex, sanitizeMongo } from '../middleware/sanitize.js';

const nuevoId = () => new mongoose.Types.ObjectId();

// ─────────────────────────────────────────────────────────────────────────────
describe('Paso 04 — Pertenencia: quién puede ver los datos de un paciente', () => {
  const PROF_A = nuevoId();
  const PROF_B = nuevoId();
  const PACIENTE_DE_A = nuevoId();
  const PACIENTE_DE_B = nuevoId();
  const PACIENTE_SIN_ASIGNAR = nuevoId();

  beforeEach(() => {
    const baseFalsa = {
      [PACIENTE_DE_A]: { assignedProfessionalId: PROF_A, role: 'patient' },
      [PACIENTE_DE_B]: { assignedProfessionalId: PROF_B, role: 'patient' },
      [PACIENTE_SIN_ASIGNAR]: { assignedProfessionalId: undefined, role: 'patient' },
      [PROF_B]: { assignedProfessionalId: undefined, role: 'professional' }
    };
    vi.spyOn(User, 'findById').mockImplementation((id) => ({
      select: async () => baseFalsa[id.toString()] || null
    }));
  });

  const admin = { _id: nuevoId(), role: 'admin' };
  const profA = { _id: PROF_A, role: 'professional' };
  const pacienteA = { _id: PACIENTE_DE_A, role: 'patient' };

  it('un paciente NO puede ver los datos de otro paciente', async () => {
    expect(await canAccessPatient(pacienteA, PACIENTE_DE_B)).toBe(false);
  });

  it('un paciente sí puede ver sus propios datos', async () => {
    expect(await canAccessPatient(pacienteA, PACIENTE_DE_A)).toBe(true);
  });

  it('un profesional NO puede ver pacientes de otro profesional', async () => {
    expect(await canAccessPatient(profA, PACIENTE_DE_B)).toBe(false);
  });

  it('un profesional sí puede ver a sus pacientes asignados', async () => {
    expect(await canAccessPatient(profA, PACIENTE_DE_A)).toBe(true);
  });

  it('los pacientes sin profesional asignado quedan en el pool común del staff', async () => {
    expect(await canAccessPatient(profA, PACIENTE_SIN_ASIGNAR)).toBe(true);
  });

  it('un paciente NO accede al pool (el pool es solo para el staff)', async () => {
    expect(await canAccessPatient(pacienteA, PACIENTE_SIN_ASIGNAR)).toBe(false);
  });

  it('un profesional NO puede leer la ficha de otro profesional', async () => {
    expect(await canAccessPatient(profA, PROF_B)).toBe(false);
  });

  it('el admin accede a todo', async () => {
    expect(await canAccessPatient(admin, PACIENTE_DE_B)).toBe(true);
  });

  it('un id inválido o vacío se rechaza sin reventar', async () => {
    expect(await canAccessPatient(pacienteA, 'no-es-un-id')).toBe(false);
    expect(await canAccessPatient(pacienteA, null)).toBe(false);
    expect(await canAccessPatient(null, PACIENTE_DE_A)).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Paso 04 — Ningún dato sensible sale en las respuestas de la API', () => {
  it('al convertir un usuario a JSON se omiten contraseña y tokens', () => {
    const u = new User({
      firstName: 'Ana', lastName: 'Test', email: 'ana@test.cl',
      password: 'contrasenasecreta', role: 'patient'
    });
    u.resetPasswordToken = 'TOKEN_DE_RESETEO';
    u.resetPasswordExpire = new Date();
    u.invite = { tokenHash: 'HASH_DE_INVITACION' };

    const json = JSON.stringify(u);

    expect(json).not.toContain('contrasenasecreta');
    expect(json).not.toContain('TOKEN_DE_RESETEO');
    expect(json).not.toContain('HASH_DE_INVITACION');
    // El campo `id` sí debe seguir saliendo: el frontend lo usa
    expect(JSON.parse(json).id).toBeTruthy();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Paso 05 — Política de contraseñas', () => {
  it('el modelo exige al menos 8 caracteres', () => {
    const corta = new User({
      firstName: 'A', lastName: 'B', email: 'a@b.cl', password: '1234567'
    });
    const error = corta.validateSync();
    expect(error?.errors?.password).toBeTruthy();
  });

  it('acepta una contraseña de 8 o más', () => {
    const ok = new User({
      firstName: 'A', lastName: 'B', email: 'a@b.cl', password: '12345678'
    });
    expect(ok.validateSync()?.errors?.password).toBeFalsy();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Paso 06 — Bloqueo de comandos de base de datos', () => {
  const ejecutar = (req) => {
    const res = {};
    let siguiente = false;
    sanitizeMongo(req, res, () => { siguiente = true; });
    return siguiente;
  };

  it('descarta operadores enviados en la URL', () => {
    const req = { query: { role: { $ne: 'patient' } }, params: {}, body: {} };
    ejecutar(req);
    // La clave entera desaparece: no queda un objeto vacío que rompa la consulta
    expect(req.query.role).toBeUndefined();
  });

  it('descarta operadores enviados en el cuerpo', () => {
    const req = { body: { email: { $gt: '' }, password: 'loquesea' }, query: {}, params: {} };
    ejecutar(req);
    expect(req.body.email).toBeUndefined();
    expect(req.body.password).toBe('loquesea');
  });

  it('descarta claves con punto (rutas internas de Mongo)', () => {
    const req = { body: { 'perfil.rol': 'admin', nombre: 'Ana' }, query: {}, params: {} };
    ejecutar(req);
    expect(req.body['perfil.rol']).toBeUndefined();
    expect(req.body.nombre).toBe('Ana');
  });

  it('NO toca los valores normales: un precio "$100" o un correo siguen intactos', () => {
    const req = { body: { precio: '$100', email: 'a.b@correo.cl' }, query: {}, params: {} };
    ejecutar(req);
    expect(req.body.precio).toBe('$100');
    expect(req.body.email).toBe('a.b@correo.cl');
  });

  it('limpia también dentro de objetos anidados', () => {
    const req = { body: { filtro: { estado: { $ne: 'x' }, nombre: 'Ana' } }, query: {}, params: {} };
    ejecutar(req);
    expect(req.body.filtro.estado).toBeUndefined();
    expect(req.body.filtro.nombre).toBe('Ana');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Paso 06 — Escape de texto', () => {
  it('neutraliza etiquetas HTML en los correos', () => {
    const salida = escapeHtml('<script>robar()</script>');
    expect(salida).not.toContain('<script>');
    expect(salida).toContain('&lt;script&gt;');
  });

  it('neutraliza caracteres especiales en las búsquedas', () => {
    expect(escapeRegex('(a+)+$')).toBe('\\(a\\+\\)\\+\\$');
    // Debe poder compilarse como expresión regular sin lanzar error
    expect(() => new RegExp(escapeRegex('([{\\'))).not.toThrow();
  });

  it('el texto normal no se altera', () => {
    expect(escapeRegex('Juan Perez')).toBe('Juan Perez');
    expect(escapeHtml('Juan Perez')).toBe('Juan Perez');
  });
});
