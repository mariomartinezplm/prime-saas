/**
 * PRUEBAS — lista de ejercicios ya registrados en el formulario (src/lib/exercisePicker.ts): filtrar, reconocer y describir.
 */
import { describe, it, expect } from 'vitest';

const { filterExercises, exactExercise, lastRecordText } = await import('../../src/lib/exercisePicker.ts');

const ex = (name, over = {}) => ({ key: name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(), name, category: 'fuerza', count: 3, lastDate: '2026-10-12T12:00:00.000Z', last: { sets: 3, reps: 8, weight: 60, weightUnit: 'kg', rpe: 7 }, ...over });
const options = [ex('Sentadilla búlgara'), ex('Press banca'), ex('Sentadilla trasera'), ex('Peso muerto')];

describe('filtrar la lista mientras se escribe', () => {
  it('sin texto ofrece todos, en el orden recibido (el más reciente primero)', () => {
    expect(filterExercises(options, '').map((o) => o.name)).toEqual(['Sentadilla búlgara', 'Press banca', 'Sentadilla trasera', 'Peso muerto']);
    expect(filterExercises(options, '   ').length).toBe(4);
  });
  it('encuentra sin importar mayúsculas ni tildes, y las palabras pueden ir en cualquier orden', () => {
    expect(filterExercises(options, 'BULGARA').map((o) => o.name)).toEqual(['Sentadilla búlgara']);
    expect(filterExercises(options, 'banca press').map((o) => o.name)).toEqual(['Press banca']);
    expect(filterExercises(options, 'sent').map((o) => o.name)).toEqual(['Sentadilla búlgara', 'Sentadilla trasera']);
    // Varias palabras: tienen que estar TODAS (no se mezclan ejercicios parecidos)
    expect(filterExercises(options, 'sentadilla trasera').map((o) => o.name)).toEqual(['Sentadilla trasera']);
  });
  it('lo que empieza igual que lo escrito va primero', () => {
    const list = [ex('Prensa de piernas'), ex('Press banca'), ex('Banca press militar')];
    expect(filterExercises(list, 'press')[0].name).toBe('Press banca');
  });
  it('si no hay coincidencia, la lista queda vacía (es un ejercicio nuevo)', () => {
    expect(filterExercises(options, 'remo con barra')).toEqual([]);
  });
  it('respeta el máximo', () => {
    const many = Array.from({ length: 50 }, (_, i) => ex(`Ejercicio ${i}`));
    expect(filterExercises(many, '').length).toBe(30);
    expect(filterExercises(many, 'ejercicio', 5).length).toBe(5);
  });
});

describe('reconocer el ejercicio escrito', () => {
  it('es el mismo ejercicio aunque cambien mayúsculas, tildes o espacios; nunca uno parecido', () => {
    expect(exactExercise(options, ' PRESS   banca ')?.name).toBe('Press banca');
    expect(exactExercise(options, 'sentadilla bulgara')?.name).toBe('Sentadilla búlgara');
    expect(exactExercise(options, 'sentadilla')).toBeUndefined();
    expect(exactExercise(options, '')).toBeUndefined();
  });
});

describe('«lo último que se anotó»', () => {
  it('escribe peso, series y repeticiones con la fecha, en palabras simples', () => {
    expect(lastRecordText(ex('x'))).toBe('60 kg · 3 series × 8 repeticiones · 12 oct');
    expect(lastRecordText(ex('x', { last: { sets: 1, reps: 1, weight: 22.5, weightUnit: 'kg', rpe: null } }))).toBe('22,5 kg · 1 serie × 1 repetición · 12 oct');
  });
  it('solo dice lo que de verdad se anotó: nunca inventa un peso', () => {
    expect(lastRecordText(ex('x', { last: { sets: null, reps: 20, weight: null, weightUnit: 'kg', rpe: null } }))).toBe('20 repeticiones · 12 oct');
    expect(lastRecordText(ex('x', { last: { sets: null, reps: null, weight: null, weightUnit: 'kg', rpe: null } }))).toBe('12 oct');
    expect(lastRecordText(ex('x', { last: { sets: 3, reps: 10, weight: 100, weightUnit: 'lbs', rpe: null } }))).toBe('100 lbs · 3 series × 10 repeticiones · 12 oct');
  });
});
