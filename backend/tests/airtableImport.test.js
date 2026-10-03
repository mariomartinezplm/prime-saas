/**
 * PRUEBAS — importación de pacientes nuevos desde Airtable.
 *
 * Reglas que protegen estas pruebas:
 *  - La app manda: un paciente que ya existe NUNCA se modifica.
 *  - Solo se crean los que faltan; los históricos se filtran con createdSince.
 *  - Sin correo no se puede crear la cuenta: se informa, no se pierde en silencio.
 *  - El profesional se asigna solo si el nombre coincide con UNO; si no, queda
 *    sin asignar (visible para todo el personal).
 *  - Un género raro de Airtable no hace fallar el alta.
 *
 * Mismo patrón que el resto de backend/tests/ (vitest + vi.spyOn, sin BD real).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import mongoose from 'mongoose';

import User from '../models/User.js';
import { importRecords, matchStaffByName, mapAirtableToPatient } from '../utils/airtableSync.js';

const nuevoId = () => new mongoose.Types.ObjectId();

const registro = (id, fields, createdTime = '2026-10-05T12:00:00.000Z') => ({
  id,
  fields,
  _rawJson: { createdTime }
});

const ana = (extra = {}) => registro('recAna', {
  Nombre: 'Ana',
  Apellido: 'Pérez',
  'Correo Electrónico': 'Ana@Test.local',
  'Entrenador/Kinesiólogo': 'Mario Martínez',
  ...extra
});

const staff = [
  { _id: nuevoId(), firstName: 'Mario', lastName: 'Martínez' },
  { _id: nuevoId(), firstName: 'Camila', lastName: 'Soto' }
];

// existing: usuarios que "ya están en la app" cuando se consulta por airtableId/correo
function prepararBD({ existing = [] } = {}) {
  vi.restoreAllMocks();
  vi.spyOn(User, 'find').mockImplementation((query) => ({
    select: vi.fn().mockResolvedValue(query.role ? staff : existing)
  }));
  return vi.spyOn(User, 'create').mockResolvedValue({});
}

describe('importRecords — solo pacientes nuevos', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('crea el paciente nuevo sin contraseña conocida y asignado al profesional', async () => {
    const create = prepararBD();

    const result = await importRecords([ana()]);

    expect(result).toMatchObject({ created: 1, alreadyInApp: 0, failed: 0, skippedNoEmail: [] });
    const creado = create.mock.calls[0][0];
    expect(creado.email).toBe('ana@test.local');
    expect(creado.role).toBe('patient');
    expect(creado.airtableId).toBe('recAna');
    expect(creado.assignedProfessionalId).toBe(staff[0]._id);
    expect(creado.password).toMatch(/^[0-9a-f]{64}$/);
  });

  it('LA APP MANDA: un paciente que ya existe (por correo) no se crea ni se modifica', async () => {
    const create = prepararBD({ existing: [{ airtableId: undefined, email: 'ana@test.local' }] });
    const save = vi.spyOn(User.prototype, 'save');

    const result = await importRecords([ana()]);

    expect(result.created).toBe(0);
    expect(result.alreadyInApp).toBe(1);
    expect(create).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
  });

  it('un paciente ya importado antes (mismo registro de Airtable, correo cambiado en la app) tampoco se duplica', async () => {
    const create = prepararBD({ existing: [{ airtableId: 'recAna', email: 'otro-correo@test.local' }] });

    const result = await importRecords([ana()]);

    expect(result.alreadyInApp).toBe(1);
    expect(create).not.toHaveBeenCalled();
  });

  it('createdSince deja fuera los registros históricos y trae los nuevos', async () => {
    const create = prepararBD();
    const viejo = registro('recViejo', { Nombre: 'Luis', Apellido: 'Rojas', Correo: 'luis@test.local' }, '2025-03-01T10:00:00.000Z');

    const result = await importRecords([viejo, ana()], { createdSince: new Date('2026-10-03T00:00:00-03:00') });

    expect(result.created).toBe(1);
    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0][0].airtableId).toBe('recAna');
  });

  it('sin createdSince (botón manual del admin) trae también los históricos que faltan', async () => {
    const create = prepararBD();
    const viejo = registro('recViejo', { Nombre: 'Luis', Apellido: 'Rojas', Correo: 'luis@test.local' }, '2025-03-01T10:00:00.000Z');

    const result = await importRecords([viejo, ana()]);

    expect(result.created).toBe(2);
    expect(create).toHaveBeenCalledTimes(2);
  });

  it('sin correo: no se crea, pero se informa el nombre para que se corrija en Airtable', async () => {
    const create = prepararBD();
    const sinCorreo = registro('recSin', { Nombre: 'Pedro', Apellido: 'Díaz' });

    const result = await importRecords([sinCorreo]);

    expect(result.created).toBe(0);
    expect(result.skippedNoEmail).toEqual(['Pedro Díaz']);
    expect(create).not.toHaveBeenCalled();
  });

  it('dos filas de Airtable con el mismo correo: se crea una y la otra cuenta como ya existente', async () => {
    const create = prepararBD();
    create
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(Object.assign(new Error('E11000 duplicate key'), { code: 11000 }));

    const result = await importRecords([ana(), registro('recAna2', { Nombre: 'Ana', Apellido: 'P', Correo: 'ana@test.local' })]);

    expect(result).toMatchObject({ created: 1, alreadyInApp: 1, failed: 0 });
  });

  it('un error al crear un paciente no frena a los demás', async () => {
    const create = prepararBD();
    create.mockRejectedValueOnce(new Error('falló')).mockResolvedValueOnce({});
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await importRecords([ana(), registro('recLuis', { Nombre: 'Luis', Apellido: 'R', Correo: 'luis@test.local' })]);

    expect(result).toMatchObject({ created: 1, failed: 1 });
  });

  it('un género raro de Airtable no hace fallar el alta (se normaliza)', async () => {
    const create = prepararBD();

    await importRecords([
      ana({ Género: 'Hombre' }),
      registro('recB', { Nombre: 'B', Apellido: 'B', Correo: 'b@test.local', Género: 'Mujer' }),
      registro('recC', { Nombre: 'C', Apellido: 'C', Correo: 'c@test.local', Género: 'No binario' })
    ]);

    expect(create.mock.calls.map((c) => c[0].gender)).toEqual(['Masculino', 'Femenino', 'Otro']);
  });

  it('no loguea datos personales al fallar', async () => {
    const create = prepararBD();
    create.mockRejectedValueOnce(new Error('validación'));
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});

    await importRecords([ana()]);

    const salida = log.mock.calls.flat().join(' ');
    expect(salida).not.toMatch(/ana@test\.local|Pérez/i);
  });
});

describe('matchStaffByName — asignación segura de profesional', () => {
  it('nombre completo, con o sin tildes y mayúsculas, asigna al profesional', () => {
    expect(matchStaffByName('mario martinez', staff)).toBe(staff[0]);
    expect(matchStaffByName('Camila Soto', staff)).toBe(staff[1]);
  });

  it('texto vacío o sin coincidencia: sin asignar (queda visible para todo el personal)', () => {
    expect(matchStaffByName('', staff)).toBeUndefined();
    expect(matchStaffByName(undefined, staff)).toBeUndefined();
    expect(matchStaffByName('Otra Persona', staff)).toBeUndefined();
  });

  it('un nombre ambiguo (dos profesionales posibles) NO se asigna a ciegas', () => {
    const dosMarios = [...staff, { _id: nuevoId(), firstName: 'Mario', lastName: 'Gómez' }];
    expect(matchStaffByName('Mario', dosMarios)).toBeUndefined();
  });
});

describe('mapAirtableToPatient', () => {
  it('nace como paciente activo, con origen airtable y sin tocar el campo de texto del profesional', () => {
    const mapped = mapAirtableToPatient(ana());
    expect(mapped).toMatchObject({ role: 'patient', isActive: true, source: 'airtable', assignedProfessional: 'Mario Martínez' });
  });
});
