/**
 * PRUEBAS — Objetivos: cupos (1 principal + 2 secundarios), validación profesional, historial sin pisar metas,
 * registros manuales y permisos. Modelos simulados: no se usa ninguna base de datos.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import PatientGoal from '../models/PatientGoal.js';
import GoalCheckin from '../models/GoalCheckin.js';
import User from '../models/User.js';
import { GoalError, addCheckin, createGoal, performAction } from '../services/goals/goalService.js';
import { actOnGoal, createGoalCheckin, createPatientGoal, getPatientGoals } from '../controllers/goalController.js';
import * as auth from '../middleware/auth.js';
import { hasActivePlan } from '../services/clientPlanService.js';
import { notifyOnce } from '../services/notificationService.js';

vi.mock('../services/notificationService.js', () => ({ notifyOnce: vi.fn(async () => ({})), notify: vi.fn() }));
vi.mock('../services/clientPlanService.js', async (orig) => ({ ...(await orig()), hasActivePlan: vi.fn() }));

const oid = () => new mongoose.Types.ObjectId();
const patientId = oid();
const patient = { _id: patientId, role: 'patient' };
const pro = { _id: oid(), role: 'professional' };
const admin = { _id: oid(), role: 'admin' };

// Registros que ya existen del paciente (lo que leería la fuente de datos)
const fakeReader = (map = {}) => ({ series: async (ind) => map[ind.indicatorId] ?? [], suggestions: async () => ({}) });
const press = { indicatorId: 'exercise_max_load', params: { exerciseKey: 'press banca' }, target: { value: 75 } };
const painInput = (target) => ({ categoryId: 'pain', priority: 'primary', indicators: [{ indicatorId: 'pain_eva', params: { bodyArea: 'rodilla-derecha' }, ...(target ? { target: { value: target } } : {}) }] });

let taken;
let saved;
beforeEach(() => {
  vi.restoreAllMocks();
  notifyOnce.mockClear();
  taken = [];
  saved = [];
  vi.spyOn(PatientGoal, 'find').mockImplementation(() => ({ select: async () => taken, sort: async () => saved }));
  vi.spyOn(PatientGoal.prototype, 'save').mockImplementation(async function () { saved.push(this); return this; });
  vi.spyOn(User, 'findById').mockImplementation(() => ({ select: async () => ({ assignedProfessionalId: pro._id, firstName: 'Ana', lastName: 'Prueba' }) }));
});

describe('crear un objetivo', () => {
  it('fuerza del paciente: queda activo como principal, con su punto de partida real y su historial', async () => {
    const reader = fakeReader({ exercise_max_load: [{ day: '2026-09-01', value: 60, refId: 'r1' }, { day: '2026-10-01', value: 67.5, refId: 'r2' }] });
    const goal = await createGoal(patientId, patient, { categoryId: 'strength', priority: 'primary', indicators: [press] }, { reader });
    expect(goal).toMatchObject({ status: 'active', slot: 1, requiresValidation: false, createdByRole: 'patient' });
    expect(goal.indicators[0].baseline).toMatchObject({ value: 67.5, day: '2026-10-01' });
    expect(goal.indicators[0].targetSetByRole).toBe('patient');
    expect(goal.history.map((h) => h.action)).toEqual(['created']);
  });

  it('sin registros previos NO inventa un punto de partida', async () => {
    const goal = await createGoal(patientId, patient, { categoryId: 'strength', priority: 'primary', indicators: [press] }, { reader: fakeReader() });
    expect(goal.indicators[0].baseline?.value).toBeUndefined();
  });

  it('la meta debe quedar por delante del punto de partida', async () => {
    const reader = fakeReader({ exercise_max_load: [{ day: '2026-10-01', value: 80, refId: 'r1' }] });
    await expect(createGoal(patientId, patient, { categoryId: 'strength', priority: 'primary', indicators: [press] }, { reader })).rejects.toMatchObject({ status: 400, code: 'TARGET_NOT_AHEAD' });
  });

  it('un dolor propuesto por el paciente queda PENDIENTE de validación y se avisa a su profesional', async () => {
    const goal = await createGoal(patientId, patient, painInput(3), { reader: fakeReader() });
    expect(goal.status).toBe('pending_validation');
    expect(goal.requiresValidation).toBe(true);
    expect(goal.validatedBy).toBeUndefined();
    expect(goal.history.map((h) => h.action)).toEqual(['created', 'submitted_for_validation']);
    expect(notifyOnce).toHaveBeenCalledWith(pro._id, 'goal_pending_validation', expect.objectContaining({ dedupeKey: `goal-pending:${goal._id}` }));
  });

  it('un profesional lo crea ya validado (si define la meta); sin meta se le pide', async () => {
    const goal = await createGoal(patientId, pro, painInput(3), { reader: fakeReader() });
    expect(goal).toMatchObject({ status: 'active', createdByRole: 'professional' });
    expect(String(goal.validatedBy)).toBe(String(pro._id));
    await expect(createGoal(patientId, pro, painInput(null), { reader: fakeReader() })).rejects.toMatchObject({ status: 400, code: 'TARGET_REQUIRED' });
  });

  it('el administrador no valida metas clínicas: lo que crea queda pendiente de un profesional', async () => {
    const goal = await createGoal(patientId, admin, painInput(3), { reader: fakeReader() });
    expect(goal.status).toBe('pending_validation');
    expect(goal.validatedBy).toBeUndefined();
  });

  it('datos inválidos devuelven 400 con el motivo en español', async () => {
    await expect(createGoal(patientId, patient, { categoryId: 'strength', indicators: [] }, { reader: fakeReader() })).rejects.toBeInstanceOf(GoalError);
  });
});

describe('cupos: principal + 2 secundarios', () => {
  const row = (slot) => ({ _id: oid(), slot, status: 'active', categoryId: 'strength' });
  it('rechaza una segunda principal ofreciendo cambiar o pausar', async () => {
    taken = [row(1)];
    await expect(createGoal(patientId, patient, { categoryId: 'strength', priority: 'primary', indicators: [press] }, { reader: fakeReader() })).rejects.toMatchObject({ status: 409, code: 'PRIMARY_TAKEN' });
  });
  it('las secundarias toman el cupo 2 y luego el 3', async () => {
    taken = [row(1)];
    expect((await createGoal(patientId, patient, { categoryId: 'strength', priority: 'secondary', indicators: [press] }, { reader: fakeReader() })).slot).toBe(2);
    taken = [row(1), row(2)];
    expect((await createGoal(patientId, patient, { categoryId: 'strength', priority: 'secondary', indicators: [press] }, { reader: fakeReader() })).slot).toBe(3);
  });
  it('un cuarto objetivo activo se rechaza y se listan los activos para elegir cuál pausar', async () => {
    taken = [row(1), row(2), row(3)];
    const error = await createGoal(patientId, patient, { categoryId: 'strength', priority: 'secondary', indicators: [press] }, { reader: fakeReader() }).catch((e) => e);
    expect(error).toMatchObject({ status: 409, code: 'SLOTS_FULL' });
    expect(error.extra.activeGoals).toHaveLength(3);
  });
  it('dos pedidos simultáneos: la base de datos rechaza el segundo y se responde 409, no un error', async () => {
    PatientGoal.prototype.save.mockRejectedValueOnce(Object.assign(new Error('dup'), { code: 11000 }));
    await expect(createGoal(patientId, patient, { categoryId: 'strength', priority: 'primary', indicators: [press] }, { reader: fakeReader() })).rejects.toMatchObject({ status: 409, code: 'PRIMARY_TAKEN' });
  });
  it('pausar libera el cupo, conserva el objetivo y su historial', async () => {
    const goal = { patient: patientId, status: 'active', slot: 2, history: [], save: vi.fn(async () => {}) };
    await performAction(goal, patient, { action: 'pause' });
    expect(goal).toMatchObject({ status: 'paused', slot: undefined });
    expect(goal.history[0]).toMatchObject({ action: 'paused', changes: { slot: 2 } });
  });
  it('reanudar sin cupo libre se rechaza; con cupo vuelve a activo', async () => {
    const goal = { _id: oid(), patient: patientId, status: 'paused', requiresValidation: false, history: [], save: vi.fn(async () => {}) };
    taken = [{ _id: oid(), slot: 1 }, { _id: oid(), slot: 2 }, { _id: oid(), slot: 3 }];
    await expect(performAction(goal, patient, { action: 'resume' })).rejects.toMatchObject({ code: 'SLOTS_FULL' });
    taken = [{ _id: oid(), slot: 1 }];
    await performAction(goal, patient, { action: 'resume' });
    expect(goal).toMatchObject({ status: 'active', slot: 2 });
  });
  it('crear reemplazando: pausa el elegido y toma su cupo', async () => {
    const old = { _id: oid(), patient: patientId, status: 'active', slot: 1, history: [], save: vi.fn(async () => { taken = []; }) };
    vi.spyOn(PatientGoal, 'findOne').mockResolvedValue(old);
    taken = [{ _id: old._id, slot: 1 }];
    const goal = await createGoal(patientId, patient, { categoryId: 'strength', priority: 'primary', pauseGoalId: String(old._id), indicators: [press] }, { reader: fakeReader() });
    expect(old.status).toBe('paused');
    expect(goal.slot).toBe(1);
  });
});

describe('hacer principal', () => {
  const mk = (slot, status = 'active') => ({ _id: oid(), patient: patientId, status, slot, history: [], save: vi.fn(async function () { return this; }) });
  it('con el cupo principal libre, el objetivo pasa a principal', async () => {
    const g = mk(2);
    taken = [{ _id: g._id, slot: 2 }];
    await performAction(g, patient, { action: 'make_primary' });
    expect(g.slot).toBe(1);
    expect(g.history[0]).toMatchObject({ action: 'priority_changed', changes: { from: 2, to: 1 } });
  });
  it('con otro principal, se intercambian y los dos conservan su historial', async () => {
    const a = mk(1);
    const b = mk(3);
    taken = [{ _id: a._id, slot: 1 }, { _id: b._id, slot: 3 }];
    vi.spyOn(PatientGoal, 'findById').mockResolvedValue(a);
    await performAction(b, patient, { action: 'make_primary' });
    expect(b.slot).toBe(1);
    expect(a.slot).toBe(3);
    expect(a.history.at(-1).action).toBe('priority_changed');
  });
  it('un objetivo pausado o que ya es principal no se puede ascender', async () => {
    await expect(performAction(mk(undefined, 'paused'), patient, { action: 'make_primary' })).rejects.toMatchObject({ code: 'NOT_ACTIVE' });
    await expect(performAction(mk(1), patient, { action: 'make_primary' })).rejects.toMatchObject({ code: 'ALREADY_PRIMARY' });
  });
});

describe('validación profesional y metas con historial', () => {
  const pending = () => ({
    _id: oid(), patient: patientId, status: 'pending_validation', slot: 1, requiresValidation: true, startedAt: new Date('2026-10-01T15:00:00Z'), history: [],
    indicators: [{ indicatorId: 'pain_eva', label: 'Dolor', seriesKey: 'pain_eva|bodyarea=rodilla-derecha', unit: '/10', direction: 'decrease', target: undefined, baseline: { value: 6, day: '2026-10-01' } }],
    markModified: vi.fn(), save: vi.fn(async () => {}),
  });
  const targets = [{ seriesKey: 'pain_eva|bodyarea=rodilla-derecha', value: 3 }];

  it('el paciente NO puede validar', async () => {
    await expect(performAction(pending(), patient, { action: 'validate', targets })).rejects.toMatchObject({ status: 403, code: 'PROFESSIONAL_ONLY' });
  });
  it('el administrador tampoco: solo un profesional valida', async () => {
    await expect(performAction(pending(), admin, { action: 'validate', targets })).rejects.toMatchObject({ status: 403 });
  });
  it('un profesional valida definiendo la meta: queda activo, validado y con historial', async () => {
    const goal = pending();
    await performAction(goal, pro, { action: 'validate', targets }, { reader: fakeReader() });
    expect(goal.status).toBe('active');
    expect(String(goal.validatedBy)).toBe(String(pro._id));
    expect(goal.indicators[0].target).toEqual({ value: 3 });
    expect(goal.history.map((h) => h.action)).toEqual(['target_changed', 'validated']);
  });
  it('validar sin meta se rechaza', async () => {
    await expect(performAction(pending(), pro, { action: 'validate' }, { reader: fakeReader() })).rejects.toMatchObject({ code: 'TARGET_REQUIRED' });
  });
  it('cambiar una meta deja el valor anterior en el historial (nada se pisa en silencio)', async () => {
    const goal = pending();
    goal.status = 'active'; goal.validatedBy = pro._id;
    goal.indicators[0].target = { value: 3 };
    await performAction(goal, pro, { action: 'update_target', targets: [{ seriesKey: goal.indicators[0].seriesKey, value: 2 }], note: 'Mejoró más rápido' }, { reader: fakeReader() });
    expect(goal.indicators[0].target.value).toBe(2);
    expect(goal.history.at(-1)).toMatchObject({ action: 'target_changed', note: 'Mejoró más rápido', changes: { from: { value: 3 }, to: { value: 2 } } });
  });
  it('si el PACIENTE cambia una meta clínica ya validada, vuelve a quedar pendiente de validación', async () => {
    const goal = pending();
    goal.status = 'active'; goal.validatedBy = pro._id;
    goal.indicators[0].target = { value: 3 };
    await performAction(goal, patient, { action: 'update_target', targets: [{ seriesKey: goal.indicators[0].seriesKey, value: 1 }] }, { reader: fakeReader() });
    expect(goal.status).toBe('pending_validation');
    expect(goal.validatedBy).toBeUndefined();
    expect(goal.history.map((h) => h.action)).toEqual(['target_changed', 'submitted_for_validation']);
  });
  it('el administrador no cambia metas clínicas', async () => {
    const goal = pending();
    goal.status = 'active';
    await expect(performAction(goal, admin, { action: 'update_target', targets })).rejects.toMatchObject({ status: 403 });
  });
  it('descartar exige motivo al personal y deja el cupo libre; el paciente puede descartar sin motivo', async () => {
    const goal = pending();
    await expect(performAction(goal, pro, { action: 'discard' })).rejects.toMatchObject({ code: 'REASON_REQUIRED' });
    await performAction(goal, pro, { action: 'discard', note: 'No corresponde' });
    expect(goal).toMatchObject({ status: 'discarded', slot: undefined, discardReason: 'No corresponde' });
    const other = pending();
    await performAction(other, patient, { action: 'discard' });
    expect(other.status).toBe('discarded');
  });
  it('acciones desconocidas se rechazan', async () => {
    await expect(performAction(pending(), pro, { action: 'borrar-todo' })).rejects.toMatchObject({ status: 400 });
  });
});

describe('registros manuales (autorreporte)', () => {
  const goal = (indicator) => ({ patient: patientId, status: 'active', indicators: [indicator] });
  const stress = { indicatorId: 'stress_perceived', seriesKey: 'stress_perceived', source: 'checkin', unit: '/10' };
  const rom = { indicatorId: 'rom_degrees', seriesKey: 'rom_degrees|joint=hombro', source: 'checkin', unit: '°' };
  beforeEach(() => { vi.spyOn(GoalCheckin, 'create').mockImplementation(async (doc) => doc); });

  it('el paciente registra su estrés: queda como autorreporte', async () => {
    const c = await addCheckin(goal(stress), patient, { seriesKey: 'stress_perceived', value: '7,5', day: '2026-10-01' });
    expect(c).toMatchObject({ value: 7.5, source: 'self_report', unit: '/10', day: '2026-10-01' });
  });
  it('lo que mide el kinesiólogo (grados) NO lo escribe el paciente; el profesional sí, identificado como tal', async () => {
    await expect(addCheckin(goal(rom), patient, { seriesKey: rom.seriesKey, value: 120 })).rejects.toMatchObject({ status: 403 });
    expect(await addCheckin(goal(rom), pro, { seriesKey: rom.seriesKey, value: 120 })).toMatchObject({ source: 'professional', value: 120 });
  });
  it('valida rango, fecha futura e indicadores que se alimentan solos', async () => {
    await expect(addCheckin(goal(stress), patient, { seriesKey: 'stress_perceived', value: 11 })).rejects.toMatchObject({ code: 'INVALID_VALUE' });
    await expect(addCheckin(goal(stress), patient, { seriesKey: 'stress_perceived', value: 5, day: '2999-01-01' })).rejects.toMatchObject({ code: 'FUTURE_DATE' });
    const auto = { indicatorId: 'body_weight', seriesKey: 'body_weight', source: 'measurement_field', unit: 'kg' };
    await expect(addCheckin(goal(auto), patient, { seriesKey: 'body_weight', value: 80 })).rejects.toMatchObject({ code: 'NOT_MANUAL' });
    await expect(addCheckin(goal(stress), patient, { seriesKey: 'otro', value: 5 })).rejects.toMatchObject({ code: 'UNKNOWN_INDICATOR' });
  });
  it('un objetivo pausado no recibe registros', async () => {
    await expect(addCheckin({ ...goal(stress), status: 'paused' }, patient, { seriesKey: 'stress_perceived', value: 5 })).rejects.toMatchObject({ code: 'NOT_ACTIVE' });
  });
  it('reintentar el mismo envío no duplica el registro', async () => {
    GoalCheckin.create.mockRejectedValueOnce(Object.assign(new Error('dup'), { code: 11000 }));
    vi.spyOn(GoalCheckin, 'findOne').mockResolvedValue({ _id: 'ya-estaba' });
    expect(await addCheckin(goal(stress), patient, { seriesKey: 'stress_perceived', value: 5, clientId: 'abc' })).toEqual({ _id: 'ya-estaba' });
  });
});

describe('permisos en el controlador', () => {
  const fakeRes = () => ({ status: vi.fn(function (c) { this.statusCode = c; return this; }), json: vi.fn(function (b) { this.body = b; return this; }) });
  it('un objetivo de un paciente al que no se tiene acceso responde 404 (no revela que existe)', async () => {
    const goal = { _id: oid(), patient: oid(), indicators: [], history: [] };
    vi.spyOn(PatientGoal, 'findById').mockResolvedValue(goal);
    vi.spyOn(auth, 'canAccessPatient').mockResolvedValue(false);
    const res = fakeRes();
    await actOnGoal({ user: patient, params: { goalId: String(goal._id) }, body: { action: 'pause' } }, res);
    expect(res.statusCode).toBe(404);
    const res2 = fakeRes();
    await createGoalCheckin({ user: pro, params: { goalId: String(goal._id) }, body: {} }, res2);
    expect(res2.statusCode).toBe(404);
  });
  it('un id inválido responde 404', async () => {
    const res = fakeRes();
    await actOnGoal({ user: patient, params: { goalId: 'xxx' }, body: {} }, res);
    expect(res.statusCode).toBe(404);
  });
  it('un paciente con el plan vencido solo puede leer: crear responde 403', async () => {
    hasActivePlan.mockResolvedValue(false);
    const res = fakeRes();
    await createPatientGoal({ user: patient, params: { patientId: String(patientId) }, body: { categoryId: 'strength', indicators: [press] } }, res);
    expect(res.statusCode).toBe(403);
    expect(res.body.code).toBe('PLAN_NOT_ACTIVE');
  });
  it('el personal no tiene esa restricción', async () => {
    hasActivePlan.mockResolvedValue(false);
    const res = fakeRes();
    await createPatientGoal({ user: pro, params: { patientId: String(patientId) }, body: { categoryId: 'strength', indicators: [] } }, res);
    expect(res.statusCode).toBe(400); // llega a validar el contenido
  });
  it('leer devuelve los objetivos con su progreso calculado', async () => {
    saved = [];
    const res = fakeRes();
    await getPatientGoals({ params: { patientId: String(patientId) } }, res);
    expect(res.statusCode ?? 200).toBe(200);
    expect(res.body.data.goals).toEqual([]);
  });
});
