/**
 * PRUEBAS — bandas elásticas como implemento: Power Band (roja, negra, morada, verde, azul) y Mini Band (X Light, Light, Medium, Heavy).
 * La banda reemplaza al peso en kg: se mide por repeticiones o por tiempo, y cada color/nivel es su propia variante (no se mezclan).
 */
import { describe, it, expect } from 'vitest';
import { validateAttributes, manualRecordFields, comparableKey, BANDS, POWER_BANDS, MINI_BANDS, IMPLEMENTS } from '../services/exerciseAttributes.js';
import { validateBlockInput, variantKey } from '../services/workoutSets.js';

const A = await import('../../src/lib/exerciseAttributes.ts');
const W = await import('../../src/lib/workoutPlan.ts');

describe('las bandas que existen', () => {
  it('Power Band: roja, negra, morada, verde y azul (de más liviana a más pesada)', () => {
    expect(POWER_BANDS).toEqual(['power_red', 'power_black', 'power_purple', 'power_green', 'power_blue']);
  });
  it('Mini Band: X Light, Light, Medium y Heavy', () => {
    expect(MINI_BANDS).toEqual(['mini_xlight', 'mini_light', 'mini_medium', 'mini_heavy']);
  });
  it('siguen existiendo barra, mancuernas y sin implemento', () => {
    ['barbell', 'one_dumbbell', 'two_dumbbells', 'none'].forEach((i) => expect(IMPLEMENTS).toContain(i));
    expect(IMPLEMENTS).toHaveLength(4 + BANDS.length);
  });
  it('pantalla y servidor usan las mismas listas', () => {
    expect(A.IMPLEMENTS).toEqual(IMPLEMENTS);
    expect(A.POWER_BANDS).toEqual(POWER_BANDS);
    expect(A.MINI_BANDS).toEqual(MINI_BANDS);
  });
  it('todas tienen nombre en español', () => {
    BANDS.forEach((b) => expect(A.IMPLEMENT_LABEL[b]).toMatch(/Band/));
    expect(A.IMPLEMENT_LABEL.power_purple).toBe('Power Band morada');
    expect(A.IMPLEMENT_LABEL.mini_xlight).toBe('Mini Band X Light');
  });
});

describe('validación: la banda no lleva kg', () => {
  it.each(BANDS)('%s vale con peso corporal o con tiempo', (b) => {
    expect(validateAttributes({ implement: b }, 'bodyweight').value).toEqual({ implement: b });
    expect(validateAttributes({ implement: b }, 'time').value).toEqual({ implement: b });
  });
  it.each(BANDS)('%s NO vale con carga en kg', (b) => {
    expect(validateAttributes({ implement: b }, 'weight').error).toMatch(/banda/i);
    expect(validateAttributes({ implement: b }, 'weight_time').error).toMatch(/banda/i);
  });
  it('banda + excéntrico en repeticiones; banda + isométrico en tiempo', () => {
    expect(validateAttributes({ implement: 'power_green', execution: 'eccentric', eccentricSec: 3 }, 'bodyweight').error).toBeUndefined();
    expect(validateAttributes({ implement: 'mini_heavy', execution: 'isometric' }, 'time').error).toBeUndefined();
  });
  it('una banda inventada se rechaza', () => {
    expect(validateAttributes({ implement: 'power_yellow' }, 'bodyweight').error).toBeTruthy();
  });
  it('barra con peso corporal sigue rechazado', () => {
    expect(validateAttributes({ implement: 'barbell' }, 'bodyweight').error).toBeTruthy();
  });
});

describe('registro manual con banda', () => {
  it('se guarda con modalidad peso corporal', () => {
    const r = manualRecordFields({ modality: 'bodyweight', implement: 'power_black', reps: 12 });
    expect(r.error).toBeUndefined();
    expect(r.set).toMatchObject({ modality: 'bodyweight', implement: 'power_black' });
  });
  it('con kg y banda a la vez se rechaza', () => {
    expect(manualRecordFields({ modality: 'weight', implement: 'power_black', weight: 10, reps: 8 }).error).toBeTruthy();
  });
});

describe('entrenamiento con banda', () => {
  const block = (slots) => ({ blockId: 'block-aaaaaaaa', kind: 'single', slots });
  it('un ejercicio de peso corporal con Mini Band se acepta y guarda el implemento', () => {
    const r = validateBlockInput(block([{ exerciseName: 'Puente de glúteo', modality: 'bodyweight', implement: 'mini_medium' }]));
    expect(r.error).toBeUndefined();
    expect(r.slots[0]).toMatchObject({ implement: 'mini_medium', modality: 'bodyweight' });
  });
  it('con kg y banda se rechaza', () => {
    expect(validateBlockInput(block([{ exerciseName: 'Remo', modality: 'weight', implement: 'power_red' }])).error).toBeTruthy();
  });
});

describe('cada banda es su propia variante', () => {
  it('roja y negra no se comparan entre sí', () => {
    expect(comparableKey({ implement: 'power_red' })).not.toBe(comparableKey({ implement: 'power_black' }));
    expect(variantKey({ exerciseName: 'Remo con banda', implement: 'power_red' })).not.toBe(variantKey({ exerciseName: 'Remo con banda', implement: 'power_black' }));
  });
  it('Mini Light y Power roja tampoco', () => {
    expect(comparableKey({ implement: 'mini_light' })).not.toBe(comparableKey({ implement: 'power_red' }));
  });
});

describe('en pantalla', () => {
  it('con carga en kg se ofrecen barra y mancuernas; sin kg, sin implemento y todas las bandas', () => {
    expect(A.implementOptionsFor('weight')).toEqual(['barbell', 'one_dumbbell', 'two_dumbbells', 'none']);
    expect(A.implementOptionsFor('bodyweight')).toEqual(['none', ...BANDS]);
    expect(A.implementOptionsFor('time')).toEqual(['none', ...BANDS]);
  });
  it('elegir una banda estando en «con peso» pasa a peso corporal; en «peso y tiempo», a tiempo', () => {
    expect(A.modalityForBand('weight')).toBe('bodyweight');
    expect(A.modalityForBand('weight_time')).toBe('time');
    expect(A.modalityForBand('bodyweight')).toBe('bodyweight');
  });
  it('volver a «con peso» descarta la banda', () => {
    expect(A.coerceAttributes('weight', { implement: 'power_blue' }).implement).toBe('none');
  });
  it('la banda se muestra en el texto de la serie y del cuadro', () => {
    expect(A.describeSet({ sets: 3, reps: 12, implement: 'power_green' })).toBe('3 series × 12 rep · Power Band verde');
    expect(W.groupText('bodyweight', { id: 'g', sets: 3, reps: 15, weight: null, durationSec: null }, 'mini_heavy')).toBe('3 series · 15 rep · Mini Band Heavy');
  });
  it('banda como pieza del registro y como variante', () => {
    expect(A.attributeChips({ implement: 'power_red', execution: 'normal' })).toEqual(['Power Band roja']);
    expect(A.attributeKeyLabel('mini_xlight|normal')).toBe('Mini Band X Light');
  });
});
