/**
 * PRUEBAS — cambiar la fecha de inicio de un plan (services/planLifecycleService.js).
 * La lógica de estados es pura; el recorrido completo contra la base se verificó con MongoDB real.
 */
import { describe, it, expect } from 'vitest';
import { statusesForCycles, changePlanStartDate, PlanDateError } from '../services/planLifecycleService.js';
import { buildCycles } from '../services/planCycles.js';
import { santiagoToUtc } from '../utils/timezone.js';

describe('statusesForCycles', () => {
  const cycles = buildCycles(santiagoToUtc(2026, 9, 1), 'calendar', 3);

  it('antes del primer ciclo vigente: los terminados vencen, el actual queda activo, el resto por empezar', () => {
    expect(statusesForCycles(cycles, santiagoToUtc(2026, 10, 15))).toEqual(['expired', 'active', 'upcoming']);
    expect(statusesForCycles(cycles, santiagoToUtc(2026, 9, 15))).toEqual(['active', 'upcoming', 'upcoming']);
  });

  it('si todos los ciclos ya terminaron, el último queda activo (la pasada del programador abre la renovación)', () => {
    expect(statusesForCycles(cycles, santiagoToUtc(2027, 3, 1))).toEqual(['expired', 'expired', 'active']);
  });
});

describe('changePlanStartDate: validaciones', () => {
  const plan = (extra = {}) => ({ status: 'active', ...extra });
  const ahora = santiagoToUtc(2026, 10, 20, 10, 0);

  it('rechaza fechas con formato inválido, muy antiguas o muy lejanas', async () => {
    for (const fecha of [undefined, '', '17/10/2026', '2026-13-45x', '2024-01-01', '2027-06-01']) {
      await expect(changePlanStartDate(plan(), fecha, ahora)).rejects.toBeInstanceOf(PlanDateError);
    }
  });

  it('un plan cancelado no se modifica', async () => {
    await expect(changePlanStartDate(plan({ status: 'cancelled' }), '2026-10-10', ahora)).rejects.toThrow(/cancelado/);
  });

  it('solo se cambia desde el primer ciclo de un pago de varios meses', async () => {
    await expect(changePlanStartDate(plan({ termId: 'x', cycleNumber: 2 }), '2026-10-10', ahora)).rejects.toThrow(/primer ciclo/);
  });
});
