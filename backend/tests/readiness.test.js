/**
 * PRUEBAS — puntaje y semáforo del Readiness (cálculo puro, sin base de datos).
 */

import { describe, it, expect } from 'vitest';
import {
  computeReadiness,
  statusFromScore,
  toScale9,
  normalizedValues,
  serializeCheckin,
  isValidAnswer
} from '../utils/readiness.js';

const todo = (n) => ({ sleep: n, energy: n, stress: n, soreness: n, mood: n });

describe('semáforo', () => {
  it('todo en 9 es verde, todo en 1 es rojo, todo en 5 es amarillo', () => {
    expect(computeReadiness(todo(9)).status).toBe('green');
    expect(computeReadiness(todo(1)).status).toBe('red');
    expect(computeReadiness(todo(5)).status).toBe('yellow');
  });

  it('los límites: 7 es verde, 4 es amarillo, justo debajo de 4 es rojo', () => {
    expect(computeReadiness(todo(7)).status).toBe('green');
    expect(computeReadiness(todo(4)).status).toBe('yellow');
    expect(statusFromScore(3.96)).toBe('red');
    expect(statusFromScore(6.9)).toBe('yellow');
  });

  it('un promedio apenas bajo 4 es rojo', () => {
    const r = computeReadiness({ sleep: 4, energy: 4, stress: 4, soreness: 4, mood: 3 });
    expect(r.score).toBe(3.8);
    expect(r.status).toBe('red');
  });

  it('UNA respuesta muy mala impide el verde aunque el promedio sea alto', () => {
    const r = computeReadiness({ sleep: 9, energy: 9, stress: 9, soreness: 2, mood: 9 }); // promedio 7.6
    expect(r.score).toBe(7.6);
    expect(r.status).toBe('yellow');
    expect(r.flags).toEqual(['soreness']);
  });

  it('una respuesta en 3 (no "muy mala") sí permite el verde', () => {
    const r = computeReadiness({ sleep: 9, energy: 9, stress: 9, soreness: 3, mood: 9 });
    expect(r.status).toBe('green');
    expect(r.flags).toEqual([]);
  });

  it('la respuesta muy mala solo baja el verde a amarillo, no fuerza el rojo', () => {
    const r = computeReadiness({ sleep: 1, energy: 8, stress: 8, soreness: 8, mood: 8 }); // promedio 6.6
    expect(r.status).toBe('yellow');
  });

  it('cada color trae su mensaje', () => {
    expect(computeReadiness(todo(9)).message).toMatch(/como está planificado/);
    expect(computeReadiness(todo(5)).message).toMatch(/bajar/);
    expect(computeReadiness(todo(1)).message).toMatch(/kinesiólogo/);
  });
});

describe('check-ins antiguos (escala 1-5)', () => {
  it('1,2,3,4,5 se convierten a 1,3,5,7,9', () => {
    expect([1, 2, 3, 4, 5].map((v) => toScale9(v, undefined))).toEqual([1, 3, 5, 7, 9]);
  });

  it('los de escala 9 no se tocan', () => {
    expect(toScale9(6, 9)).toBe(6);
  });

  it('un 2.5 de la escala vieja (la alerta anterior) equivale al 4 de la nueva', () => {
    expect(1 + (2.5 - 1) * 2).toBe(4);
  });

  it('serializeCheckin devuelve todo en 1-9 con su semáforo', () => {
    const viejo = { _id: 'a', patient: 'p', date: '2026-09-01', sleep: 5, energy: 5, stress: 5, soreness: 5, mood: 5 };
    const out = serializeCheckin(viejo);
    expect(out.sleep).toBe(9);
    expect(out.readiness.status).toBe('green');

    const nuevo = { ...viejo, scale: 9, sleep: 3, energy: 3, stress: 3, soreness: 3, mood: 3 };
    expect(serializeCheckin(nuevo).readiness.status).toBe('red');
  });

  it('serializeCheckin no filtra la escala interna ni datos de más', () => {
    const out = serializeCheckin({ _id: 'a', patient: 'p', date: 'd', scale: 9, ...todo(5), extra: 'x' });
    expect(out).not.toHaveProperty('scale');
    expect(out).not.toHaveProperty('extra');
  });
});

describe('validación de respuestas', () => {
  it('acepta enteros de 1 a 9 y rechaza el resto', () => {
    expect([1, 5, 9].every(isValidAnswer)).toBe(true);
    for (const malo of [0, 10, 4.5, '5', null, undefined, NaN]) {
      expect(isValidAnswer(malo)).toBe(false);
    }
  });
});
