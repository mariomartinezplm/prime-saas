/**
 * PRUEBAS — movimiento del dashboard (Fase 2A.2): presencia de filas de «Para hoy», avisos y barras.
 * Solo la lógica pura (src/components/dashboard/rowPresence.ts y meterMath.ts); la parte visual se midió en un navegador real.
 */
import { describe, it, expect, vi } from 'vitest';

import {
  keyOfAction, toRows, reconcileRows, settleRow, settleAll, announceChange
} from '../../src/components/dashboard/rowPresence.ts';
import { meterPercent, shouldAnimateMeter } from '../../src/components/dashboard/meterMath.ts';
import { setWelcomeCovering, isWelcomeCovering, subscribeWelcomeCovering } from '../../src/lib/welcomeSplash.ts';

const act = (id, title = id) => ({ id, title });
const rows = (...ids) => toRows(ids.map((id) => act(id)), keyOfAction);
const keys = (list) => list.map((r) => r.key);
const phases = (list) => Object.fromEntries(list.map((r) => [r.key, r.phase]));
const opts = (over = {}) => ({ keyOf: keyOfAction, animate: true, enter: 'height', ...over });
const live = (list) => list.filter((r) => r.phase !== 'leaving');

describe('claves de las filas', () => {
  it('la sesión de hoy y la sesión en curso son la misma fila; el resto, cada una la suya', () => {
    expect(keyOfAction({ id: 'session-today' })).toBe('session');
    expect(keyOfAction({ id: 'session-live' })).toBe('session');
    expect(keyOfAction({ id: 'readiness' })).toBe('readiness');
    expect(keyOfAction({ id: 'plan-expired' })).toBe('plan-expired');
  });

  it('nunca hay dos filas con la misma clave', () => {
    expect(keys(toRows([act('session-today'), act('session-live'), act('readiness')], keyOfAction))).toEqual(['session', 'readiness']);
  });
});

describe('una fila que deja de corresponder', () => {
  it('sigue dibujada «saliendo», en su lugar, y las demás se conservan', () => {
    const next = reconcileRows(rows('session-today', 'readiness', 'book-next'), [act('session-today'), act('book-next')], opts());
    expect(keys(next)).toEqual(['session', 'readiness', 'book-next']);
    expect(phases(next)).toEqual({ session: 'present', readiness: 'leaving', 'book-next': 'present' });
  });

  it('si estaba primera, sale primera; si no había ninguna anterior se conserva al principio', () => {
    const next = reconcileRows(rows('plan-expired', 'readiness'), [act('readiness')], opts());
    expect(keys(next)).toEqual(['plan-expired', 'readiness']);
    expect(next[0].phase).toBe('leaving');
  });

  it('con movimiento reducido desaparece al instante (sin filas «saliendo»)', () => {
    const next = reconcileRows(rows('session-today', 'readiness'), [act('session-today')], opts({ animate: false }));
    expect(keys(next)).toEqual(['session']);
    expect(phases(next)).toEqual({ session: 'present' });
  });

  it('al terminar su transición se elimina; sin nada que cambiar devuelve la MISMA lista', () => {
    const next = reconcileRows(rows('a', 'b'), [act('a')], opts());
    expect(keys(settleRow(next, 'b'))).toEqual(['a']);
    const quieta = rows('a', 'b');
    expect(settleRow(quieta, 'a')).toBe(quieta);
    expect(settleAll(quieta)).toBe(quieta);
    expect(keys(settleAll(next))).toEqual(['a']);
    expect(settleRow(next, 'no-existe')).toBe(next);
  });

  it('varias salidas seguidas conservan su orden relativo', () => {
    const next = reconcileRows(rows('a', 'b', 'c', 'd'), [act('a'), act('d')], opts());
    expect(keys(next)).toEqual(['a', 'b', 'c', 'd']);
    expect(phases(next)).toEqual({ a: 'present', b: 'leaving', c: 'leaving', d: 'present' });
  });
});

