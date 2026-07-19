// Carga masiva de ClientPlan desde el CSV generado por exportClientPlansTemplate.js.
//
// Uso:
//   npm run import-plans -- --dry-run     (previsualiza, no escribe nada)
//   npm run import-plans                  (aplica los cambios)
//   npm run import-plans -- --file=ruta.csv  (usar otro archivo)
//
// Reglas:
//   - Filas sin serviceType o sessionsTotal se omiten (Mario todavía no las completó).
//   - Si el paciente YA tiene un plan activo, se omite (no se duplica ni se reemplaza —
//     usa el flujo normal de "Registrar pago" en el panel admin si quieres reemplazarlo).
//   - startDate vacío = hoy. sessionsTotal debe ser uno de los valores válidos del catálogo.
//   - registeredBy queda como el primer usuario admin encontrado.
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import User from '../models/User.js';
import ClientPlan from '../models/ClientPlan.js';
import { getActivePlan } from '../services/clientPlanService.js';
import { isValidSessionsForServiceType, PLAN_CATALOG } from '../config/planCatalog.js';
import { parseCsvToObjects } from './csvUtil.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const fileArg = args.find((a) => a.startsWith('--file='));
const CSV_PATH = fileArg ? fileArg.replace('--file=', '') : path.join(__dirname, 'data', 'client-plans-import.csv');

async function run() {
  if (!fs.existsSync(CSV_PATH)) {
    console.error(`❌ No se encontró el archivo: ${CSV_PATH}`);
    console.error('   Corre primero: npm run export-plans-template');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);

  const admin = await User.findOne({ role: 'admin' });
  if (!admin) {
    console.error('❌ No se encontró ningún usuario admin para registrar los pagos.');
    process.exit(1);
  }

  const rows = parseCsvToObjects(fs.readFileSync(CSV_PATH, 'utf-8'));

  const results = { created: [], skippedIncomplete: [], skippedHasPlan: [], errors: [] };

  for (const row of rows) {
    const { email, serviceType, sessionsTotal, startDate, notes } = row;

    if (!serviceType || !sessionsTotal) {
      results.skippedIncomplete.push(email);
      continue;
    }

    const patient = await User.findOne({ email: email.toLowerCase(), role: 'patient' });
    if (!patient) {
      results.errors.push(`${email}: paciente no encontrado`);
      continue;
    }

    const sessionsNum = parseInt(sessionsTotal, 10);
    if (!isValidSessionsForServiceType(serviceType, sessionsNum)) {
      const allowed = PLAN_CATALOG[serviceType] || [];
      results.errors.push(`${email}: sessionsTotal "${sessionsTotal}" inválido para "${serviceType}" (válidos: ${allowed.join(', ') || 'serviceType desconocido'})`);
      continue;
    }

    const existingActive = await getActivePlan(patient._id);
    if (existingActive) {
      results.skippedHasPlan.push(email);
      continue;
    }

    if (!dryRun) {
      await ClientPlan.create({
        patient: patient._id,
        serviceType,
        sessionsTotal: sessionsNum,
        startDate: startDate ? new Date(startDate) : new Date(),
        registeredBy: admin._id,
        notes: notes || undefined
      });
    }

    results.created.push(`${email} → ${serviceType} (${sessionsNum} sesiones)`);
  }

  console.log(`\n${dryRun ? '🔍 DRY RUN — nada se escribió en la base de datos' : '✅ Importación aplicada'}\n`);
  console.log(`Planes ${dryRun ? 'a crear' : 'creados'}: ${results.created.length}`);
  results.created.forEach((line) => console.log(`  + ${line}`));

  console.log(`\nOmitidos (fila sin completar todavía): ${results.skippedIncomplete.length}`);
  if (results.skippedIncomplete.length) console.log(`  ${results.skippedIncomplete.join(', ')}`);

  console.log(`\nOmitidos (ya tienen plan activo): ${results.skippedHasPlan.length}`);
  if (results.skippedHasPlan.length) console.log(`  ${results.skippedHasPlan.join(', ')}`);

  if (results.errors.length) {
    console.log(`\n⚠️  Errores (${results.errors.length}):`);
    results.errors.forEach((e) => console.log(`  - ${e}`));
  }

  await mongoose.disconnect();
  process.exit(results.errors.length ? 1 : 0);
}

run().catch((error) => {
  console.error('❌ Error inesperado:', error.message);
  process.exit(1);
});
