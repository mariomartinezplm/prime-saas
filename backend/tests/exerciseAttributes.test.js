/**
 * PRUEBAS — las tres dimensiones del ejercicio (modalidad · ejecución · implemento): reglas compartidas por profesional y paciente.
 */
import { describe, it, expect } from 'vitest';
import { validateAttributes, manualRecordFields, attributesOf, comparableKey } from '../services/exerciseAttributes.js';
import { validateBlockInput, buildSummary, sessionRecords, sessionImprovements, variantKey } from '../services/workoutSets.js';

const ok = (input, modality) => {
  const r = validateAttributes(input, modality);
  expect(r.error).toBeUndefined();
  return r.value;
};
const bad = (input, modality) => {
  const r = validateAttributes(input, modality);
  expect(r.error).toBeTruthy();
  return r.error;
};

describe('validateAttributes — combinaciones válidas', () => {
  it('barra + normal + kg', () => expect(ok({ implement: 'barbell', execution: 'normal' }, 'weight')).toEqual({ implement: 'barbell', execution: 'normal' }));
  it('barra + excéntrico + kg', () => expect(ok({ implement: 'barbell', execution: 'eccentric' }, 'weight')).toEqual({ implement: 'barbell', execution: 'eccentric' }));
  it('una mancuerna + normal + kg', () => expect(ok({ implement: 'one_dumbbell' }, 'weight')).toEqual({ implement: 'one_dumbbell' }));
  it('dos mancuernas + normal + kg', () => expect(ok({ implement: 'two_dumbbells', execution: 'normal' }, 'weight')).toEqual({ implement: 'two_dumbbells', execution: 'normal' }));
  it('dos mancuernas + excéntrico (3 s de fase excéntrica)', () =>
    expect(ok({ implement: 'two_dumbbells', execution: 'eccentric', eccentricSec: 3 }, 'weight')).toEqual({ implement: 'two_dumbbells', execution: 'eccentric', eccentricSec: 3 }));
  it('peso corporal + isométrico + tiempo (sin implemento)', () => expect(ok({ implement: 'none', execution: 'isometric' }, 'time')).toEqual({ implement: 'none', execution: 'isometric' }));
  it('peso externo + isométrico + duración (peso y tiempo)', () => expect(ok({ implement: 'barbell', execution: 'isometric' }, 'weight_time')).toEqual({ implement: 'barbell', execution: 'isometric' }));
  it('sin nada indicado: no inventa valores (registros antiguos)', () => expect(ok({}, 'weight')).toEqual({}));
  it('null cuenta como «sin especificar»', () => expect(ok({ execution: null, implement: null, eccentricSec: null }, 'weight')).toEqual({}));
});

describe('validateAttributes — combinaciones que no tienen sentido', () => {
  it('valores fuera de la lista', () => {
    bad({ execution: 'rapido' }, 'weight');
    bad({ implement: 'kettlebell' }, 'weight');
  });
  it('isométrico exige medirse por tiempo', () => {
    bad({ execution: 'isometric' }, 'weight');
    bad({ execution: 'isometric' }, 'bodyweight');
    bad({ execution: 'isometric' }, undefined);
  });
  it('excéntrico no va solo por tiempo', () => bad({ execution: 'eccentric' }, 'time'));
  it('los segundos de la fase excéntrica solo con excéntrico y dentro del rango', () => {
    bad({ execution: 'normal', eccentricSec: 3 }, 'weight');
    bad({ execution: 'eccentric', eccentricSec: 0 }, 'weight');
    bad({ execution: 'eccentric', eccentricSec: 31 }, 'weight');
    bad({ execution: 'eccentric', eccentricSec: 2.5 }, 'weight');
  });
  it('sin carga externa solo vale «sin implemento»', () => {
    bad({ implement: 'barbell' }, 'bodyweight');
    bad({ implement: 'two_dumbbells' }, 'time');
    expect(ok({ implement: 'none' }, 'bodyweight')).toEqual({ implement: 'none' });
  });
});

describe('bloques del entrenamiento en curso', () => {
  const block = (slots) => ({ blockId: 'bloque-123456', kind: slots.length === 1 ? 'single' : 'super', slots });
  it('guarda ejecución e implemento de cada ejercicio de una superserie', () => {
    const r = validateBlockInput(block([
      { exerciseName: 'Press de hombros', modality: 'weight', implement: 'two_dumbbells', execution: 'eccentric', eccentricSec: 3 },
      { exerciseName: 'Plancha', modality: 'time', execution: 'isometric', implement: 'none' }
    ]));
    expect(r.error).toBeUndefined();
    expect(r.slots[0]).toMatchObject({ implement: 'two_dumbbells', execution: 'eccentric', eccentricSec: 3 });
    expect(r.slots[1]).toMatchObject({ implement: 'none', execution: 'isometric' });
  });
  it('rechaza una combinación imposible', () => {
    expect(validateBlockInput(block([{ exerciseName: 'Flexiones', modality: 'bodyweight', implement: 'barbell' }])).error).toMatch(/carga externa/);
  });
  it('un bloque antiguo (sin los campos nuevos) sigue siendo válido', () => {
    expect(validateBlockInput(block([{ exerciseName: 'Sentadilla', modality: 'weight' }])).error).toBeUndefined();
  });
  it('la serie hereda del ejercicio solo lo que existe', () => {
    expect(attributesOf({ implement: 'barbell', execution: 'normal' })).toEqual({ implement: 'barbell', execution: 'normal' });
    expect(attributesOf({})).toEqual({});
  });
});

