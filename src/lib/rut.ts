// RUT chileno. El login por RUT busca el texto EXACTO guardado y pide el formato "12345678-9"
// (sin puntos, con guión). Si al registrar se guardara "12.345.678-9" ese paciente nunca podría
// entrar con su RUT, así que siempre se guarda normalizado.

// "12.345.678-k" → "12345678-K". Si no tiene cuerpo + dígito verificador, devuelve el texto limpio.
export function normalizeRut(input: string): string {
  const clean = input.replace(/[^0-9kK]/g, '').toUpperCase();
  if (clean.length < 2) return clean;
  return `${clean.slice(0, -1)}-${clean.slice(-1)}`;
}

// Dígito verificador (módulo 11)
function checkDigit(body: string): string {
  let sum = 0;
  let factor = 2;
  for (let i = body.length - 1; i >= 0; i--) {
    sum += Number(body[i]) * factor;
    factor = factor === 7 ? 2 : factor + 1;
  }
  const rest = 11 - (sum % 11);
  if (rest === 11) return '0';
  if (rest === 10) return 'K';
  return String(rest);
}

export function isValidRut(input: string): boolean {
  const rut = normalizeRut(input);
  const match = /^(\d{7,8})-([\dK])$/.exec(rut);
  return !!match && checkDigit(match[1]) === match[2];
}
