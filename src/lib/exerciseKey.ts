// Identidad canónica de un ejercicio en el navegador: la MISMA regla que backend/utils/exerciseKey.js (hay una prueba que las
// compara). «Press Banca», «press banca» y «PRESS BANCA» son el mismo ejercicio; «press banca inclinado» no.
export function exerciseKeyOf(name: string | null | undefined): string {
  return String(name ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}
