/**
 * PRUEBAS — las tres dimensiones del ejercicio en la pantalla (src/lib/exerciseAttributes.ts + variantes en exerciseProgress.ts):
 * cómo se lee un registro, qué opciones se ofrecen y qué registros se comparan entre sí.
 */
import { describe, it, expect } from 'vitest';

const A = await import('../../src/lib/exerciseAttributes.ts');
const P = await import('../../src/lib/exerciseProgress.ts');
const S = await import('../../src/lib/workoutPlan.ts');
const backend = await import('../services/exerciseAttributes.js');

describe('las mismas reglas en pantalla y en servidor', () => {
  it('mismas listas de ejecución e implemento', () => {
    expect(A.EXECUTIONS).toEqual(backend.EXECUTIONS);
    expect(A.IMPLEMENTS).toEqual(backend.IMPLEMENTS);
    expect(A.ECCENTRIC_SEC_MAX).toBe(backend.ECCENTRIC_SEC_MAX);
  });
  it('lo que la pantalla ofrece para cada modalidad, el servidor lo acepta', () => {
    for (const m of ['weight', 'bodyweight', 'time', 'weight_time']) {
      for (const execution of A.executionOptionsFor(m)) {
        for (const implement of A.implementOptionsFor(m)) {
          expect(backend.validateAttributes({ execution, implement }, m).error, `${m}/${execution}/${implement}`).toBeUndefined();
        }
      }
    }
  });
  it('y lo que NO ofrece, el servidor lo rechaza', () => {
    expect(A.executionOptionsFor('weight')).not.toContain('isometric');
    expect(A.executionOptionsFor('time')).not.toContain('eccentric');
    expect(A.implementOptionsFor('bodyweight')).toEqual(['none']);
    expect(A.implementOptionsFor('time')).toEqual(['none']);
  });
});

describe('cómo se lee un registro (sin cifras ambiguas)', () => {
  it('dos mancuernas: «12 kg por mancuerna», nunca 24', () => {
    expect(A.loadText(12, 'two_dumbbells')).toBe('12 kg por mancuerna');
    expect(A.describeSet({ sets: 3, reps: 10, weight: 12, implement: 'two_dumbbells', execution: 'eccentric', eccentricSec: 3 })).toBe('3 series × 10 rep · 12 kg por mancuerna · Excéntrico · 3 s');
  });
  it('barra y una mancuerna; decimales con coma', () => {
    expect(A.loadText(60, 'barbell')).toBe('60 kg totales');
    expect(A.loadText(17.5, 'one_dumbbell')).toBe('17,5 kg');
    expect(A.loadText(55)).toBe('55 kg');
  });
  it('la ejecución normal no se repite; excéntrico e isométrico sí', () => {
    expect(A.executionText({ execution: 'normal' })).toBeNull();
    expect(A.executionText({})).toBeNull();
    expect(A.executionText({ execution: 'isometric' })).toBe('Isométrico');
    expect(A.attributeChips({ implement: 'barbell', execution: 'normal' })).toEqual(['Barra']);
    expect(A.attributeChips({})).toEqual([]);
  });
  it('isométrico con duración: «3 series · 30 s»', () => {
    expect(A.describeSet({ sets: 3, durationSec: 30, execution: 'isometric' })).toBe('3 series · 30 s · Isométrico');
  });
  it('el campo de carga se llama según el implemento', () => {
    expect(A.loadFieldLabel('barbell')).toBe('Peso total');
    expect(A.loadFieldLabel('one_dumbbell')).toBe('Mancuerna');
    expect(A.loadFieldLabel('two_dumbbells')).toBe('Por mancuerna');
    expect(A.loadFieldLabel(null)).toBe('Carga');
  });
});

describe('al cambiar la modalidad', () => {
  it('se descarta lo que ya no tiene sentido y se conserva lo que sirve', () => {
    expect(A.coerceAttributes('time', { execution: 'eccentric', eccentricSec: 3, implement: 'barbell' })).toMatchObject({ execution: 'isometric', eccentricSec: null, implement: 'none' });
    expect(A.coerceAttributes('weight', { execution: 'eccentric', eccentricSec: 3, implement: 'barbell' })).toMatchObject({ execution: 'eccentric', eccentricSec: 3, implement: 'barbell' });
    expect(A.coerceAttributes('bodyweight', { implement: 'two_dumbbells' }).implement).toBe('none');
    expect(A.coerceAttributes('weight', {})).toEqual({});
  });
  it('en el plan del entrenamiento: cambiar la modalidad ajusta ejecución e implemento', () => {
    const slot = { name: 'Press', modality: 'weight', execution: 'eccentric', eccentricSec: 3, implement: 'two_dumbbells', groups: [] };
    const out = S.changeModality(slot, 'time');
    expect(out).toMatchObject({ modality: 'time', execution: 'isometric', implement: 'none' });
  });
});

