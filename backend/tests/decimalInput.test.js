import { describe, it, expect } from 'vitest';
import { parseDecimal, INVALID_NUMBER, isValidDecimal, toNumber, formatDecimalInput } from '../../src/lib/decimal.ts';
import { numberRangeError } from '../../src/lib/validation.ts';

describe('decimales con coma o punto', () => {
  it('32,5 y 32.5 son el mismo valor', () => {
    expect(parseDecimal('32,5')).toBe(32.5);
    expect(parseDecimal('32.5')).toBe(32.5);
    expect(parseDecimal(' 32,5 ')).toBe(32.5);
  });

  it('enteros, valores menores a 1 y la coma final mientras se escribe', () => {
    expect(parseDecimal('36')).toBe(36);
    expect(parseDecimal('0,5')).toBe(0.5);
    expect(parseDecimal(',5')).toBe(0.5);
    expect(parseDecimal('.5')).toBe(0.5);
    expect(parseDecimal('32,')).toBe(32);
  });

  it('vacío es «sin dato», no un error', () => {
    expect(parseDecimal('')).toBeNull();
    expect(parseDecimal('   ')).toBeNull();
    expect(parseDecimal(undefined)).toBeNull();
  });

  it('rechaza lo ambiguo o inválido en vez de adivinar', () => {
    for (const bad of ['1,2,3', '12..5', '1.234,5', '1,234.5', '12a', 'a12', '--5', '-3', '1e3', ',', '.', '32,5 cm', '3 2']) {
      expect(parseDecimal(bad), bad).toBe(INVALID_NUMBER);
      expect(isValidDecimal(bad), bad).toBe(false);
    }
  });

  it('toNumber devuelve undefined si está vacío y lanza si es inválido', () => {
    expect(toNumber('')).toBeUndefined();
    expect(toNumber('34,5')).toBe(34.5);
    expect(() => toNumber('1,2,3')).toThrow();
  });

  it('se muestra con coma, como se escribe en Chile', () => {
    expect(formatDecimalInput(32.5)).toBe('32,5');
    expect(formatDecimalInput(80)).toBe('80');
    expect(formatDecimalInput(null)).toBe('');
  });

  it('la validación de rangos entiende coma y punto y señala lo mal escrito', () => {
    expect(numberRangeError('34,5', 5, 250, ' cm')).toBeUndefined();
    expect(numberRangeError('34.5', 5, 250, ' cm')).toBeUndefined();
    expect(numberRangeError('0,5', 0.1, 250)).toBeUndefined();
    expect(numberRangeError('', 5, 250)).toBeUndefined();
    expect(numberRangeError('1,2,3', 5, 250)).toMatch(/coma o punto/);
    expect(numberRangeError('900', 5, 250, ' cm')).toBe('Debe estar entre 5 y 250 cm');
  });
});
