// Genera (o refresca) la plantilla CSV para cargar los planes de todos los
// pacientes que TODAVÍA no tienen un ClientPlan activo.
//
// Uso:
//   npm run export-plans-template
//
// Esto crea/actualiza scripts/data/client-plans-import.csv con una fila por
// paciente sin plan activo. Mario completa las columnas serviceType,
// sessionsTotal y startDate (opcional) a mano, y después corre:
//   npm run import-plans -- --dry-run   (para previsualizar)
//   npm run import-plans                (para aplicar)
//
// Si un paciente YA tiene fila en el CSV (de una corrida anterior) y todavía
// no se le ha registrado el plan, se conserva lo que Mario ya haya escrito
// (no se pisa una fila con datos ya completados).
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import User from '../models/User.js';
import { getActivePlan } from '../services/clientPlanService.js';
import { toCsvLine, parseCsvToObjects } from './csvUtil.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = path.join(__dirname, 'data', 'client-plans-import.csv');
const HEADERS = ['email', 'firstName', 'lastName', 'serviceType', 'sessionsTotal', 'startDate', 'notes'];

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);

  const patients = await User.find({ role: 'patient' }).sort({ lastName: 1 });

  // Conservar filas ya completadas de una exportación anterior, por email.
  let existingByEmail = {};
  if (fs.existsSync(OUTPUT_PATH)) {
    const existingRows = parseCsvToObjects(fs.readFileSync(OUTPUT_PATH, 'utf-8'));
    existingByEmail = Object.fromEntries(existingRows.map((r) => [r.email, r]));
  }

  const rows = [HEADERS];
  let skippedHasPlan = 0;
  let kept = 0;
  let added = 0;

  for (const patient of patients) {
    const activePlan = await getActivePlan(patient._id);
    if (activePlan) {
      skippedHasPlan++;
      continue;
    }

    const previous = existingByEmail[patient.email];
    if (previous) {
      rows.push([
        patient.email, patient.firstName, patient.lastName,
        previous.serviceType || '', previous.sessionsTotal || '', previous.startDate || '', previous.notes || ''
      ]);
      kept++;
    } else {
      rows.push([patient.email, patient.firstName, patient.lastName, '', '', '', '']);
      added++;
    }
  }

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, rows.map(toCsvLine).join('\n') + '\n', 'utf-8');

  console.log(`✅ Plantilla escrita en: ${OUTPUT_PATH}`);
  console.log(`   ${added} paciente(s) nuevo(s) agregado(s) a la plantilla.`);
  console.log(`   ${kept} fila(s) ya completada(s) se mantuvieron sin cambios.`);
  console.log(`   ${skippedHasPlan} paciente(s) ya tienen un plan activo (no se incluyen).`);
  console.log(`\nCompleta las columnas serviceType/sessionsTotal/startDate y corre:`);
  console.log(`   npm run import-plans -- --dry-run`);

  await mongoose.disconnect();
}

run().catch((error) => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
