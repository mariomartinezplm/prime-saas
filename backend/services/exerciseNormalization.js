import { exerciseKey } from '../utils/exerciseKey.js';

/**
 * Plan de normalización de nombres de ejercicio (puro, sin base de datos).
 *
 * Por PACIENTE, los registros con la misma clave canónica («Press Banca» = «press banca» = «PRESS BANCA») se unifican en UNA
 * escritura: la más frecuente (a igual cantidad, la más reciente). Solo se cambia el texto del nombre y se agrega la clave;
 * NUNCA se tocan series, pesos, repeticiones, fechas ni al paciente, y el nombre original queda en `exerciseNameOriginal`.
 * Ejercicios distintos («press banca plano» vs «inclinado») tienen claves distintas y no se unen.
 */
const sentenceScore = (name) => (/^[A-ZÁÉÍÓÚÑ][^A-ZÁÉÍÓÚÑ]*$/.test(name) ? 2 : /^[A-ZÁÉÍÓÚÑ]/.test(name) ? 1 : 0);

export function planNormalization(rows) {
  const groups = new Map();
  for (const r of rows) {
    const key = exerciseKey(r.exerciseName);
    if (!key) continue;
    const id = `${r.patient}|${key}`;
    if (!groups.has(id)) groups.set(id, { key, spellings: new Map(), rows: [] });
    const g = groups.get(id);
    g.rows.push(r);
    const entry = g.spellings.get(r.exerciseName) ?? { count: 0, latest: 0 };
    entry.count += 1;
    entry.latest = Math.max(entry.latest, new Date(r.date ?? 0).getTime());
    g.spellings.set(r.exerciseName, entry);
  }

  const updates = [];
  let unified = 0;
  let spellingGroups = 0;
  for (const g of groups.values()) {
    // La escritura visible: primero la «de oración» (Press banca), luego la más usada, luego la más reciente. Es solo estética:
    // todas son el mismo ejercicio por su clave.
    const ranked = [...g.spellings.entries()].sort((a, b) => sentenceScore(b[0]) - sentenceScore(a[0]) || b[1].count - a[1].count || b[1].latest - a[1].latest);
    const canonical = ranked[0][0];
    if (g.spellings.size > 1) spellingGroups += 1;
    for (const r of g.rows) {
      const rename = r.exerciseName !== canonical;
      if (rename) unified += 1;
      if (rename || r.exerciseKey !== g.key) {
        updates.push({ id: r._id, patient: r.patient, from: r.exerciseName, to: canonical, key: g.key, rename });
      }
    }
  }
  return { updates, unifiedRows: unified, spellingGroups, groups: groups.size };
}