describe('una fila nueva', () => {
  it('entra desplegando su alto, o solo con fundido si reemplaza a un esqueleto, o sin animar en la primera presentación', () => {
    expect(phases(reconcileRows(rows('a'), [act('a'), act('b')], opts({ enter: 'height' })))).toEqual({ a: 'present', b: 'enter' });
    expect(phases(reconcileRows(rows('a'), [act('a'), act('b')], opts({ enter: 'fade' })))).toEqual({ a: 'present', b: 'enter-fade' });
    expect(phases(reconcileRows([], [act('a'), act('b')], opts({ enter: 'none' })))).toEqual({ a: 'present', b: 'present' });
  });

  it('sin animación (movimiento reducido) entra como fila normal', () => {
    expect(phases(reconcileRows(rows('a'), [act('a'), act('b')], opts({ animate: false })))).toEqual({ a: 'present', b: 'present' });
  });

  it('el paso de «sesión de hoy» a «sesión en curso» actualiza la misma fila: no sale ni entra nada', () => {
    const prev = rows('session-today', 'readiness');
    const next = reconcileRows(prev, [act('session-live'), act('readiness')], opts());
    expect(keys(next)).toEqual(['session', 'readiness']);
    expect(phases(next)).toEqual({ session: 'present', readiness: 'present' });
  });
});

describe('cambios seguidos y estados rezagados', () => {
  it('una fila que estaba saliendo y vuelve a corresponder deja de salir (nunca queda una fila fantasma)', () => {
    const saliendo = reconcileRows(rows('a', 'b'), [act('a')], opts());
    expect(phases(saliendo).b).toBe('leaving');
    const revivida = reconcileRows(saliendo, [act('a'), act('b')], opts());
    expect(keys(revivida)).toEqual(['a', 'b']);
    expect(phases(revivida)).toEqual({ a: 'present', b: 'present' });
  });

  it('una fila que sigue saliendo mientras llega otro cambio, sigue saliendo (no se duplica ni se pierde)', () => {
    const paso1 = reconcileRows(rows('a', 'b', 'c'), [act('a'), act('c')], opts());
    const paso2 = reconcileRows(paso1, [act('a'), act('c'), act('d')], opts());
    expect(keys(paso2)).toEqual(['a', 'b', 'c', 'd']);
    expect(phases(paso2)).toEqual({ a: 'present', b: 'leaving', c: 'present', d: 'enter' });
  });

  it('el orden de prioridad nuevo manda sobre el anterior', () => {
    const next = reconcileRows(rows('a', 'b', 'c'), [act('c'), act('a'), act('b')], opts());
    expect(keys(live(next))).toEqual(['c', 'a', 'b']);
  });

  it('al azar: tras cualquier secuencia de cambios, y una vez terminadas las transiciones, la lista es exactamente la correcta', () => {
    let seed = 12345;
    const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };
    const universe = ['plan-expired', 'session-today', 'readiness', 'plan-used-up', 'book-next'];
    for (let ronda = 0; ronda < 400; ronda += 1) {
      let rowsNow = [];
      let ultimo = [];
      for (let paso = 0; paso < 8; paso += 1) {
        const elegidas = universe.filter(() => random() < 0.5).sort(() => random() - 0.5).slice(0, 3);
        const items = elegidas.map((id) => act(id));
        rowsNow = reconcileRows(rowsNow, items, opts({ animate: random() < 0.8, enter: ['height', 'fade', 'none'][Math.floor(random() * 3)] }));
        ultimo = items;
        // en cada paso: sin claves repetidas, y lo vivo coincide con lo que corresponde
        expect(new Set(keys(rowsNow)).size).toBe(rowsNow.length);
        expect(keys(live(rowsNow))).toEqual(ultimo.map(keyOfAction));
        // a veces terminan las transiciones, a veces llega otro cambio antes
        if (random() < 0.4) rowsNow = settleAll(rowsNow);
      }
      const final = settleAll(rowsNow);
      expect(keys(final)).toEqual(ultimo.map(keyOfAction));
      expect(final.every((r) => r.phase === 'present')).toBe(true);
    }
  });
});

