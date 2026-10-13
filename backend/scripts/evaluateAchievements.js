// Revisión retroactiva de logros con los datos que YA existen (kinesiología y constancia mensual).
//
//   node scripts/evaluateAchievements.js            → solo INFORMA qué se concedería (no cambia nada)
//   node scripts/evaluateAchievements.js --apply    → concede los logros (y avisa a cada paciente, una vez)
//
// Es seguro repetirlo: un logro ya concedido no se vuelve a conceder ni a avisar. Úsalo la primera vez que se
// despliegue la función, para que los pacientes que ya cumplían reciban su reconocimiento.
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Appointment from '../models/Appointment.js';
import { evaluatePatientAchievements } from '../services/achievements/index.js';

dotenv.config();

const apply = process.argv.includes('--apply');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);

  const patientIds = await Appointment.distinct('patient', { status: 'completed' });
  console.log(`${apply ? '▶ APLICANDO' : '👀 SOLO INFORMANDO (usa --apply para conceder)'} · ${patientIds.length} pacientes con sesiones completadas`);

  const byKey = {};
  let total = 0;
  for (const patientId of patientIds) {
    const { granted } = await evaluatePatientAchievements(patientId, { dryRun: !apply });
    for (const g of granted) {
      byKey[g.key] = (byKey[g.key] ?? 0) + 1;
      total += 1;
    }
  }

  console.log(`${apply ? '✅ Concedidos' : '📋 Se concederían'}: ${total}`);
  for (const [key, count] of Object.entries(byKey)) console.log(`   · ${key}: ${count}`);

  await mongoose.disconnect();
  process.exit(0);
}

run().catch((error) => {
  console.error('❌ Error al revisar los logros:', error.message);
  process.exit(1);
});
