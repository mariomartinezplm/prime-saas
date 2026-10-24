/**
 * PRUEBAS — Catálogo de Objetivos PRIME (exactamente diez categorías, datos configurables, ids estables).
 */
import { describe, it, expect } from 'vitest';
import { GOAL_CATEGORIES, GOAL_CATALOG_VERSION, INDICATORS, publicCatalog, getCategory, DIRECTIONS } from '../config/goalCatalog.js';

const SOURCES = ['exercise_load', 'exercise_reps', 'measurement_perimeter', 'measurement_field', 'jump_test', 'eva', 'checkin'];

describe('catálogo de objetivos', () => {
  it('tiene exactamente diez categorías activas, con orden 1 a 10 y ids estables', () => {
    const active = GOAL_CATEGORIES.filter((c) => c.active);
    expect(active).toHaveLength(10);
    expect(active.map((c) => c.order)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    // Si alguien cambia estos ids se rompen los objetivos ya guardados: esta prueba lo impide
    expect(active.map((c) => c.id)).toEqual(['strength', 'muscle_mass', 'weight', 'body_fat', 'sport_performance', 'cardiometabolic', 'stress', 'posture', 'pain', 'mobility']);
    expect(new Set(active.map((c) => c.id)).size).toBe(10);
  });

  it('cada categoría tiene nombre, descripción, icono, supervisión e indicadores existentes', () => {
    for (const c of GOAL_CATEGORIES) {
      expect(c.name && c.description && c.icon).toBeTruthy();
      expect(['none', 'recommended', 'required']).toContain(c.supervision);
      expect(c.indicators.length).toBeGreaterThan(0);
      for (const id of c.indicators) expect(INDICATORS[id], `${c.id} → ${id}`).toBeTruthy();
    }
  });

  it('cada indicador declara fuente, unidad, rango, direcciones válidas y confirmación', () => {
    for (const ind of Object.values(INDICATORS)) {
      expect(SOURCES).toContain(ind.source);
      expect(ind.unit || ind.unitOptions?.length).toBeTruthy();
      expect(ind.range.min).toBeLessThan(ind.range.max);
      expect(ind.directions.every((d) => DIRECTIONS.includes(d))).toBe(true);
      expect(ind.directions).toContain(ind.defaultDirection);
      expect(ind.confirmation.records).toBeGreaterThanOrEqual(1);
      for (const p of ind.params) expect(p.key && p.type && p.label).toBeTruthy();
    }
  });

  it('todo indicador pertenece a alguna categoría y los ids no se repiten', () => {
    const used = GOAL_CATEGORIES.flatMap((c) => c.indicators);
    expect(new Set(used).size).toBe(used.length);
    for (const id of Object.keys(INDICATORS)) expect(used).toContain(id);
  });

  it('corazón y metabolismo es UNA categoría con varios indicadores; presión distingue sistólica y diastólica', () => {
    const cardio = getCategory('cardiometabolic');
    expect(cardio.multiIndicator).toBe(true);
    expect(cardio.indicators).toEqual(expect.arrayContaining(['blood_pressure_systolic', 'blood_pressure_diastolic', 'glucose', 'cholesterol', 'resting_heart_rate', 'weekly_activity_minutes']));
    expect(GOAL_CATEGORIES.filter((c) => c.indicators.includes('glucose'))).toHaveLength(1);
  });

  it('los indicadores clínicos no traen metas universales y el colesterol obliga a elegir la fracción', () => {
    for (const id of ['blood_pressure_systolic', 'blood_pressure_diastolic', 'glucose', 'cholesterol']) {
      expect(INDICATORS[id].clinical).toBe(true);
      expect(INDICATORS[id].professionalTarget).toBe(true);
      expect(INDICATORS[id].target).toBeUndefined();
    }
    expect(INDICATORS.cholesterol.params.find((p) => p.key === 'analyte').options.map((o) => o.value)).toEqual(['total', 'ldl', 'hdl', 'triglycerides']);
    expect(INDICATORS.glucose.params.map((p) => p.key)).toEqual(['context', 'method']);
  });

  it('el estrés es un autorreporte 0–10 propio: no se alimenta del Readiness', () => {
    expect(INDICATORS.stress_perceived).toMatchObject({ source: 'checkin', origin: 'autorreporte', range: { min: 0, max: 10 } });
    expect(INDICATORS.stress_perceived.field).toBeUndefined(); // sin enlace a otra tabla: el Readiness tiene su propia escala
  });

  it('la cintura avisa que es un indicador indirecto y el bíceps contraído está separado del relajado', () => {
    expect(INDICATORS.perimeter_waist.indirect).toBe(true);
    const fields = INDICATORS.perimeter_muscle.params[0].options.map((o) => o.value);
    expect(fields).toEqual(expect.arrayContaining(['bicepFlexedLeft', 'bicepFlexedRight', 'bicepLeft', 'bicepRight']));
  });

  it('postura, dolor y movilidad exigen validación del profesional; lo que mide el profesional solo lo ingresa él', () => {
    for (const id of ['posture', 'pain', 'mobility']) expect(getCategory(id).supervision).toBe('required');
    expect(INDICATORS.rom_degrees.professionalEntryOnly).toBe(true);
    expect(INDICATORS.posture_functional_test.professionalEntryOnly).toBe(true);
  });

  it('el catálogo público lleva versión y resuelve los indicadores', () => {
    const c = publicCatalog();
    expect(c.version).toBe(GOAL_CATALOG_VERSION);
    expect(c.maxActiveGoals).toBe(3);
    expect(c.categories).toHaveLength(10);
    expect(c.categories[0].indicators[0].id).toBe('exercise_max_load');
  });
});
