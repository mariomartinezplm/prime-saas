/**
 * PRUEBAS — carga del dashboard del paciente (src/components/dashboard/dashboardLoad.ts y src/lib/withTimeout.ts).
 *
 * Funciones puras: qué bloque espera a qué, qué se reintenta, y que una consulta que nunca responde se trata como error.
 * Misma infraestructura que el resto de backend/tests/ (vitest).
 */

import { describe, it, expect, vi, afterEach } from 'vitest';

const { queriesToRetry, todayIsWaiting, planIsWaiting, hasLoadError } = await import('../../src/components/dashboard/dashboardLoad.ts');
const { withTimeout, QueryTimeoutError, QUERY_TIMEOUT_MS } = await import('../../src/lib/withTimeout.ts');

const st = (upcoming, balance) => ({ upcoming, balance });

describe('«Reintentar» repite solo lo que falló', () => {
  it('si todo salió bien no hay nada que reintentar ni aviso', () => {
    expect(queriesToRetry(st('ready', 'ready'))).toEqual([]);
    expect(hasLoadError(st('ready', 'ready'))).toBe(false);
  });

  it('solo las citas fallaron: se reintentan las citas, no el saldo', () => {
    expect(queriesToRetry(st('error', 'ready'))).toEqual(['upcoming']);
    expect(hasLoadError(st('error', 'ready'))).toBe(true);
  });

  it('solo el saldo falló: se reintenta el saldo, no las citas', () => {
    expect(queriesToRetry(st('ready', 'error'))).toEqual(['balance']);
  });

  it('fallaron las dos: se reintentan las dos', () => {
    expect(queriesToRetry(st('error', 'error'))).toEqual(['upcoming', 'balance']);
  });

  it('lo que todavía carga no se reintenta ni cuenta como error', () => {
    expect(queriesToRetry(st('loading', 'error'))).toEqual(['balance']);
    expect(hasLoadError(st('loading', 'loading'))).toBe(false);
  });
});

describe('qué bloque espera a qué (sin esperas artificiales ni bloques secundarios)', () => {
  it('«Para hoy» espera a las citas y al saldo', () => {
    expect(todayIsWaiting(st('loading', 'ready'), false)).toBe(true);
    expect(todayIsWaiting(st('ready', 'loading'), false)).toBe(true);
    expect(todayIsWaiting(st('ready', 'ready'), false)).toBe(false);
  });

  it('«Para hoy» espera al historial de planes solo cuando se está consultando', () => {
    expect(todayIsWaiting(st('ready', 'ready'), true)).toBe(true);
  });

  it('un error NO deja «Para hoy» esperando (se muestra con lo que haya)', () => {
    expect(todayIsWaiting(st('error', 'ready'), false)).toBe(false);
    expect(todayIsWaiting(st('ready', 'error'), false)).toBe(false);
  });

  it('«Mi plan» solo espera al saldo (y al historial), no a las citas', () => {
    expect(planIsWaiting(st('loading', 'ready'), false)).toBe(false);
    expect(planIsWaiting(st('ready', 'loading'), false)).toBe(true);
    expect(planIsWaiting(st('ready', 'ready'), true)).toBe(true);
  });
});

describe('withTimeout: una consulta que nunca responde pasa a ser un error', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('el plazo es de segundos, no de minutos', () => {
    expect(QUERY_TIMEOUT_MS).toBeGreaterThanOrEqual(10_000);
    expect(QUERY_TIMEOUT_MS).toBeLessThanOrEqual(30_000);
  });

  it('si responde a tiempo entrega el valor y no deja temporizadores', async () => {
    vi.useFakeTimers();
    const result = withTimeout(Promise.resolve('ok'), 1000);
    await expect(result).resolves.toBe('ok');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('si falla antes del plazo, entrega el mismo error', async () => {
    vi.useFakeTimers();
    const boom = new Error('boom');
    await expect(withTimeout(Promise.reject(boom), 1000)).rejects.toBe(boom);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('si nunca responde, al vencer el plazo falla con QueryTimeoutError', async () => {
    vi.useFakeTimers();
    const never = new Promise(() => {});
    const result = withTimeout(never, 1000);
    const assertion = expect(result).rejects.toBeInstanceOf(QueryTimeoutError);
    await vi.advanceTimersByTimeAsync(1000);
    await assertion;
  });

  it('una respuesta tardía (después del plazo) no pisa al error', async () => {
    vi.useFakeTimers();
    let resolveLate;
    const late = new Promise((resolve) => {
      resolveLate = resolve;
    });
    const result = withTimeout(late, 1000);
    const assertion = expect(result).rejects.toBeInstanceOf(QueryTimeoutError);
    await vi.advanceTimersByTimeAsync(1000);
    await assertion;
    resolveLate('tarde');
    await expect(result).rejects.toBeInstanceOf(QueryTimeoutError);
  });
});
