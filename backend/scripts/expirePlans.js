// Verificación manual del ciclo de vida de los planes (el servidor ya lo hace
// solo cada pocos minutos cuando ENABLE_SCHEDULER=true; este script sirve para
// correrlo a mano o desde un cron externo): node scripts/expirePlans.js
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { runPlanLifecycleJob } from '../services/planLifecycleService.js';

dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const summary = await runPlanLifecycleJob();
  console.log(`✅ Planes verificados: ${summary.expiringNotices} aviso(s) de "por vencer", ${summary.renewalNotices} renovación(es) pendiente(s) avisada(s), ${summary.expiredNotices} vencido(s) avisado(s).`);
  await mongoose.disconnect();
  process.exit(0);
}

run().catch((error) => {
  console.error('❌ Error al verificar los planes:', error.message);
  process.exit(1);
});
