// Identidad canónica de un ejercicio: el nombre sin tildes, mayúsculas, signos ni espacios de más.
// «Press Banca», «press banca» y «PRESS BANCA » son el MISMO ejercicio; «press banca plano» e «inclinado» NO se unen.
// La misma regla existe en el navegador (src/lib/exerciseKey.ts); sus pruebas comparan ambas.
export function exerciseKey(name) {
  return String(name ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}
