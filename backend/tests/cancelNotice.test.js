/**
 * PRUEBAS — aviso de cancelación (src/lib/cancelNotice.ts): cuándo se muestra y qué dice.
 */
import { describe, it, expect } from 'vitest';

const { CANCEL_NOTICE, CANCEL_NOTICE_HOURS, isInTrainingTime, shouldShowCancelNotice } = await import('../../src/lib/cancelNotice.ts');
const { PATIENT_CANCEL_AHEAD_HOURS } = await import('../services/bookingRulesService.js');

// Cita de hoy 10:00–11:00 (hora local del dispositivo; los helpers del frontend leen día + "HH:mm" locales)
const apt = (extra = {}) => ({ _id: 'a1', date: '2026-11-04T00:00:00.000Z', startTime: '10:00', endTime: '11:00', status: 'scheduled', type: 'entrenamiento', ...extra });
const at = (h, m = 0) => new Date(2026, 10, 4, h, m, 0);
const base = { hasPlan: true, appointments: [], appointmentsLoading: false, dismissed: false };

describe('la regla', () => {
  it('son 3 horas, igual que lo que exige el servidor', () => {
    expect(CANCEL_NOTICE_HOURS).toBe(3);
    expect(PATIENT_CANCEL_AHEAD_HOURS).toBe(3);
    expect(CANCEL_NOTICE.title).toContain('3 horas');
    expect(CANCEL_NOTICE.body).toContain('3 horas');
    expect(CANCEL_NOTICE.body).toMatch(/se descuenta de tu plan/);
  });
});

describe('cuándo se muestra', () => {
  it('cada vez que entra, a quien tiene plan, cualquier día', () => {
    expect(shouldShowCancelNotice({ ...base, now: at(8) })).toBe(true);
    expect(shouldShowCancelNotice({ ...base, now: new Date(2026, 10, 7, 20) })).toBe(true);
  });
  it('no si ya lo cerró en esta visita, no sin plan y no mientras cargan las citas', () => {
    expect(shouldShowCancelNotice({ ...base, now: at(8), dismissed: true })).toBe(false);
    expect(shouldShowCancelNotice({ ...base, now: at(8), hasPlan: false })).toBe(false);
    expect(shouldShowCancelNotice({ ...base, now: at(8), appointmentsLoading: true })).toBe(false);
  });
  it('no en pleno horario de entrenamiento (de 30 min antes hasta el fin), sí antes y después', () => {
    const a = [apt()];
    expect(shouldShowCancelNotice({ ...base, appointments: a, now: at(9, 29) })).toBe(true);
    expect(shouldShowCancelNotice({ ...base, appointments: a, now: at(9, 30) })).toBe(false);
    expect(shouldShowCancelNotice({ ...base, appointments: a, now: at(10, 30) })).toBe(false);
    expect(shouldShowCancelNotice({ ...base, appointments: a, now: at(11, 0) })).toBe(false);
    expect(shouldShowCancelNotice({ ...base, appointments: a, now: at(11, 1) })).toBe(true);
  });
  it('una cita cancelada, otro día o de otro tipo no cuenta como horario de entrenamiento', () => {
    expect(isInTrainingTime([apt({ status: 'cancelled' })], at(10, 15))).toBe(false);
    expect(isInTrainingTime([apt({ date: '2026-11-05T00:00:00.000Z' })], at(10, 15))).toBe(false);
    expect(isInTrainingTime([apt({ type: 'kinesiologia' })], at(10, 15))).toBe(false);
    expect(isInTrainingTime(null, at(10, 15))).toBe(false);
  });
});