describe('registro manual (Ejercicios) — mismas reglas', () => {
  it('sin ninguno de los campos nuevos no hace nada (pantalla anterior)', () => {
    expect(manualRecordFields({ exerciseName: 'Sentadilla', sets: 3, reps: 10, weight: 50 })).toEqual({ set: {}, unset: [] });
  });
  it('dos mancuernas: la carga queda como peso de CADA mancuerna', () => {
    const r = manualRecordFields({ modality: 'weight', implement: 'two_dumbbells', execution: 'eccentric', eccentricSec: 3, reps: 10, weight: 12 });
    expect(r.error).toBeUndefined();
    expect(r.set).toMatchObject({ modality: 'weight', implement: 'two_dumbbells', execution: 'eccentric', eccentricSec: 3 });
    expect(r.set.weight).toBeUndefined(); // el peso no lo toca este módulo: sigue siendo 12, sin sumar
  });
  it('tiempo: exige duración y no admite repeticiones; guarda los minutos como siempre', () => {
    expect(manualRecordFields({ modality: 'time', reps: 10 }).error).toBeTruthy();
    expect(manualRecordFields({ modality: 'time' }).error).toMatch(/duración/);
    const r = manualRecordFields({ modality: 'time', durationSec: 90, execution: 'isometric' });
    expect(r.set).toMatchObject({ modality: 'time', durationSec: 90, duration: 1.5, execution: 'isometric' });
  });
  it('peso corporal no lleva carga; peso y tiempo la exige', () => {
    expect(manualRecordFields({ modality: 'bodyweight', reps: 10, weight: 20 }).error).toBeTruthy();
    expect(manualRecordFields({ modality: 'bodyweight', reps: 10 }).error).toBeUndefined();
    expect(manualRecordFields({ modality: 'weight_time', durationSec: 30, execution: 'isometric' }).error).toMatch(/carga/);
    expect(manualRecordFields({ modality: 'weight_time', durationSec: 30, weight: 10, execution: 'isometric', implement: 'barbell' }).error).toBeUndefined();
  });
  it('al corregir se valida contra lo que el registro ya tenía, y null borra el campo', () => {
    const existing = { modality: 'weight', implement: 'barbell', execution: 'normal', reps: 8, weight: 60 };
    expect(manualRecordFields({ execution: 'isometric' }, existing).error).toBeTruthy();
    const r = manualRecordFields({ implement: null }, existing);
    expect(r.unset).toContain('implement');
    expect(r.set.execution).toBe('normal');
  });
  it('coma y punto: el controlador recibe números ya convertidos por la pantalla (la validación no acepta texto)', () => {
    expect(manualRecordFields({ modality: 'time', durationSec: '30' }).error).toBeTruthy();
  });
});

describe('comparar solo lo equivalente (récords, mejoras, resumen)', () => {
  const day = (iso) => iso.slice(0, 10);
  const row = (extra) => ({ exerciseName: 'Press de hombros', weight: 12, weightUnit: 'kg', reps: 10, date: '2026-10-10', ...extra });

  it('«sin especificar» y «normal» sin implemento son lo mismo que siempre (clave = nombre)', () => {
    expect(variantKey(row({}))).toBe('press de hombros');
    expect(comparableKey({})).toBe('unspecified|normal');
  });
  it('barra, una mancuerna y dos mancuernas son series distintas', () => {
    const keys = ['barbell', 'one_dumbbell', 'two_dumbbells'].map((implement) => variantKey(row({ implement })));
    expect(new Set(keys).size).toBe(3);
  });
  it('un récord con dos mancuernas NO se compara con una carga anterior de barra', () => {
    const hoy = [row({ implement: 'two_dumbbells', weight: 14, date: '2026-10-21' })];
    const antes = [row({ implement: 'barbell', weight: 30, date: '2026-10-10' })];
    expect(sessionRecords(hoy, antes, '2026-10-21', day)).toEqual([]);
  });
  it('sí se compara con la misma variante', () => {
    const hoy = [row({ implement: 'two_dumbbells', weight: 14, date: '2026-10-21' })];
    const antes = [row({ implement: 'two_dumbbells', weight: 12, date: '2026-10-10' })];
    const r = sessionRecords(hoy, antes, '2026-10-21', day);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ previous: 12, current: 14, implement: 'two_dumbbells' });
  });
  it('la mejora (%) tampoco mezcla variantes', () => {
    const hoy = [row({ implement: 'two_dumbbells', weight: 14, date: '2026-10-21' })];
    const antes = [row({ implement: 'barbell', weight: 10, date: '2026-10-10' })];
    expect(sessionImprovements(hoy, antes, '2026-10-21', day).size).toBe(0);
  });
  it('el resumen de la sesión separa el mismo ejercicio hecho con dos implementos', () => {
    const session = { startedAt: new Date('2026-10-21T10:00:00Z'), endedAt: new Date('2026-10-21T11:00:00Z') };
    const sets = [
      row({ implement: 'barbell', weight: 30 }),
      row({ implement: 'two_dumbbells', weight: 12, execution: 'eccentric', eccentricSec: 3 })
    ];
    const s = buildSummary(session, sets);
    expect(s.exercises).toHaveLength(2);
    expect(s.exercises.find((e) => e.implement === 'two_dumbbells')).toMatchObject({ execution: 'eccentric', eccentricSec: 3, bestWeight: 12 });
  });
});
