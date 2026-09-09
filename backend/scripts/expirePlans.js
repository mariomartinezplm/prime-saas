// Job de vencimiento de planes: marca 'expired' todos los ClientPlan activos
// cuya endDate ya pasó, y notifica (in-app + email, Paso 19 de BLUEPRINT.md) al
// paciente y a los admins cuando un plan está a 5 días de vencer o recién
// venció — una sola vez por plan, vía expiringNotifiedAt/expiredNotifiedAt.
// Pensado para correr por cron (Railway Cron, GitHub Actions, o cualquier
// scheduler externo) con: node scripts/expirePlans.js
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import ClientPlan from '../models/ClientPlan.js';
import User from '../models/User.js';
import { notify } from '../services/notificationService.js';

dotenv.config();

const EXPIRING_SOON_DAYS = 5;

async function getActiveAdminIds() {
  const admins = await User.find({ role: 'admin', isActive: true }).select('_id');
  return admins.map((a) => a._id);
}

async function notifyExpiringSoon(adminIds) {
  const now = new Date();
  const soon = new Date(now.getTime() + EXPIRING_SOON_DAYS * 24 * 60 * 60 * 1000);

  const plans = await ClientPlan.find({
    status: 'active',
    endDate: { $gte: now, $lte: soon },
    expiringNotifiedAt: null
  }).populate('patient', 'firstName lastName');

  for (const plan of plans) {
    const patientName = `${plan.patient.firstName} ${plan.patient.lastName}`;
    const daysLeft = Math.max(1, Math.ceil((plan.endDate - now) / (24 * 60 * 60 * 1000)));

    await notify(plan.patient._id, 'plan_expiring', {
      title: 'Tu plan está por vencer',
      body: `Tu plan vence en ${daysLeft} día(s). Contacta a Prime F&H para renovar y no perder continuidad.`,
      link: '/app/mi-perfil'
    });

    for (const adminId of adminIds) {
      await notify(adminId, 'plan_expiring', {
        title: 'Plan de paciente por vencer',
        body: `El plan de ${patientName} vence en ${daysLeft} día(s).`,
        link: '/app/admin/planes'
      });
    }

    plan.expiringNotifiedAt = now;
    await plan.save();
  }

  return plans.length;
}

async function expireAndNotify(adminIds) {
  const now = new Date();

  const overdue = await ClientPlan.find({
    status: 'active',
    endDate: { $lt: now }
  }).populate('patient', 'firstName lastName');

  for (const plan of overdue) {
    const patientName = `${plan.patient.firstName} ${plan.patient.lastName}`;

    await notify(plan.patient._id, 'plan_expired', {
      title: 'Tu plan venció',
      body: 'Tu plan venció. Contacta a Prime F&H para renovar y seguir agendando.',
      link: '/app/mi-perfil'
    });

    for (const adminId of adminIds) {
      await notify(adminId, 'plan_expired', {
        title: 'Plan de paciente vencido',
        body: `El plan de ${patientName} venció.`,
        link: '/app/admin/planes'
      });
    }

    plan.status = 'expired';
    plan.expiredNotifiedAt = now;
    await plan.save();
  }

  return overdue.length;
}

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);

  const adminIds = await getActiveAdminIds();
  const expiringSoonCount = await notifyExpiringSoon(adminIds);
  const expiredCount = await expireAndNotify(adminIds);

  console.log(`✅ Verificación de vencimientos completa: ${expiringSoonCount} aviso(s) de "por vencer", ${expiredCount} plan(es) marcado(s) como 'expired'.`);

  await mongoose.disconnect();
  process.exit(0);
}

run().catch((error) => {
  console.error('❌ Error al verificar vencimientos:', error.message);
  process.exit(1);
});
