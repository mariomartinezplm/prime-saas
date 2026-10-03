/**
 * PRUEBAS — fechas de planes por mes calendario, en hora de Chile.
 * Funciones puras: no hay base de datos ni mocks.
 */

import { describe, it, expect } from 'vitest';
import { santiagoParts, santiagoToUtc, addMonthsSantiago } from '../utils/timezone.js';
import { cycleBounds, buildCycles, paymentDueBy, TERM_CYCLES } from '../services/planCycles.js';

// "YYYY-MM-DD HH:MM" en hora de Santiago, para leer los resultados como una persona
const wall = (date) => {
  const p = santiagoParts(date);
  const pad = (n) => String(n).padStart(2, '0');
  return `${p.year}-${pad(p.month)}-${pad(p.day)} ${pad(p.hour)}:${pad(p.minute)}:${pad(p.second)}`;
};
const at = (y, m, d, hh = 0, mm = 0) => santiagoToUtc(y, m, d, hh, mm);

describe('santiagoToUtc / santiagoParts', () => {
  it('ida y vuelta: el reloj de Santiago marca lo pedido', () => {
    expect(wall(santiagoToUtc(2026, 10, 31, 23, 59, 59))).toBe('2026-10-31 23:59:59');
    expect(wall(santiagoToUtc(2026, 11, 1))).toBe('2026-11-01 00:00:00');
  });

  it('desborda bien meses y días (mes 13 = enero siguiente)', () => {
    expect(wall(santiagoToUtc(2026, 13, 1))).toBe('2027-01-01 00:00:00');
    expect(wall(santiagoToUtc(2026, 10, 36))).toBe('2026-11-05 00:00:00');
  });

  it('en octubre Chile va en UTC-3 (horario de verano): medianoche = 03:00 UTC', () => {
    expect(santiagoToUtc(2026, 10, 15).toISOString()).toBe('2026-10-15T03:00:00.000Z');
  });

  it('en invierno va en UTC-4: medianoche = 04:00 UTC', () => {
    expect(santiagoToUtc(2026, 7, 15).toISOString()).toBe('2026-07-15T04:00:00.000Z');
  });

  it('addMonthsSantiago usa el último día si el mes es más corto', () => {
    expect(wall(addMonthsSantiago(at(2027, 1, 31, 15), 1))).toBe('2027-02-28 00:00:00');
  });
});

describe('ciclo de mes calendario', () => {
  it('pago el 20 de octubre: dura hasta el último segundo del 31 de octubre', () => {
    const { start, end } = cycleBounds(at(2026, 10, 20, 15, 30), 'calendar', 0);
    expect(wall(start)).toBe('2026-10-20 15:30:00');
    expect(wall(end)).toBe('2026-10-31 23:59:59');
  });

  it('pago el día 1: cubre el mes completo', () => {
    const { end } = cycleBounds(at(2026, 11, 1), 'calendar', 0);
    expect(wall(end)).toBe('2026-11-30 23:59:59');
  });

  it('pago el último día del mes: dura solo ese día', () => {
    const { end } = cycleBounds(at(2026, 10, 31, 9), 'calendar', 0);
    expect(wall(end)).toBe('2026-10-31 23:59:59');
  });

  it('febrero 2028 (bisiesto) termina el 29', () => {
    const { end } = cycleBounds(at(2028, 2, 10), 'calendar', 0);
    expect(wall(end)).toBe('2028-02-29 23:59:59');
  });

  it('el ciclo siguiente parte exactamente el día 1 a las 00:00', () => {
    const { start } = cycleBounds(at(2026, 10, 20), 'calendar', 1);
    expect(wall(start)).toBe('2026-11-01 00:00:00');
  });
});

describe('ciclo de fecha a fecha (los que pagan el 10)', () => {
  it('del 10 de octubre al 9 de noviembre; el 10 ya empieza el ciclo nuevo', () => {
    const { start, end } = cycleBounds(at(2026, 10, 10, 11), 'rolling', 0);
    expect(wall(start)).toBe('2026-10-10 11:00:00');
    expect(wall(end)).toBe('2026-11-09 23:59:59');
    expect(wall(cycleBounds(at(2026, 10, 10, 11), 'rolling', 1).start)).toBe('2026-11-10 00:00:00');
  });
});

describe('planes de varios meses', () => {
  it('mensual = 1 ciclo, trimestral = 3, anual = 12', () => {
    expect(TERM_CYCLES).toEqual({ mensual: 1, trimestral: 3, anual: 12 });
  });

  it('trimestral pagado el 1 de octubre: octubre, noviembre y diciembre, sin huecos', () => {
    const cycles = buildCycles(at(2026, 10, 1), 'calendar', 3);
    expect(cycles.map((c) => c.cycleNumber)).toEqual([1, 2, 3]);
    expect(cycles.map((c) => [wall(c.start), wall(c.end)])).toEqual([
      ['2026-10-01 00:00:00', '2026-10-31 23:59:59'],
      ['2026-11-01 00:00:00', '2026-11-30 23:59:59'],
      ['2026-12-01 00:00:00', '2026-12-31 23:59:59']
    ]);
    cycles.slice(1).forEach((c, i) => expect(c.start.getTime()).toBe(cycles[i].end.getTime() + 1));
  });

  it('anual pagado a mitad de mes: 12 ciclos consecutivos que cruzan el cambio de horario', () => {
    const cycles = buildCycles(at(2026, 10, 15, 10), 'calendar', 12);
    expect(cycles).toHaveLength(12);
    expect(wall(cycles[0].end)).toBe('2026-10-31 23:59:59');
    expect(wall(cycles[11].end)).toBe('2027-09-30 23:59:59');
    cycles.slice(1).forEach((c, i) => {
      expect(c.start.getTime()).toBe(cycles[i].end.getTime() + 1);
      expect(wall(c.start).endsWith('-01 00:00:00')).toBe(true);
    });
  });

  it('anual de fecha a fecha: cada ciclo parte el mismo día a las 00:00', () => {
    const cycles = buildCycles(at(2026, 10, 10, 9), 'rolling', 12);
    expect(wall(cycles[1].start)).toBe('2026-11-10 00:00:00');
    expect(wall(cycles[11].end)).toBe('2027-10-09 23:59:59');
  });
});

describe('plazo de pago (5 días)', () => {
  it('ciclo que parte el 1 de noviembre: se puede pagar hasta el 5 inclusive', () => {
    const due = paymentDueBy(at(2026, 11, 1));
    expect(wall(due)).toBe('2026-11-06 00:00:00');
    expect(wall(new Date(due.getTime() - 1))).toBe('2026-11-05 23:59:59');
  });

  it('ciclo de fecha a fecha que parte el 10: plazo hasta el 14 inclusive', () => {
    expect(wall(new Date(paymentDueBy(at(2026, 11, 10)).getTime() - 1))).toBe('2026-11-14 23:59:59');
  });
});
