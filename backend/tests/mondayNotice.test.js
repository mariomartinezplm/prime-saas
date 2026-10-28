/**
 * PRUEBAS — aviso de los lunes (src/lib/mondayNotice.ts): cuándo se muestra y qué dice.
 */
import { describe, it, expect } from 'vitest';

const { santiagoDay, shouldShowMondayNotice, MONDAY_NOTICE, CANCEL_NOTICE_HOURS } = await import('../../src/lib/mondayNotice.ts');
const { PATIENT_CANCEL_AHEAD_HOURS } = await import('../services/bookingRulesService.js');

const MONDAY = new Date('2026-11-02T13:00:00.000Z'); // lunes 2 de noviembre, 10:00 en Chile
const TUESDAY = new Date('2026-11-03T13:00:00.000Z');
const SUNDAY_NIGHT = new Date('2026-11-02T01:30:00.000Z'); // domingo 1 de noviembre, 22:30 en Chile (en UTC ya es lunes)
const MONDAY_LATE_NIGHT = new Date('2026-11-03T02:30:00.000Z'); // lunes 2, 23:30 en Chile (en UTC ya es martes)

describe('día en Chile', () => {
  it('usa la hora de Chile, no la del servidor: el domingo de noche aún no es lunes y el lunes de noche todavía lo es', () => {
    expect(santiagoDay(MONDAY)).toEqual({ day: '2026-11-02', isMonday: true });
    expect(santiagoDay(SUNDAY_NIGHT)).toEqual({ day: '2026-11-01', isMonday: false });
    expect(santiagoDay(MONDAY_LATE_NIGHT)).toEqual({ day: '2026-11-02', isMonday: true });
    expect(santiagoDay(TUESDAY).isMonday).toBe(false);
  });
});

describe('cuándo se muestra', () => {
  it('los lunes, a quien tiene plan vigente', () => {
    expect(shouldShowMondayNotice({ now: MONDAY, hasPlan: true, dismissedDay: null })).toBe(true);
    expect(shouldShowMondayNotice({ now: MONDAY_LATE_NIGHT, hasPlan: true, dismissedDay: null })).toBe(true);
  });
  it('ningún otro día, y no a quien no tiene plan', () => {
    expect(shouldShowMondayNotice({ now: TUESDAY, hasPlan: true, dismissedDay: null })).toBe(false);
    expect(shouldShowMondayNotice({ now: SUNDAY_NIGHT, hasPlan: true, dismissedDay: null })).toBe(false);
    expect(shouldShowMondayNotice({ now: MONDAY, hasPlan: false, dismissedDay: null })).toBe(false);
  });
  it('si lo cerró hoy no vuelve ese lunes, pero sí el lunes siguiente', () => {
    expect(shouldShowMondayNotice({ now: MONDAY, hasPlan: true, dismissedDay: '2026-11-02' })).toBe(false);
    expect(shouldShowMondayNotice({ now: new Date('2026-11-09T13:00:00.000Z'), hasPlan: true, dismissedDay: '2026-11-02' })).toBe(true);
  });
});

describe('qué dice', () => {
  it('menciona las 4 horas, que es la misma regla que aplica el servidor', () => {
    expect(CANCEL_NOTICE_HOURS).toBe(PATIENT_CANCEL_AHEAD_HOURS);
    expect(MONDAY_NOTICE.body).toContain(`${CANCEL_NOTICE_HOURS} horas`);
    expect(MONDAY_NOTICE.title).toContain(`${CANCEL_NOTICE_HOURS} horas`);
    expect(MONDAY_NOTICE.body).toMatch(/cancelar o reagendar/);
    expect(MONDAY_NOTICE.body).toMatch(/se descuenta de tu plan/);
  });
});
