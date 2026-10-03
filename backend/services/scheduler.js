import { sendDueReminders } from './appointmentReminderService.js';
import { runPlanLifecycleJob } from './planLifecycleService.js';
import { importNewPatients, isAirtableConfigured, AUTO_IMPORT_FROM } from '../utils/airtableSync.js';

const TICK_MS = 10 * 60 * 1000;

let running = false;
let lastNoEmailCount = 0;

async function tick() {
  // Si la vuelta anterior todavía no termina, se salta esta (nunca dos a la vez)
  if (running) return;
  running = true;

  if (isAirtableConfigured()) {
    try {
      const imported = await importNewPatients({ createdSince: AUTO_IMPORT_FROM });
      const noEmail = imported.skippedNoEmail.length;
      if (imported.created || imported.failed || noEmail !== lastNoEmailCount) {
        console.log(`📥 Airtable: ${imported.created} pacientes nuevos, ${imported.failed} con error, ${noEmail} sin correo (no se pueden importar)`);
      }
      lastNoEmailCount = noEmail;
    } catch (error) {
      console.error('Error importando desde Airtable:', error.message);
    }
  }

  try {
    const summary = await sendDueReminders();
    if (summary.sent24h || summary.sent4h || summary.failed) {
      console.log(`⏰ Recordatorios: ${summary.sent24h} de 24 h, ${summary.sent4h} de 4 h, ${summary.failed} con error`);
    }
  } catch (error) {
    console.error('Error en el programador de recordatorios:', error.message);
  }

  try {
    const plans = await runPlanLifecycleJob();
    if (plans.expiringNotices || plans.renewalNotices || plans.expiredNotices) {
      console.log(`📋 Planes: ${plans.expiringNotices} por vencer, ${plans.renewalNotices} renovaciones pendientes, ${plans.expiredNotices} vencidos`);
    }
  } catch (error) {
    console.error('Error en el programador de planes:', error.message);
  } finally {
    running = false;
  }
}

// Solo corre si se pide explícitamente con ENABLE_SCHEDULER=true (variable de
// Railway). Así, un servidor levantado en un computador de desarrollo contra la
// base de producción nunca manda correos de recordatorio a pacientes reales.
export function startScheduler() {
  if (process.env.ENABLE_SCHEDULER !== 'true') {
    console.log('⏰ Programador de recordatorios apagado (ENABLE_SCHEDULER no es "true")');
    return;
  }
  console.log(`⏰ Programador de recordatorios activo (cada ${TICK_MS / 60000} min)`);
  setTimeout(tick, 30 * 1000);
  setInterval(tick, TICK_MS).unref();
}
