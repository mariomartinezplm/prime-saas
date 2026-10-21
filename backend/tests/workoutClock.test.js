/**
 * PRUEBAS — Entrenamiento en curso: relojes del frontend (se derivan de instantes, sin intervalos).
 */
import { describe, it, expect } from 'vitest';
const { clockOffset, elapsedSec, restRemainingSec, restDisplayState, restFraction, formatClock, spokenDuration } = await import('../../src/lib/workoutClock.ts');

const t = (h, m = 0, s = 0) => Date.UTC(2026, 9, 20, h, m, s);
const iso = (ms) => new Date(ms).toISOString();

describe('cronómetro de sesión: sin límite de una hora', () => {
  const start = iso(t(21, 0, 0)); // 18:00 en Chile
  it.each([
    [15, '15:00'],
    [60, '1:00:00'],
    [75, '1:15:00'],
    [100, '1:40:00'],
    [120, '2:00:00'],
    [180, '3:00:00'],
  ])('a los %i min marca %s', (min, text) => {
    expect(formatClock(elapsedSec(start, t(21, min), 0))).toBe(text);
  });

  it('salir de la app y volver 40 min después: el tiempo se reconstruye con las marcas, no con un contador', () => {
    // la pestaña estuvo suspendida: no hubo ningún "tick" entre las 21:20 y las 22:00
    expect(elapsedSec(start, t(21, 20), 0)).toBe(20 * 60);
    expect(elapsedSec(start, t(22, 0), 0)).toBe(60 * 60);
  });

  it('una hora del celular mal puesta se corrige con la hora del servidor', () => {
    const deviceNow = t(21, 30); // el celular cree que son las 21:30...
    const serverNow = iso(t(22, 0)); // ...pero el servidor dice 22:00
    const offset = clockOffset(serverNow, deviceNow);
    expect(offset).toBe(30 * 60 * 1000);
    expect(elapsedSec(start, deviceNow, offset)).toBe(60 * 60);
  });

  it('nunca da tiempo negativo', () => {
    expect(elapsedSec(start, t(20, 0), 0)).toBe(0);
  });
});

describe('descanso: vencimiento persistido', () => {
  const rest = { state: 'running', dueAt: iso(t(21, 17, 0)), remainingSec: 0, durationSec: 120, nextDurationSec: 120, version: 1 };

  it('2:00 iniciado a las 18:15:00 (21:15 UTC): 00:40 a las 18:16:20 y terminado a las 18:18:00', () => {
    expect(restRemainingSec(rest, t(21, 16, 20), 0)).toBe(40);
    expect(restDisplayState(rest, t(21, 16, 20), 0)).toBe('running');
    expect(restRemainingSec(rest, t(21, 18, 0), 0)).toBe(0);
    expect(restDisplayState(rest, t(21, 18, 0), 0)).toBe('done');
  });

  it('en pausa el tiempo no corre, sin importar cuánto pase', () => {
    const paused = { ...rest, state: 'paused', dueAt: null, remainingSec: 70 };
    expect(restRemainingSec(paused, t(21, 16), 0)).toBe(70);
    expect(restRemainingSec(paused, t(23, 0), 0)).toBe(70);
    expect(restDisplayState(paused, t(23, 0), 0)).toBe('paused');
  });

  it('reposo sin descanso o ya terminado: 0', () => {
    expect(restRemainingSec({ ...rest, state: 'idle', dueAt: null }, t(21, 0), 0)).toBe(0);
    expect(restRemainingSec({ ...rest, state: 'done', dueAt: null }, t(21, 0), 0)).toBe(0);
  });

  it('el anillo baja de 1 a 0 y no se sale del rango', () => {
    expect(restFraction(rest, t(21, 15, 0), 0)).toBe(1);
    expect(restFraction(rest, t(21, 16, 0), 0)).toBeCloseTo(0.5, 2);
    expect(restFraction(rest, t(22, 0, 0), 0)).toBe(0);
    expect(restFraction({ ...rest, durationSec: 0 }, t(21, 0), 0)).toBe(0);
  });
});

describe('formato', () => {
  it('formatea horas, minutos y segundos', () => {
    expect(formatClock(0)).toBe('00:00');
    expect(formatClock(59)).toBe('00:59');
    expect(formatClock(3599)).toBe('59:59');
    expect(formatClock(3600)).toBe('1:00:00');
    expect(formatClock(45, { alwaysHours: true })).toBe('0:00:45');
    expect(formatClock(-5)).toBe('00:00');
  });

  it('describe la duración para lectores de pantalla', () => {
    expect(spokenDuration(75 * 60)).toBe('1 hora 15 minutos');
    expect(spokenDuration(125 * 60)).toBe('2 horas 5 minutos');
    expect(spokenDuration(60)).toBe('1 minuto');
  });
});
