/**
 * PRUEBAS — helpers de tendencia de las mediciones del paciente (src/lib/trend.ts).
 * Garantizan que lo que se ve (cambio, rango, descripción accesible) sale solo de los registros reales.
 */
import { describe, it, expect } from 'vitest';

const { summarize, filterByRange, formatValue, describeTrend, sortPoints } = await import('../../src/lib/trend.ts');

const P = (date, value) => ({ date, value });
const PESO = [P('2026-07-10', 78.2), P('2026-08-12', 77.0), P('2026-09-14', 75.8), P('2026-10-02', 74.9), P('2026-10-18', 74.6)];

describe('formatValue', () => {
  it('usa coma decimal chilena y respeta los decimales pedidos', () => {
    expect(formatValue(74.6, 1)).toBe('74,6');
    expect(formatValue(81, 0)).toBe('81');
    expect(formatValue(31.5, 1)).toBe('31,5');
  });
});

describe('summarize', () => {
  it('calcula el cambio entre el primer y el último registro, con signo y unidad', () => {
    const s = summarize(PESO, 'kg', 1);
    expect(s.count).toBe(5);
    expect(s.changeText).toBe('−3,6 kg');
    expect(s.direction).toBe('down');
    expect(s.last.value).toBe(74.6);
  });
  it('un aumento lleva «+»; sin variación dice «Sin cambios»; sin datos devuelve null', () => {
    expect(summarize([P('2026-01-01', 56), P('2026-02-01', 58)], 'cm', 0).changeText).toBe('+2 cm');
    expect(summarize([P('2026-01-01', 94), P('2026-02-01', 94)], 'cm', 0).changeText).toBe('Sin cambios');
    expect(summarize([], 'kg', 1)).toBeNull();
  });
  it('no depende del orden en que lleguen los registros', () => {
    const s = summarize([...PESO].reverse(), 'kg', 1);
    expect(s.first.date).toBe('2026-07-10');
    expect(s.changeText).toBe('−3,6 kg');
  });
  it('evita ruido de decimales (0,1 + 0,2)', () => {
    expect(summarize([P('2026-01-01', 70.1), P('2026-02-01', 70.3)], 'kg', 1).changeText).toBe('+0,2 kg');
  });
});

describe('filterByRange', () => {
  it('cuenta hacia atrás desde el ÚLTIMO registro, no desde hoy', () => {
    expect(filterByRange(PESO, '3m').map((p) => p.date)).toEqual(['2026-08-12', '2026-09-14', '2026-10-02', '2026-10-18'].filter((d) => d >= '2026-07-18'));
    expect(filterByRange(PESO, 'all')).toHaveLength(5);
  });
  it('con datos viejos sigue mostrando lo último registrado', () => {
    const viejo = [P('2025-01-10', 80), P('2025-02-10', 79)];
    expect(filterByRange(viejo, '3m')).toHaveLength(2);
  });
});

describe('describeTrend (texto para lectores de pantalla)', () => {
  it('describe rango, valores y cantidad de registros', () => {
    const t = describeTrend('Peso', PESO, 'kg', 1);
    expect(t).toContain('5 registros');
    expect(t).toContain('78,2 kg');
    expect(t).toContain('74,6 kg');
    expect(t).toContain('−3,6 kg');
  });
  it('sin registros no inventa nada', () => {
    expect(describeTrend('Peso', [], 'kg', 1)).toBe('Peso: sin registros.');
  });
  it('sortPoints no modifica el arreglo original', () => {
    const original = [...PESO].reverse();
    sortPoints(original);
    expect(original[0].date).toBe('2026-10-18');
  });
});
