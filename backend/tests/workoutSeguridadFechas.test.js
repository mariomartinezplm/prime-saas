/**
 * PRUEBAS — Series pendientes (aislamiento por cuenta, caducidad, envío sin duplicar) y fechas de Chile (medianoche, horario de verano).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { santiagoToUtc } from '../utils/timezone.js';

vi.mock('../services/clientPlanService.js', () => ({ hasActivePlan: vi.fn() }));
const { putPending, listPending, removePending, clearPending, countPendingSets, flushPendingBatches, isRetryable, PENDING_TTL_MS } = await import('../../src/lib/pendingSets.ts');
const { dayAtNoon } = await import('../controllers/workoutController.js');
const { sessionRecords, buildSummary } = await import('../services/workoutSets.js');
const { dayOf } = await import('../services/achievements/dates.js');

const batch = (userId, id, over = {}) => ({ batchId: id, userId, sessionId: 's1', blockId: 'b1', sets: [{ clientId: id, slot: 'A1', reps: 5, weight: 60 }], display: [], savedAt: Date.now(), ...over });
beforeEach(async () => { await clearPending(); });

describe('series pendientes: protegidas y aisladas por cuenta', () => {
  it('una cuenta NO ve ni envía lo pendiente de otra', async () => {
    await putPending(batch('ana', 'serie-ana-0001'));
    await putPending(batch('luis', 'serie-luis-001'));
    expect((await listPending(undefined, 'ana')).map((b) => b.batchId)).toEqual(['serie-ana-0001']);
    const enviados = [];
    await flushPendingBatches('luis', async (b) => { enviados.push(b.batchId); }, isRetryable);
    expect(enviados).toEqual(['serie-luis-001']); // jamás se envía el lote de Ana con la cuenta de Luis
    expect(await countPendingSets('ana')).toBe(1);
  });

  it('borrar lo pendiente de una cuenta no toca el de otra', async () => {
    await putPending(batch('ana', 'serie-ana-0002'));
    await putPending(batch('luis', 'serie-luis-002'));
    await clearPending('ana');
    expect(await countPendingSets('ana')).toBe(0);
    expect(await countPendingSets('luis')).toBe(1);
  });

  it('sin conexión se conserva y se deja de intentar; con el servidor rechazando, se retira; nada se duplica', async () => {
    await putPending(batch('ana', 'serie-ana-0003', { savedAt: Date.now() - 2000 }));
    await putPending(batch('ana', 'serie-ana-0004'));
    const redCaida = Object.assign(new Error('Network Error'), {}); // sin respuesta = reintentable
    let r = await flushPendingBatches('ana', async () => { throw redCaida; }, isRetryable);
    expect(r).toMatchObject({ sent: 0, left: 2 });
    // vuelve la red: se envían una sola vez cada una
    const vistos = [];
    r = await flushPendingBatches('ana', async (b) => { vistos.push(b.batchId); }, isRetryable);
    expect(vistos).toEqual(['serie-ana-0003', 'serie-ana-0004']);
    expect(r).toMatchObject({ sent: 2, left: 0 });
    r = await flushPendingBatches('ana', async (b) => { vistos.push(b.batchId); }, isRetryable);
    expect(vistos).toHaveLength(2); // segunda pasada: nada que reenviar
    // dato rechazado (400): se retira, no se reintenta para siempre
    await putPending(batch('ana', 'serie-ana-0005'));
    r = await flushPendingBatches('ana', async () => { throw Object.assign(new Error('x'), { response: { status: 400 } }); }, isRetryable);
    expect(r).toMatchObject({ dropped: 1, left: 0 });
  });

  it('caduca a las 24 h', async () => {
    await putPending(batch('ana', 'serie-ana-0006', { savedAt: Date.now() - PENDING_TTL_MS - 1000 }));
    expect(await countPendingSets('ana')).toBe(0);
  });
});

describe('fecha de la serie = día de Chile al mediodía', () => {
  const dia = (instante) => dayAtNoon(instante).toISOString();
  it('23:50 y 00:10 de Chile caen en días distintos y consecutivos', () => {
    expect(dayOf(dayAtNoon(santiagoToUtc(2026, 10, 20, 23, 50)))).toBe('2026-10-20');
    expect(dayOf(dayAtNoon(santiagoToUtc(2026, 10, 21, 0, 10)))).toBe('2026-10-21');
    // y el navegador (que lee el día en UTC) ve el MISMO día, no el siguiente
    expect(dayAtNoon(santiagoToUtc(2026, 10, 20, 23, 50)).toISOString().slice(0, 10)).toBe('2026-10-20');
    expect(dayAtNoon(santiagoToUtc(2026, 10, 21, 0, 10)).toISOString().slice(0, 10)).toBe('2026-10-21');
  });
  it('la hora UTC después de las 21:00 de Chile (ya es «mañana» en UTC) sigue siendo el día local', () => {
    const t = new Date('2026-10-21T01:30:00Z'); // 22:30 del 20 en Chile (UTC-3)
    expect(dayAtNoon(t).toISOString().slice(0, 10)).toBe('2026-10-20');
  });
  it('cambio de horario de VERANO (septiembre): 23:59 del 5 y 01:00 del 6', () => {
    expect(dayAtNoon(new Date('2026-09-06T03:59:00Z')).toISOString().slice(0, 10)).toBe('2026-09-05'); // 23:59 (UTC-4)
    expect(dayAtNoon(new Date('2026-09-06T04:00:00Z')).toISOString().slice(0, 10)).toBe('2026-09-06'); // 01:00 (UTC-3)
  });
  it('cambio de horario de INVIERNO (abril): la hora repetida de las 23:00 sigue siendo el día 4', () => {
    expect(dayAtNoon(new Date('2026-04-05T02:59:00Z')).toISOString().slice(0, 10)).toBe('2026-04-04'); // 23:59 (UTC-3)
    expect(dayAtNoon(new Date('2026-04-05T03:30:00Z')).toISOString().slice(0, 10)).toBe('2026-04-04'); // 23:30 repetida (UTC-4)
    expect(dayAtNoon(new Date('2026-04-05T04:00:00Z')).toISOString().slice(0, 10)).toBe('2026-04-05'); // 00:00
  });
  it('el mediodía de Chile es siempre mediodía local aunque cambie el desfase', () => {
    for (const [y, m, d] of [[2026, 1, 15], [2026, 7, 15], [2026, 9, 6], [2026, 4, 5]]) {
      expect(dayAtNoon(santiagoToUtc(y, m, d, 15)).getTime()).toBe(santiagoToUtc(y, m, d, 12).getTime());
    }
  });
});

describe('entrenamiento que cruza la medianoche', () => {
  it('iniciado a las 23:50 y finalizado a las 00:10: dura 20 minutos y las series quedan en SU día local', () => {
    const session = { startedAt: santiagoToUtc(2026, 10, 20, 23, 50), endedAt: santiagoToUtc(2026, 10, 21, 0, 10) };
    expect(buildSummary(session, []).durationSec).toBe(20 * 60);
    const antes = dayAtNoon(santiagoToUtc(2026, 10, 20, 23, 55));
    const despues = dayAtNoon(santiagoToUtc(2026, 10, 21, 0, 5));
    expect(dayOf(antes)).toBe('2026-10-20');
    expect(dayOf(despues)).toBe('2026-10-21');
  });
  it('un récord logrado después de medianoche se compara con días ANTERIORES, no con el mismo día de inicio', () => {
    const sets = [{ exerciseName: 'Press banca', reps: 5, weight: 80, weightUnit: 'kg', slot: 'A1' }];
    const previo = [{ exerciseName: 'Press banca', weight: 75, weightUnit: 'kg', date: santiagoToUtc(2026, 10, 15, 12) }];
    expect(sessionRecords(sets, previo, dayOf(santiagoToUtc(2026, 10, 20, 23, 50)), dayOf)).toHaveLength(1);
  });
});