describe('plan del entrenamiento: lo que se envía y lo que cambia la firma', () => {
  it('slotDefOf manda solo lo elegido', () => {
    expect(S.slotDefOf({ name: 'Press', modality: 'weight', groups: [] })).toEqual({ exerciseName: 'Press', modality: 'weight' });
    expect(S.slotDefOf({ name: 'Press', modality: 'weight', execution: 'eccentric', eccentricSec: 3, implement: 'two_dumbbells', groups: [] })).toEqual({ exerciseName: 'Press', modality: 'weight', execution: 'eccentric', eccentricSec: 3, implement: 'two_dumbbells' });
    // los segundos excéntricos no viajan si la ejecución ya no es excéntrica
    expect(S.slotDefOf({ name: 'Press', modality: 'weight', execution: 'normal', eccentricSec: 3, groups: [] })).toEqual({ exerciseName: 'Press', modality: 'weight', execution: 'normal' });
  });
  it('cambiar el implemento cuenta como un cambio sin guardar', () => {
    const base = { blockId: 'b1', kind: 'single', savedSig: null, slots: [{ name: 'Press', modality: 'weight', groups: [{ id: 'g', sets: 3, reps: 10, weight: 12, durationSec: null }] }] };
    const withImpl = { ...base, slots: [{ ...base.slots[0], implement: 'two_dumbbells' }] };
    expect(S.blockSignature(base)).not.toBe(S.blockSignature(withImpl));
  });
  it('un bloque que viene del servidor conserva implemento y ejecución', () => {
    const block = { blockId: 'b1', kind: 'single', label: 'A', slots: [{ slot: 'A1', exerciseName: 'Press', modality: 'weight', implement: 'barbell', execution: 'eccentric', eccentricSec: 3 }] };
    const draft = S.draftFromServer(block, []);
    expect(draft.slots[0]).toMatchObject({ implement: 'barbell', execution: 'eccentric', eccentricSec: 3 });
  });
  it('el texto de un cuadro usa el implemento: «3 series · 10 rep · 12 kg por mancuerna»', () => {
    expect(S.groupText('weight', { id: 'g', sets: 3, reps: 10, weight: 12, durationSec: null }, 'two_dumbbells')).toBe('3 series · 10 rep · 12 kg por mancuerna');
  });
});

describe('gráficos: solo comparaciones compatibles', () => {
  const rec = (id, date, extra) => ({ _id: id, exerciseName: 'Press de hombros', date: `${date}T12:00:00.000Z`, sets: 3, reps: 10, weight: 12, weightUnit: 'kg', modality: 'weight', ...extra });
  const records = [
    rec('1', '2026-10-01', { implement: 'barbell', weight: 30 }),
    rec('2', '2026-10-08', { implement: 'two_dumbbells', weight: 12 }),
    rec('3', '2026-10-15', { implement: 'one_dumbbell', weight: 14 }),
    rec('4', '2026-10-22', { implement: 'two_dumbbells', weight: 14 }),
    rec('5', '2026-09-01', { weight: 25 }), // registro antiguo, sin implemento
  ];
  it('separa barra, una mancuerna, dos mancuernas y «sin especificar»', () => {
    const v = P.variantsOf(records);
    expect(v.map((x) => x.key).sort()).toEqual(['barbell|normal', 'one_dumbbell|normal', 'two_dumbbells|normal', 'unspecified|normal']);
    expect(v[0].key).toBe('two_dumbbells|normal'); // la más reciente va primero
    expect(v.find((x) => x.key === 'two_dumbbells|normal').count).toBe(2);
    expect(v.find((x) => x.key === 'unspecified|normal').label).toBe('Sin especificar');
  });
  it('el gráfico de una variante no incluye cargas de otra', () => {
    const two = P.inVariant(records, 'two_dumbbells|normal');
    expect(two).toHaveLength(2);
    const pts = P.progressPoints(two, 'load');
    expect(pts.map((p) => p.value)).toEqual([12, 14]);
  });
  it('los registros antiguos siguen visibles (su propia variante)', () => {
    expect(P.inVariant(records, 'unspecified|normal').map((r) => r._id)).toEqual(['5']);
  });
  it('misma carga con implemento distinto NO se mezcla en «repeticiones con la misma carga»', () => {
    const rows = [rec('a', '2026-10-01', { implement: 'barbell', weight: 14, reps: 5 }), rec('b', '2026-10-08', { implement: 'two_dumbbells', weight: 14, reps: 12 })];
    const barbell = P.inVariant(rows, 'barbell|normal');
    expect(P.repsAtLoadPoints(barbell, 14).map((p) => p.value)).toEqual([5]);
  });
  it('excéntrico y normal son variantes distintas del mismo implemento', () => {
    const rows = [rec('a', '2026-10-01', { implement: 'barbell', execution: 'normal' }), rec('b', '2026-10-08', { implement: 'barbell', execution: 'eccentric' })];
    expect(P.variantsOf(rows).map((v) => v.key).sort()).toEqual(['barbell|eccentric', 'barbell|normal']);
    expect(P.attributeKeyLabel ?? true).toBeTruthy();
  });
  it('el historial de series muestra «c/u» con dos mancuernas', () => {
    const h = P.sessionHistory(P.inVariant(records, 'two_dumbbells|normal'));
    expect(P.setLabel(h[0].sets[0])).toBe('10 × 14 kg c/u');
  });
  it('peso y tiempo: se muestra la duración con la carga', () => {
    expect(P.setLabel({ reps: null, weight: 10, unit: 'kg', seconds: 30, implement: 'barbell' })).toBe('30 s · 10 kg');
  });
});