describe('avisos para lectores de pantalla', () => {
  const info = (...pairs) => Object.fromEntries(pairs.map(([id, title]) => [id.startsWith('session-') ? 'session' : id, { id, title }]));
  const call = (prev, next) => announceChange({
    prevKeys: Object.keys(prev), nextKeys: Object.keys(next), prev, next
  });

  it('si no cambió nada, no dice nada', () => {
    const a = info(['readiness', 'Completa tu Readiness'], ['book-next', 'Reserva']);
    expect(call(a, a)).toBeNull();
  });

  it('NO repite lo que el Readiness ya anuncia: solo desapareció su fila y quedan otras tareas', () => {
    expect(call(info(['session-today', 'Hoy tienes sesión'], ['readiness', 'Completa tu Readiness']), info(['session-today', 'Hoy tienes sesión']))).toBeNull();
  });

  it('si la lista queda vacía, lo dice (aunque haya sido por el Readiness)', () => {
    expect(call(info(['readiness', 'Completa tu Readiness']), {})).toBe('No tienes tareas pendientes por hoy.');
    expect(call(info(['book-next', 'Reserva tu próxima sesión']), {})).toBe('No tienes tareas pendientes por hoy.');
  });

  it('si la misma fila cambia de estado (la sesión empezó), lo dice', () => {
    const texto = call(info(['session-today', 'Hoy tienes sesión a las 10:00']), info(['session-live', 'Tu sesión está en curso']));
    expect(texto).toContain('Tu sesión está en curso');
  });

  it('si aparece o desaparece otra tarea, lo dice con las tareas de ahora', () => {
    const texto = call(info(['readiness', 'Completa tu Readiness'], ['book-next', 'Reserva']), info(['readiness', 'Completa tu Readiness']));
    expect(texto).toBe('Se actualizó «Para hoy». Ahora: Completa tu Readiness.');
  });
});

describe('barras de progreso', () => {
  it('el valor visual siempre queda entre 0 y 100 y es real', () => {
    expect(meterPercent(0)).toEqual({ valid: true, pct: 0 });
    expect(meterPercent(0.75)).toEqual({ valid: true, pct: 75 });
    expect(meterPercent(1)).toEqual({ valid: true, pct: 100 });
    expect(meterPercent(1.4)).toEqual({ valid: true, pct: 100 });
    expect(meterPercent(-0.3)).toEqual({ valid: true, pct: 0 });
  });

  it('un valor ausente o inválido no inventa un número', () => {
    for (const malo of [Number.NaN, Infinity, -Infinity, undefined, null, '0.5']) {
      expect(meterPercent(malo), String(malo)).toEqual({ valid: false, pct: 0 });
    }
  });

  it('anima solo con un valor válido y mayor que cero, con clave, y la primera vez', () => {
    const vistas = new Set();
    expect(shouldAnimateMeter(0.5, 'plan', vistas)).toBe(true);
    expect(shouldAnimateMeter(0, 'plan', vistas)).toBe(false); // el cero se representa vacío, sin animación
    expect(shouldAnimateMeter(Number.NaN, 'plan', vistas)).toBe(false);
    expect(shouldAnimateMeter(0.5, undefined, vistas)).toBe(false);
    vistas.add('plan');
    expect(shouldAnimateMeter(0.5, 'plan', vistas)).toBe(false); // ya se mostró en esta carga
    expect(shouldAnimateMeter(0.5, 'next:otro-logro', vistas)).toBe(true); // otro contenido sí
  });
});

describe('aviso «el logo de bienvenida tapa la pantalla» (las barras esperan a que termine)', () => {
  it('empieza sin tapar, avisa solo cuando cambia y deja de avisar a quien se desuscribe', () => {
    expect(isWelcomeCovering()).toBe(false);
    const oyente = vi.fn();
    const baja = subscribeWelcomeCovering(oyente);
    setWelcomeCovering(true);
    setWelcomeCovering(true); // mismo valor: no se vuelve a avisar
    expect(isWelcomeCovering()).toBe(true);
    expect(oyente).toHaveBeenCalledTimes(1);
    setWelcomeCovering(false);
    expect(oyente).toHaveBeenCalledTimes(2);
    baja();
    setWelcomeCovering(true);
    expect(oyente).toHaveBeenCalledTimes(2);
    setWelcomeCovering(false);
  });
});
