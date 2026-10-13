/**
 * PRUEBAS — fundamentos de logros (Fase B del plan de logros).
 *
 * Mismo patrón que el resto de backend/tests/ (vitest + vi.spyOn, sin BD real). El "almacén" falso imita lo que
 * importa de Mongo: un índice único (paciente + logro + periodo) y $setOnInsert.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import mongoose from 'mongoose';

import AchievementAward from '../models/AchievementAward.js';
import Notification from '../models/Notification.js';
import Appointment, { syncCompletedAt } from '../models/Appointment.js';
import { grantAchievement, flagForReview, markSeen, awardNotificationKey } from '../services/achievementService.js';
import { notifyOnce } from '../services/notificationService.js';
import { GENERIC_NOTIFICATION, isValidPeriodKey } from '../config/achievements.js';

const nuevoId = () => new mongoose.Types.ObjectId();

const DEFS = {
  demo_once: { key: 'demo_once', category: 'kinesiologia', title: 'Demo', ruleVersion: 2, periodic: false },
  demo_month: { key: 'demo_month', category: 'constancia', title: 'Demo mensual', periodic: true }
};

// Almacén en memoria con índice único
function fakeStore() {
  const rows = [];
  const keyOf = (f) => `${f.patient}|${f.key}|${f.periodKey}`;
  vi.spyOn(AchievementAward, 'findOneAndUpdate').mockImplementation(async (filter, update, options = {}) => {
    const existing = rows.find((r) => keyOf(r) === keyOf(filter));
    if (update.$setOnInsert) {
      if (existing) return options.includeResultMetadata ? { value: existing, lastErrorObject: { updatedExisting: true } } : existing;
      const row = { _id: nuevoId(), ...filter, ...update.$setOnInsert };
      rows.push(row);
      return options.includeResultMetadata ? { value: row, lastErrorObject: { updatedExisting: false } } : row;
    }
    // flagForReview / markSeen
    const target = rows.find((r) => r.patient.equals?.(filter.patient) && (filter.key ? r.key === filter.key : true) && (filter._id ? String(r._id) === String(filter._id) : true));
    if (!target) return null;
    if (filter.status && target.status !== filter.status) return null;
    if (filter.seenAt && target.seenAt) return null;
    Object.assign(target, update.$set);
    return target;
  });
  vi.spyOn(AchievementAward, 'findOne').mockImplementation(async (filter) => rows.find((r) => keyOf(r) === keyOf(filter)) || null);
  return rows;
}

// Notificaciones con índice único de dedupeKey
function fakeNotifications() {
  const rows = [];
  vi.spyOn(Notification, 'create').mockImplementation(async (doc) => {
    if (doc.dedupeKey && rows.some((r) => r.dedupeKey === doc.dedupeKey)) {
      const error = new Error('E11000 duplicate key');
      error.code = 11000;
      throw error;
    }
    rows.push(doc);
    return doc;
  });
  return rows;
}

beforeEach(() => vi.restoreAllMocks());

describe('grantAchievement: idempotencia', () => {
  it('concede el logro una vez y avisa una vez', async () => {
    const rows = fakeStore();
    const notifs = fakeNotifications();
    const patientId = nuevoId();

    const first = await grantAchievement({ patientId, key: 'demo_once', evidence: { values: { completed: 5 } } }, { definitions: DEFS });

    expect(first.created).toBe(true);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ category: 'kinesiologia', ruleVersion: 2, source: 'auto', status: 'active', periodKey: 'once' });
    expect(notifs).toHaveLength(1);
  });

  it('un evento duplicado NO crea otro logro ni otro aviso', async () => {
    const rows = fakeStore();
    const notifs = fakeNotifications();
    const patientId = nuevoId();

    await grantAchievement({ patientId, key: 'demo_once', evidence: { values: { completed: 5 } } }, { definitions: DEFS });
    const again = await grantAchievement({ patientId, key: 'demo_once', evidence: { values: { completed: 6 } } }, { definitions: DEFS });

    expect(again.created).toBe(false);
    expect(rows).toHaveLength(1);
    expect(notifs).toHaveLength(1);
    // No se pisa la evidencia ni la fecha originales
    expect(rows[0].evidence.values.completed).toBe(5);
  });

  it('dos procesos a la vez: el índice único deja pasar solo a uno', async () => {
    const rows = fakeStore();
    fakeNotifications();
    const patientId = nuevoId();
    // El primero ya insertó; el segundo choca con E11000 al insertar
    const existing = { _id: nuevoId(), patient: patientId, key: 'demo_once', periodKey: 'once' };
    rows.push(existing);
    AchievementAward.findOneAndUpdate.mockRejectedValueOnce(Object.assign(new Error('dup'), { code: 11000 }));

    const result = await grantAchievement({ patientId, key: 'demo_once' }, { definitions: DEFS });

    expect(result.created).toBe(false);
    expect(result.award).toBe(existing);
  });

  it('un logro mensual se concede una vez POR MES', async () => {
    const rows = fakeStore();
    fakeNotifications();
    const patientId = nuevoId();

    await grantAchievement({ patientId, key: 'demo_month', periodKey: '2026-10' }, { definitions: DEFS });
    await grantAchievement({ patientId, key: 'demo_month', periodKey: '2026-10' }, { definitions: DEFS });
    await grantAchievement({ patientId, key: 'demo_month', periodKey: '2026-11' }, { definitions: DEFS });

    expect(rows.map((r) => r.periodKey)).toEqual(['2026-10', '2026-11']);
  });

  it('dos pacientes con el mismo logro son independientes', async () => {
    const rows = fakeStore();
    fakeNotifications();

    await grantAchievement({ patientId: nuevoId(), key: 'demo_once' }, { definitions: DEFS });
    await grantAchievement({ patientId: nuevoId(), key: 'demo_once' }, { definitions: DEFS });

    expect(rows).toHaveLength(2);
  });
});

describe('grantAchievement: validaciones', () => {
  it('rechaza un logro desconocido', async () => {
    fakeStore();
    await expect(grantAchievement({ patientId: nuevoId(), key: 'inventado' }, { definitions: DEFS })).rejects.toThrow(/desconocido/);
  });

  it('exige periodo mensual en logros mensuales y "once" en los únicos', async () => {
    fakeStore();
    await expect(grantAchievement({ patientId: nuevoId(), key: 'demo_month' }, { definitions: DEFS })).rejects.toThrow(/periodo mensual/);
    await expect(grantAchievement({ patientId: nuevoId(), key: 'demo_once', periodKey: '2026-10' }, { definitions: DEFS })).rejects.toThrow(/una sola vez/);
  });

  it('un reconocimiento manual debe registrar quién lo concede y por qué', async () => {
    const rows = fakeStore();
    fakeNotifications();
    const patientId = nuevoId();

    await expect(grantAchievement({ patientId, key: 'demo_once', source: 'manual' }, { definitions: DEFS })).rejects.toThrow(/quién/);
    await expect(grantAchievement({ patientId, key: 'demo_once', source: 'manual', grantedBy: nuevoId(), reason: '  ' }, { definitions: DEFS })).rejects.toThrow(/por qué/);

    const adminId = nuevoId();
    await grantAchievement({ patientId, key: 'demo_once', source: 'manual', grantedBy: adminId, reason: 'Superó su meta de rehabilitación' }, { definitions: DEFS });
    expect(rows[0]).toMatchObject({ source: 'manual', reason: 'Superó su meta de rehabilitación' });
    expect(String(rows[0].grantedBy)).toBe(String(adminId));
  });

  it('valida el formato del periodo', () => {
    expect(isValidPeriodKey('once')).toBe(true);
    expect(isValidPeriodKey('2026-10')).toBe(true);
    expect(isValidPeriodKey('2026-13')).toBe(false);
    expect(isValidPeriodKey('octubre')).toBe(false);
  });
});

describe('notificaciones de logros', () => {
  it('el texto es genérico: sin datos clínicos ni corporales', async () => {
    fakeStore();
    const notifs = fakeNotifications();
    const patientId = nuevoId();

    await grantAchievement({ patientId, key: 'demo_once', evidence: { summary: 'x', values: { weight: 70 } } }, { definitions: DEFS });

    expect(notifs[0]).toMatchObject({ type: 'achievement_unlocked', title: GENERIC_NOTIFICATION.title, body: GENERIC_NOTIFICATION.body, link: '/app/logros' });
    expect(JSON.stringify(notifs[0])).not.toMatch(/70|weight|peso|sesion/i);
    expect(notifs[0].dedupeKey).toBe(awardNotificationKey(String(patientId), 'demo_once', 'once'));
  });

  it('notifyOnce no duplica la misma dedupeKey y exige tenerla', async () => {
    const notifs = fakeNotifications();
    const userId = nuevoId();

    const a = await notifyOnce(userId, 'achievement_unlocked', { title: 'T', body: 'B', dedupeKey: 'k1' });
    const b = await notifyOnce(userId, 'achievement_unlocked', { title: 'T', body: 'B', dedupeKey: 'k1' });

    expect(a).not.toBeNull();
    expect(b).toBeNull();
    expect(notifs).toHaveLength(1);
    await expect(notifyOnce(userId, 'achievement_unlocked', { title: 'T', body: 'B' })).rejects.toThrow(/dedupeKey/);
  });

  it('notifyOnce propaga los errores que no son de duplicado', async () => {
    vi.spyOn(Notification, 'create').mockRejectedValue(new Error('base caída'));
    await expect(notifyOnce(nuevoId(), 'achievement_unlocked', { title: 'T', body: 'B', dedupeKey: 'k' })).rejects.toThrow('base caída');
  });
});

describe('correcciones y vistos', () => {
  it('una corrección deja el logro "en revisión": no lo borra ni cambia su fecha', async () => {
    const rows = fakeStore();
    fakeNotifications();
    const patientId = nuevoId();
    await grantAchievement({ patientId, key: 'demo_once', awardedAt: new Date('2026-10-01') }, { definitions: DEFS });

    const flagged = await flagForReview({ patientId, key: 'demo_once', note: 'Una cita se corrigió a "no asistió"' });

    expect(flagged.status).toBe('under_review');
    expect(rows).toHaveLength(1);
    expect(rows[0].awardedAt).toEqual(new Date('2026-10-01'));
    // y volver a evaluar no lo concede de nuevo
    const again = await grantAchievement({ patientId, key: 'demo_once' }, { definitions: DEFS });
    expect(again.created).toBe(false);
    expect(rows).toHaveLength(1);
  });

  it('solo se marca "visto" una vez y solo por su dueño', async () => {
    fakeStore();
    fakeNotifications();
    const patientId = nuevoId();
    const { award } = await grantAchievement({ patientId, key: 'demo_once' }, { definitions: DEFS });

    expect(await markSeen({ patientId: nuevoId(), awardId: award._id })).toBeNull();
    const seen = await markSeen({ patientId, awardId: award._id });
    expect(seen.seenAt).toBeInstanceOf(Date);
    expect(await markSeen({ patientId, awardId: award._id })).toBeNull();
  });
});

describe('Appointment.completedAt', () => {
  const fake = (status, completedAt = null, modified = true) => ({ status, completedAt, isModified: (field) => field === 'status' && modified });

  it('se fija al pasar a completada y se conserva si ya existía', () => {
    const cita = fake('completed');
    syncCompletedAt(cita);
    expect(cita.completedAt).toBeInstanceOf(Date);

    const antes = new Date('2026-10-01T10:00:00Z');
    const ya = fake('completed', antes);
    syncCompletedAt(ya);
    expect(ya.completedAt).toBe(antes);
  });

  it('se borra si la cita se corrige a otro estado', () => {
    for (const status of ['scheduled', 'no-show', 'cancelled']) {
      const cita = fake(status, new Date());
      syncCompletedAt(cita);
      expect(cita.completedAt).toBeNull();
    }
  });

  it('no toca nada si el estado no cambió (citas antiguas sin completedAt)', () => {
    const cita = fake('completed', null, false);
    syncCompletedAt(cita);
    expect(cita.completedAt).toBeNull();
  });

  it('el campo existe en el esquema y empieza en null', () => {
    const cita = new Appointment({});
    expect(cita.completedAt).toBeNull();
  });
});
