// Job de vencimiento de planes: marca 'expired' todos los ClientPlan activos
// cuya endDate ya pasó. Pensado para correr por cron (Railway Cron, GitHub Actions,
// o cualquier scheduler externo) con: node scripts/expirePlans.js
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import ClientPlan from '../models/ClientPlan.js';

dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);

  const expiredCount = await ClientPlan.expireOverduePlans();

  console.log(`✅ Verificación de vencimientos completa: ${expiredCount} plan(es) marcado(s) como 'expired'.`);

  await mongoose.disconnect();
  process.exit(0);
}

run().catch((error) => {
  console.error('❌ Error al verificar vencimientos:', error.message);
  process.exit(1);
});
