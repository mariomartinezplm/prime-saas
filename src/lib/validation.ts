import { DECIMAL_HELP, INVALID_NUMBER, parseDecimal } from './decimal';

// Validaciones de formularios. El servidor vuelve a validar todo: esto solo evita el viaje de ida
// y vuelta y permite señalar el campo exacto.

export const isEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

// Teléfono flexible: +56 9 1234 5678, 912345678, 65-2 123456...
export const isPhone = (value: string) => {
  const digits = value.replace(/\D/g, '');
  return /^\+?[\d\s()-]+$/.test(value.trim()) && digits.length >= 8 && digits.length <= 15;
};

// Una entrada por línea; se descartan las vacías y las repetidas
export const parseLines = (text: string): string[] => {
  const seen = new Set<string>();
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => {
      const key = line.toLowerCase();
      if (!line || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
};

export const joinLines = (list?: string[]) => (list ?? []).join('\n');

// Fecha 'yyyy-MM-dd' razonable para una fecha de nacimiento
export const birthDateError = (value: string, today: string): string | undefined => {
  if (!value) return undefined;
  if (value > today) return 'La fecha de nacimiento no puede ser futura';
  if (value < '1900-01-01') return 'Revisa la fecha de nacimiento';
  return undefined;
};

// Número opcional dentro de un rango: devuelve el mensaje de error o undefined
export const numberRangeError = (value: string, min: number, max: number, unit = ''): string | undefined => {
  const n = parseDecimal(value);
  if (n === null) return undefined;
  if (n === INVALID_NUMBER) return DECIMAL_HELP;
  if (n < min || n > max) return `Debe estar entre ${min} y ${max}${unit}`;
  return undefined;
};
