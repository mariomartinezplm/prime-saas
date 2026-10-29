/**
 * PRUEBAS — resumen al terminar el entrenamiento: series por ejercicio, % de mejora frente a la última vez y felicitación del mes.
 */
import { describe, it, expect } from 'vitest';
import { buildSummary, sessionImprovements } from '../services/workoutSets.js';
import { dayOf } from '../services/achievements/dates.js';

const { monthCongrats, improvementText, setLine } = await import('../../src/lib/sessionCongrats.ts');

const day = (d) => new Date(`${d}T12:00:00.000Z`);
const set = (over) => ({ exerciseName: 'Sentadilla', reps: 8, weight: 60, weightUnit: 'kg', ...over });
const prev = (d, over) => ({ ...set(over), date: day(d) });
const run = (sets, previous) => sessionImprovements(sets, previous, '2026-10-29', dayOf);

describe('detalle de series por ejercicio', () => {
  it('cada ejercicio trae sus series con repeticiones y carga reales', () => {
    const session = { startedAt: new Date('2026-10-29T12:00:00Z'), endedAt: new Date('2026-10-29T13:00:00Z') };
    const s = buildSummary(session, [set({ reps: 8 }), set({ reps: 6, weight: 55 }), { exerciseName: 'Plancha', durationSec: 30, modality: 'time' }]);
    expect(s.exercises[0].setList).toEqual([{ reps: 8, weight: 60, unit: 'kg', durationSec: null }, { reps: 6, weight: 55, unit: 'kg', durationSec: null }]);
    expect(s.exercises[1].setList).toEqual([{ reps: null, weight: null, unit: null, durationSec: 30 }]);
  });
});

describe('mejora frente a la última vez', () => {
  it('compara la mejor carga con la ÚLTIMA vez (el día anterior más reciente), no con la mejor de la historia', () => {
    const map = run([set({ weight: 66 })], [prev('2026-10-20', { weight: 80 }), prev('2026-10-25', { weight: 60 }), prev('2026-10-25', { weight: 55 })]);
    expect(map.get('sentadilla')).toMatchObject({ kind: 'weight', previous: 60, current: 66, pct: 10, unit: 'kg' });
  });

  it('sin carga, compara la mejor serie en repeticiones (no el total); sin repeticiones, el tiempo', () => {
    const reps = run([set({ exerciseName: 'Flexiones', weight: undefined, reps: 12 }), set({ exerciseName: 'Flexiones', weight: undefined, reps: 12 })], [prev('2026-10-25', { exerciseName: 'Flexiones', weight: undefined, reps: 10 }), prev('2026-10-25', { exerciseName: 'Flexiones', weight: undefined, reps: 10 })]);
    expect(reps.get('flexiones')).toMatchObject({ kind: 'reps', previous: 10, current: 12, pct: 20 });
    const time = run([{ exerciseName: 'Plancha', durationSec: 45 }], [{ exerciseName: 'Plancha', durationSec: 30, date: day('2026-10-25') }]);
    expect(time.get('plancha')).toMatchObject({ kind: 'time', pct: 50 });
  });

  it('más series no se cuentan como mejora: 3 series de 12 contra un registro clásico de 10 repeticiones son +20 %', () => {
    const f = { exerciseName: 'Flexiones', weight: undefined };
    const map = run([set({ ...f, reps: 12 }), set({ ...f, reps: 12 }), set({ ...f, reps: 12 })], [prev('2026-10-25', { ...f, reps: 10, sets: 3 })]);
    expect(map.get('flexiones')).toMatchObject({ kind: 'reps', pct: 20 });
  });

  it('solo informa mejoras reales: igual o menos no aparece, y nunca compara kg con libras', () => {
    expect(run([set({ weight: 60 })], [prev('2026-10-25', { weight: 60 })]).size).toBe(0);
    expect(run([set({ weight: 50 })], [prev('2026-10-25', { weight: 60 })]).size).toBe(0);
    expect(run([set({ weight: 100, weightUnit: 'lbs' })], [prev('2026-10-25', { weight: 40, weightUnit: 'kg' })]).size).toBe(0);
  });

  it('sin una vez anterior (o solo de hoy) no hay mejora que inventar', () => {
    expect(run([set()], []).size).toBe(0);
    expect(run([set({ weight: 70 })], [prev('2026-10-29', { weight: 40 })]).size).toBe(0);
  });

  it('no mezcla ejercicios distintos aunque se parezcan', () => {
    expect(run([set({ exerciseName: 'Sentadilla búlgara', weight: 30 })], [prev('2026-10-25', { exerciseName: 'Sentadilla', weight: 20 })]).size).toBe(0);
  });
});

describe('felicitación del mes', () => {
  const oct = new Date('2026-10-29T15:00:00Z');
  it('cuenta la sesión del mes con el nombre del mes y anima a seguir', () => {
    const c = monthCongrats(5, 8, false, oct, 3);
    expect(c.title).toBe('¡Esta es tu 5.ª sesión de octubre!');
    expect(c.body).toBe('Felicidades, sigue así: te faltan 3 sesiones para tu meta del mes.');
  });
  it('la primera sesión, la meta cumplida y sin meta', () => {
    expect(monthCongrats(1, 8, false, oct, 7).title).toBe('¡Primera sesión de octubre!');
    expect(monthCongrats(8, 8, true, oct, 0).body).toBe('Cumpliste tu meta del mes. Felicidades, sigue así.');
    expect(monthCongrats(3, null, false, oct, null).body).toBe('Felicidades, sigue así.');
    expect(monthCongrats(0, null, false, oct)).toBeNull();
  });
  it('textos de mejora y de series', () => {
    expect(improvementText({ kind: 'weight', previous: 60, current: 66, pct: 10, unit: 'kg' })).toBe('+10 % de carga (60 → 66 kg)');
    expect(setLine({ reps: 8, weight: 62.5, unit: 'kg', durationSec: null })).toBe('8 × 62,5 kg');
  });
});
