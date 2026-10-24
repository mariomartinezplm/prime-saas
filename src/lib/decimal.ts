// Números decimales escritos por personas: se acepta coma o punto (teclados de teléfono con coma decimal, como en Chile) y se guarda
// un número normalizado. No se interpreta a ciegas lo ambiguo: «1,2,3», «12..5», «1.234,5» o letras mezcladas son inválidos.

export const INVALID_NUMBER = Symbol('invalid-number');

// ej. 32  32,5  32.5  ,5  .5  32,  (la coma final se tolera mientras la persona escribe)
const DECIMAL = /^(\d+)?(?:[.,](\d+)?)?$/;

// '' → null (vacío); texto válido → número; cualquier otra cosa → INVALID_NUMBER
export function parseDecimal(raw: string | null | undefined): number | null | typeof INVALID_NUMBER {
  const text = (raw ?? '').trim();
  if (text === '') return null;
  const match = DECIMAL.exec(text);
  if (!match || (match[1] === undefined && match[2] === undefined)) return INVALID_NUMBER;
  const n = Number(`${match[1] ?? '0'}.${match[2] ?? '0'}`);
  return Number.isFinite(n) ? n : INVALID_NUMBER;
}

export const isValidDecimal = (raw: string) => parseDecimal(raw) !== INVALID_NUMBER;

// Para enviar al servidor: número, o undefined si está vacío. Lanza si es inválido (la validación del formulario debe haberlo atajado antes).
export function toNumber(raw: string): number | undefined {
  const parsed = parseDecimal(raw);
  if (parsed === INVALID_NUMBER) throw new Error('Número inválido');
  return parsed ?? undefined;
}

// Cómo se muestra un número guardado en el campo de texto: con coma, como se escribe en Chile (32.5 → «32,5»)
export const formatDecimalInput = (value?: number | null) => (value === undefined || value === null ? '' : String(value).replace('.', ','));

export const DECIMAL_HELP = 'Usa solo números; para decimales, coma o punto (ej. 32,5)';
