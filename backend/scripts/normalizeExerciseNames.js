/**
 * Normalización de nombres de ejercicio (identidad canónica). SEGURA por defecto: solo MUESTRA lo que haría.
 *
 *   node scripts/normalizeExerciseNames.js                       → simulación (no escribe nada)
 *   node scripts/normalizeExerciseNames.js --apply --respaldo-listo   → aplica (base LOCAL)
 *   ... --apply --respaldo-listo --permitir-remota                   → aplica en una base que NO es local (producción)
 *
 * Reglas: nunca borra ni fusiona filas; solo agrega `exerciseKey` y, cuando hay varias escrituras del mismo ejercicio, deja la
 * más frecuente en `exerciseName` guardando la original en `exerciseNameOriginal`. Cada cambio se hace SOLO si el nombre sigue
 * siendo el esperado (no pisa lo que cambió mientras tanto). Al terminar verifica que el conteo de series y la suma de
 * peso × repeticiones no cambiaron.
 * La URI de la base viene de la variable de entorno MONGODB_URI (este script no lee archivos .env).
 */
import mongoose from 'mongoose';
import ExerciseProgress from '../models/Exercise.js';
import { planNormalization } from '../services/exerciseNormalization.js';

const args = new Set(process.argv.slice(2));
const apply = args.has('--apply');
const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error('Falta la variable de entorno MONGODB_URI.');
  process.exit(1);
}
const isLocal = /(^|@|\/\/)(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/.test(uri);
if (apply && !args.has('--respaldo-listo')) {
  console.error('Para aplicar hace falta confirmar que hay un respaldo reciente: agrega --respaldo-listo.');
  process.exit(1);
}
if (apply && !isLocal && !args.has('--permitir-remota')) {
  console.error('La base NO es local. Para aplicar en otra base agrega --permitir-remota (solo con autorización expresa).');
  process.exit(1);
}

const fingerprint = async () => {
  const [row] = await ExerciseProgress.aggregate([{ $group: { _id: null, filas: { $sum: 1 }, carga: { $sum: { $multiply: [{ $ifNull: ['$weight', 0] }, { $ifNull: ['$reps', 0] }, { $ifNull: ['$sets', 1] }] } }, pacientes: { $addToSet: '$patient' } } }]);
  return { filas: row?.filas ?? 0, carga: row?.carga ?? 0, pacientes: row?.pacientes?.length ?? 0 };
};

await mongoose.connect(uri);
const before = await fingerprint();
const rows = await ExerciseProgress.find({}).select('patient exerciseName exerciseKey date').lean();
const plan = planNormalization(rows);
console.log(JSON.stringify({ modo: apply ? 'APLICAR' : 'SIMULACIÓN', base: isLocal ? 'local' : 'remota', filas: rows.length, ejerciciosDistintos: plan.groups, ejerciciosConVariasEscrituras: plan.spellingGroups, filasPorUnificar: plan.unifiedRows, cambios: plan.updates.length }));
for (const u of plan.updates.filter((x) => x.rename).slice(0, 20)) console.log(`  ${u.patient}: «${u.from}» → «${u.to}»`);

if (apply && plan.updates.length > 0) {
  const ops = plan.updates.map((u) => ({
    updateOne: {
      filter: { _id: u.id, exerciseName: u.from },
      update: { $set: { exerciseKey: u.key, ...(u.rename ? { exerciseName: u.to, exerciseNameOriginal: u.from } : {}) } }
    }
  }));
  const result = await ExerciseProgress.bulkWrite(ops, { ordered: false });
  const after = await fingerprint();
  const intact = after.filas === before.filas && after.carga === before.carga && after.pacientes === before.pacientes;
  console.log(JSON.stringify({ modificadas: result.modifiedCount, antes: before, despues: after, sinPerdidas: intact }));
  if (!intact) process.exitCode = 2;
}
await mongoose.disconnect();
