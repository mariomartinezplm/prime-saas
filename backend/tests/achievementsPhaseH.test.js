/**
 * PRUEBAS — Fase H (backend) del plan de logros: "Mis logros", logros nuevos sin ver y vista del personal.
 *
 * Reglas: una categoría solo aparece si hay datos reales para ella; lo que todavía no existe se muestra como
 * "pendiente"; el paciente solo ve lo suyo; el estado "en revisión" y la evidencia son solo del personal.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import mongoose from 'mongoose';

import AchievementAward from '../models/AchievementAward.js';
import AchievementPause from '../models/AchievementPause.js';
import User from '../models/User.js';
import { santiagoToUtc } from '../utils/timezone.js';
import { goalPeriodKey } from '../services/achievements/body.js';
import { buildOverview } from '../services/achievements/overview.js';
import * as achievementService from '../services/achievementService.js';
import {
  getMyAchievements,
  getMyUnseen,
  markMyAchievementSeen,
  getPatientAchievements
} from '../controllers/achievementController.js';
import achievementRouter from '../routes/achievementRoutes.js';
import { ACHIEVEMENTS, CATEGORY_ORDER, PENDING_ACHIEVEMENTS } from '../config/achievements.js';

vi.mock('../services/achievements/index.js', async (importOriginal) => {
  const real = await importOriginal();
  return { ...real, triggerAchievementEvaluation: vi.fn(async () => {}), getAchievementsOverview: vi.fn() };
});
import { getAchievementsOverview } from '../services/achievements/index.js';

const nuevoId = () => new mongoose.Types.ObjectId();
const AHORA = new Date('2026-10-14T12:00:00Z');

const vacio = () => ({ appointments: [], plans: [], pauses: [], checkins: [], measurements: [], exercises: [], goal: null, awards: [] });
const plan = (extra = {}) => ({
  _id: nuevoId(),
  serviceType: 'entrenamiento',
  sessionsTotal: 8,
  unlimited: false,
  status: 'active',
  startDate: santiagoToUtc(2026, 10, 1),
  endDate: new Date(santiagoToUtc(2026, 11, 1).getTime() - 1),
  ...extra
});
const cita = (type, status, planId) => ({ _id: nuevoId(), type, status, date: new Date('2026-10-05T15:00:00Z'), startTime: '10:00', deduction: planId ? { source: 'clientPlan', refId: planId } : undefined });
const premio = (key, extra = {}) => ({ _id: nuevoId(), key, category: ACHIEVEMENTS[key].category, periodKey: 'once', awardedAt: new Date('2026-10-10T12:00:00Z'), status: 'active', source: 'auto', ruleVersion: 1, evidence: { values: { completed: 5, target: 5 }, refs: [nuevoId()] }, ...extra });
const categoria = (overview, key) => overview.categories.find((c) => c.key === key);
const item = (overview, cat, key) => categoria(overview, cat)?.items.find((i) => i.key === key);

describe('Mis logros: qué categorías aparecen', () => {
  it('un paciente sin datos no ve categorías que no puede evaluar', () => {
    const overview = buildOverview(vacio(), { now: AHORA });
    expect(overview.categories).toEqual([]);
    expect(overview.next).toBeNull();
    expect(overview.unseen).toEqual([]);
  });

  it('kinesiología solo si tuvo sesiones o plan de kinesiología; entrenamiento solo si tiene plan de entrenamiento', () => {
    const conEntreno = buildOverview({ ...vacio(), plans: [plan()] }, { now: AHORA });
    expect(conEntreno.categories.map((c) => c.key)).toEqual(['constancia', 'readiness', 'descanso', 'estres', 'trayectoria']);
    expect(categoria(conEntreno, 'kinesiologia')).toBeUndefined();

    const conKine = buildOverview({ ...vacio(), appointments: [cita('kinesiologia', 'scheduled')] }, { now: AHORA });
    expect(categoria(conKine, 'kinesiologia')).toBeDefined();
    expect(categoria(conKine, 'constancia')).toBeUndefined();
  });

  it('peso solo si la persona lo eligió como objetivo (aunque tenga mediciones); fuerza solo con registros de ejercicios', () => {
    const base = { ...vacio(), plans: [plan()] };
    expect(categoria(buildOverview(base, { now: AHORA }), 'cuerpo')).toBeUndefined();
    expect(categoria(buildOverview(base, { now: AHORA }), 'fuerza')).toBeUndefined();
    // Con mediciones pero sin meta: el peso NO existe para esa persona
    expect(categoria(buildOverview({ ...base, measurements: [{ _id: 1, date: AHORA, weight: 80 }] }, { now: AHORA }), 'cuerpo')).toBeUndefined();
    expect(categoria(buildOverview({ ...base, goal: { direction: 'lose', targetKg: 4, enabled: true, startedAt: AHORA } }, { now: AHORA }), 'cuerpo')).toBeDefined();
    expect(categoria(buildOverview({ ...base, exercises: [{ _id: 1, exerciseName: 'x', weight: 1, reps: 1, date: AHORA }] }, { now: AHORA }), 'fuerza')).toBeDefined();
  });

  it('una categoría con un logro ya concedido siempre se muestra', () => {
    const overview = buildOverview({ ...vacio(), awards: [premio('kine_5')] }, { now: AHORA });
    expect(categoria(overview, 'kinesiologia')).toBeDefined();
  });

  it('las categorías salen en el orden definido', () => {
    const datos = { ...vacio(), appointments: [cita('entrenamiento', 'completed')], plans: [plan(), plan({ serviceType: 'kinesiologia', sessionsTotal: 5 })], goal: { direction: 'lose', targetKg: 4, enabled: true, startedAt: AHORA }, exercises: [{ _id: 2, exerciseName: 'x', weight: 1, reps: 1, date: AHORA }] };
    // «Mis objetivos PRIME» solo aparece cuando ya hay un objetivo conseguido (no antes: no se muestra un reto sin base real)
    expect(buildOverview(datos, { now: AHORA }).categories.map((c) => c.key)).toEqual(CATEGORY_ORDER.filter((k) => k !== 'objetivos'));
  });
});

describe('Mis logros: estados y progreso', () => {
  it('kinesiología: el progreso cuenta solo sesiones completadas', () => {
    const datos = { ...vacio(), appointments: [cita('kinesiologia', 'completed'), cita('kinesiologia', 'completed'), cita('kinesiologia', 'cancelled'), cita('kinesiologia', 'scheduled')] };
    const kine = item(buildOverview(datos, { now: AHORA }), 'kinesiologia', 'kine_5');
    expect(kine.status).toBe('in_progress');
    expect(kine.progress).toMatchObject({ current: 2, target: 5, unit: 'sesiones' });
  });

  it('un logro concedido figura como "earned" con su fecha y el dato que lo justifica', () => {
    const overview = buildOverview({ ...vacio(), appointments: [cita('kinesiologia', 'completed')], awards: [premio('kine_5')] }, { now: AHORA });
    const kine = item(overview, 'kinesiologia', 'kine_5');
    expect(kine.status).toBe('earned');
    expect(kine.awards).toHaveLength(1);
    expect(kine.awards[0]).toMatchObject({ awardedAt: new Date('2026-10-10T12:00:00Z'), detail: '5 sesiones de kinesiología completadas' });
  });

  it('constancia: progreso del mes en curso con las sesiones completadas de ESE plan', () => {
    const p = plan();
    const datos = { ...vacio(), plans: [p], appointments: [cita('entrenamiento', 'completed', p._id), cita('entrenamiento', 'completed', p._id), cita('entrenamiento', 'scheduled', p._id)] };
    const mes = item(buildOverview(datos, { now: AHORA }), 'constancia', 'consistency_month');
    expect(mes.progress).toMatchObject({ current: 2, target: 8, periodKey: '2026-10' });
    expect(mes.status).toBe('in_progress');
  });

  it('un reto sin avance es "available" (no "en progreso")', () => {
    const mes = item(buildOverview({ ...vacio(), plans: [plan()] }, { now: AHORA }), 'constancia', 'consistency_month');
    expect(mes.status).toBe('available');
  });

  it('peso: con la meta incompleta queda "locked" explicando que es opcional; con meta completa muestra el avance hacia SUS kg', () => {
    const mediciones = [{ _id: 'a', date: santiagoToUtc(2026, 10, 1, 12), weight: 80 }, { _id: 'b', date: santiagoToUtc(2026, 10, 10, 12), weight: 78.5 }];
    const incompleta = { direction: 'lose', enabled: true }; // eligió bajar pero aún no escribió cuántos kg
    const sinKg = item(buildOverview({ ...vacio(), measurements: mediciones, goal: incompleta }, { now: AHORA }), 'cuerpo', 'body_goal');
    expect(sinKg.status).toBe('locked');
    expect(sinKg.lockedNote).toMatch(/cuántos kg/i);
    expect(sinKg.lockedNote).toMatch(/opcional/i);

    const meta = { direction: 'lose', targetKg: 4, enabled: true, startedAt: santiagoToUtc(2026, 10, 1, 9) };
    const conMeta = item(buildOverview({ ...vacio(), measurements: mediciones, goal: meta }, { now: AHORA }), 'cuerpo', 'body_goal');
    expect(conMeta.status).toBe('in_progress');
    expect(conMeta.progress).toMatchObject({ current: 1.5, target: 4, unit: 'kg' });
  });

  it('peso: el trofeo de una meta anterior se conserva, pero la tarjeta muestra el estado de la meta de ahora', () => {
    const vieja = { direction: 'lose', targetKg: 2, enabled: true, startedAt: santiagoToUtc(2026, 9, 1, 9) };
    const nueva = { direction: 'gain', targetKg: 3, enabled: true, startedAt: santiagoToUtc(2026, 10, 5, 9) };
    const trofeo = premio('body_goal', { periodKey: goalPeriodKey(vieja), evidence: { values: { direction: 'lose', targetKg: 2, referenceWeight: 80, referenceDate: '2026-09-01' } } });
    const mediciones = [{ _id: 'a', date: santiagoToUtc(2026, 10, 5, 12), weight: 70 }, { _id: 'b', date: santiagoToUtc(2026, 10, 12, 12), weight: 71 }];

    const conNueva = item(buildOverview({ ...vacio(), measurements: mediciones, goal: nueva, awards: [trofeo] }, { now: AHORA }), 'cuerpo', 'body_goal');
    expect(conNueva.status).toBe('in_progress');
    expect(conNueva.awards).toHaveLength(1);

    // Sin meta de ahora, el trofeo ganado se sigue mostrando como conseguido
    const sinMeta = item(buildOverview({ ...vacio(), awards: [trofeo] }, { now: AHORA }), 'cuerpo', 'body_goal');
    expect(sinMeta.status).toBe('earned');
    expect(sinMeta.awards[0].detail).toMatch(/bajar 2 kg/);

    // Con la meta de ahora ya lograda: conseguido
    const logrado = premio('body_goal', { periodKey: goalPeriodKey(nueva) });
    expect(item(buildOverview({ ...vacio(), measurements: mediciones, goal: nueva, awards: [trofeo, logrado] }, { now: AHORA }), 'cuerpo', 'body_goal').status).toBe('earned');
  });

  it('descanso y equilibrio declaran que son autorreporte', () => {
    const checkins = [1, 2, 3].map((n) => ({ _id: n, date: `2026-10-0${n}`, scale: 9, sleep: 8, stress: 8 }));
    const overview = buildOverview({ ...vacio(), plans: [plan()], checkins }, { now: AHORA });
    expect(item(overview, 'descanso', 'rest_week').progress).toMatchObject({ current: 3, target: 5, source: 'autorreporte' });
    expect(item(overview, 'readiness', 'readiness_week').progress).toMatchObject({ current: 3, target: 5 });
  });

  it('los retos que todavía no existen se muestran como "pendientes", sin progreso ni criterio simulado', () => {
    const overview = buildOverview({ ...vacio(), plans: [plan()] }, { now: AHORA });
    const pendientes = overview.categories.flatMap((c) => c.items).filter((i) => i.status === 'pending');
    expect(pendientes.map((p) => p.key).sort()).toEqual(PENDING_ACHIEVEMENTS.map((p) => p.key).sort());
    for (const p of pendientes) {
      expect(p.progress).toBeNull();
      expect(p.awards).toEqual([]);
      expect(p.pendingNote).toMatch(/Pendiente/);
    }
    expect(item(overview, 'descanso', 'device_sleep').pendingNote).toMatch(/no se conecta con ningún dispositivo/);
  });

  it('el próximo hito es el reto en curso más cercano a completarse', () => {
    const p = plan();
    const datos = {
      ...vacio(),
      plans: [p],
      appointments: [...Array.from({ length: 6 }, () => cita('entrenamiento', 'completed', p._id)), ...Array.from({ length: 2 }, () => cita('kinesiologia', 'completed'))]
    };
    const overview = buildOverview(datos, { now: AHORA });
    expect(overview.next).toMatchObject({ key: 'consistency_month', category: 'constancia' });
    expect(overview.next.progress).toMatchObject({ current: 6, target: 8 });
  });
});

describe('Mis logros: privacidad y revisión', () => {
  const enRevision = premio('kine_5', { status: 'under_review', reviewNote: '[auto] Un registro se corrigió', reviewFlaggedAt: new Date() });

  it('el paciente NO ve "en revisión", notas ni evidencia: su logro conserva su lugar', () => {
    const overview = buildOverview({ ...vacio(), awards: [enRevision] }, { audience: 'patient', now: AHORA });
    const award = item(overview, 'kinesiologia', 'kine_5').awards[0];
    expect(award).not.toHaveProperty('status');
    expect(award).not.toHaveProperty('reviewNote');
    expect(award).not.toHaveProperty('evidence');
    expect(JSON.stringify(overview)).not.toMatch(/en revisión|under_review|\[auto\]/);
  });

  it('el personal sí ve el estado, la nota y la evidencia', () => {
    const overview = buildOverview({ ...vacio(), awards: [enRevision] }, { audience: 'staff', now: AHORA });
    const award = item(overview, 'kinesiologia', 'kine_5').awards[0];
    expect(award).toMatchObject({ status: 'under_review', reviewNote: '[auto] Un registro se corrigió', source: 'auto' });
    expect(award.evidence).toMatchObject({ count: 1, values: { completed: 5, target: 5 } });
    expect(overview.history[0].status).toBe('under_review');
  });

  it('los logros nuevos sin ver salen en orden (el más antiguo primero) con su mensaje de celebración', () => {
    const viejo = premio('kine_5', { awardedAt: new Date('2026-10-01T12:00:00Z') });
    const nuevo = premio('readiness_week', { awardedAt: new Date('2026-10-12T12:00:00Z') });
    const visto = premio('streak_3', { awardedAt: new Date('2026-10-05T12:00:00Z'), seenAt: new Date() });
    const { unseen } = buildOverview({ ...vacio(), awards: [nuevo, visto, viejo] }, { now: AHORA });
    expect(unseen.map((u) => u.key)).toEqual(['kine_5', 'readiness_week']);
    expect(unseen[0].message).toBe('¡Primer gran hito! Has completado tus primeras 5 sesiones. Cada paso cuenta.');
  });

  it('el historial va del más reciente al más antiguo; un logro mensual aparece una vez por mes', () => {
    const a = premio('consistency_month', { periodKey: '2026-09', awardedAt: new Date('2026-09-20T12:00:00Z') });
    const b = premio('consistency_month', { periodKey: '2026-10', awardedAt: new Date('2026-10-10T12:00:00Z') });
    const overview = buildOverview({ ...vacio(), plans: [plan()], awards: [a, b] }, { now: AHORA });
    expect(overview.history.map((h) => h.periodKey)).toEqual(['2026-10', '2026-09']);
    expect(item(overview, 'constancia', 'consistency_month').awards).toHaveLength(2);
    expect(overview.summary.earned).toBe(2);
  });

  it('los detalles de récords y de peso solo describen lo registrado', () => {
    const pr = premio('strength_pr', { periodKey: 'sentadilla@2026-W42', evidence: { values: { exercise: 'Sentadilla', weight: 105, unit: 'kg', previousBest: 100 } } });
    const overview = buildOverview({ ...vacio(), exercises: [{ _id: 1, exerciseName: 'Sentadilla', weight: 105, reps: 5, date: AHORA }], awards: [pr] }, { now: AHORA });
    expect(item(overview, 'fuerza', 'strength_pr').awards[0].detail).toBe('Sentadilla: 105 kg (marca anterior 100 kg)');
  });
});

// ── API ─────────────────────────────────────────────────────────────────────
const fakeRes = () => ({
  status: vi.fn(function (code) { this.statusCode = code; return this; }),
  json: vi.fn(function (body) { this.body = body; return this; })
});

describe('API de Mis logros', () => {
  beforeEach(() => { vi.restoreAllMocks(); getAchievementsOverview.mockReset(); });

  it('el paciente solo recibe SUS logros: se usa el id de la sesión, nunca uno recibido en la petición', async () => {
    getAchievementsOverview.mockResolvedValue({ categories: [], history: [] });
    const yo = nuevoId();
    const res = fakeRes();
    await getMyAchievements({ user: { _id: yo }, params: { patientId: String(nuevoId()) }, query: { patientId: String(nuevoId()) }, body: { patientId: String(nuevoId()) } }, res);
    expect(getAchievementsOverview).toHaveBeenCalledWith(yo, { audience: 'patient' });
    expect(res.statusCode).toBe(200);
  });

  it('/me/unseen devuelve solo los logros sin ver del paciente, con su mensaje y sin datos de salud', async () => {
    const yo = nuevoId();
    const chain = { sort: () => chain, limit: () => chain, lean: () => Promise.resolve([premio('kine_5'), { ...premio('kine_5'), key: 'inventado' }]) };
    const find = vi.spyOn(AchievementAward, 'find').mockReturnValue(chain);
    const res = fakeRes();
    await getMyUnseen({ user: { _id: yo } }, res);

    expect(find).toHaveBeenCalledWith({ patient: yo, seenAt: { $exists: false } });
    expect(res.body.data.unseen).toHaveLength(1);
    expect(res.body.data.unseen[0]).toMatchObject({ key: 'kine_5', title: '5 sesiones completadas' });
    expect(res.body.data.unseen[0]).not.toHaveProperty('evidence');
  });

  it('marcar visto: valida el id, usa al paciente de la sesión y es idempotente', async () => {
    const seen = vi.spyOn(achievementService, 'markSeen').mockResolvedValue(null);
    const yo = nuevoId();
    const malo = fakeRes();
    await markMyAchievementSeen({ user: { _id: yo }, params: { awardId: 'no-es-id' } }, malo);
    expect(malo.statusCode).toBe(400);

    const id = nuevoId();
    const ok = fakeRes();
    await markMyAchievementSeen({ user: { _id: yo }, params: { awardId: String(id) } }, ok);
    expect(ok.statusCode).toBe(200);
    expect(seen).toHaveBeenCalledWith({ patientId: yo, awardId: String(id) });
  });

  it('el personal recibe la vista con evidencia, la meta, las pausas y cuántos logros están en revisión', async () => {
    const paciente = nuevoId();
    vi.spyOn(User, 'findById').mockReturnValue({ select: () => Promise.resolve({ _id: paciente, role: 'patient', preferences: { bodyGoal: { direction: 'lose', enabled: true } } }) });
    const chain = { sort: () => chain, populate: () => chain, lean: () => Promise.resolve([{ periodKey: '2026-09', reason: 'Lesión' }]) };
    vi.spyOn(AchievementPause, 'find').mockReturnValue(chain);
    getAchievementsOverview.mockResolvedValue({ categories: [], history: [{ status: 'under_review' }, { status: 'active' }] });

    const res = fakeRes();
    await getPatientAchievements({ user: { _id: nuevoId(), role: 'professional' }, params: { patientId: String(paciente) } }, res);

    expect(getAchievementsOverview).toHaveBeenCalledWith(String(paciente), { audience: 'staff' });
    expect(res.body.data).toMatchObject({ reviewCount: 1, goal: { direction: 'lose', enabled: true }, pauses: [{ periodKey: '2026-09' }] });
  });

  it('la vista del personal solo funciona sobre pacientes (otro rol: 404)', async () => {
    vi.spyOn(User, 'findById').mockReturnValue({ select: () => Promise.resolve({ _id: nuevoId(), role: 'admin' }) });
    const res = fakeRes();
    await getPatientAchievements({ user: { _id: nuevoId(), role: 'admin' }, params: { patientId: String(nuevoId()) } }, res);
    expect(res.statusCode).toBe(404);
    expect(getAchievementsOverview).not.toHaveBeenCalled();
  });

  it('permisos de las rutas: /me/* solo pacientes; /patients/:id solo personal con acceso', () => {
    const rutas = achievementRouter.stack.filter((l) => l.route);
    const buscar = (metodo, ruta) => rutas.find((l) => l.route.path === ruta && l.route.methods[metodo]);
    expect(buscar('get', '/me').route.stack).toHaveLength(2);
    expect(buscar('get', '/me/unseen').route.stack).toHaveLength(2);
    expect(buscar('post', '/me/:awardId/seen').route.stack).toHaveLength(2);
    expect(buscar('get', '/patients/:patientId').route.stack).toHaveLength(3);
    // ninguna ruta de lectura recibe el id de un paciente para el propio panel
    expect(rutas.filter((l) => l.route.path.startsWith('/me')).every((l) => !l.route.path.includes(':patientId'))).toBe(true);
  });
});
