// Migración aditiva: rellena User.assignedProfessionalId (ObjectId real) a partir
// del texto libre histórico en User.assignedProfessional (ej. "Mario Martínez P."),
// emparejando por nombre + apellido contra profesionales/admin reales.
// No borra ni modifica el campo de texto original. Se puede correr varias veces
// sin problema (solo actualiza pacientes que todavía no tengan assignedProfessionalId).
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import User from '../models/User.js';

dotenv.config();

function normalize(str) {
  return str
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // quitar tildes
    .trim();
}

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);

  const staff = await User.find({ role: { $in: ['admin', 'professional'] } });
  const patients = await User.find({
    role: 'patient',
    assignedProfessional: { $exists: true, $ne: '' },
    assignedProfessionalId: { $exists: false }
  });

  let matched = 0;
  const unmatched = [];

  for (const patient of patients) {
    const target = normalize(patient.assignedProfessional);
    const match = staff.find((s) => {
      const full = normalize(`${s.firstName} ${s.lastName}`);
      return target.startsWith(full) || full.startsWith(target);
    });

    if (match) {
      patient.assignedProfessionalId = match._id;
      await patient.save();
      matched++;
    } else {
      unmatched.push({ patient: `${patient.firstName} ${patient.lastName}`, text: patient.assignedProfessional });
    }
  }

  console.log(`✅ ${matched} paciente(s) emparejado(s) y actualizados.`);
  if (unmatched.length) {
    console.log(`⚠️  ${unmatched.length} paciente(s) sin match (revisar manualmente):`);
    console.log(unmatched);
  }

  await mongoose.disconnect();
  process.exit(0);
}

run().catch((error) => {
  console.error('❌ Error en la migración:', error.message);
  process.exit(1);
});
