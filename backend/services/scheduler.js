import { sendDueReminders } from './appointmentReminderService.js';
import { runPlanLifecycleJob } from './planLifecycleService.js';
import { runAchievementSweep } from './achievements/index.js';
import { sendReadinessReminders } from './readinessReminderService.js';
import { sendWeeklyBookingReminders } from './weeklyBookingReminderService.js';
import { sendMidweekBookingReminders } from './midweekBookingReminderService.js';
import { syncAllRecurringSlots } from './recurringSlotService.js';
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
    const readiness = await sendReadinessReminders();
    if (readiness.sent || readiness.failed) {
      console.log(`💚 Readiness: ${readiness.sent} recordatorios, ${readiness.failed} con error`);
    }
  } catch (error) {
    console.error('Error en los recordatorios de Readiness:', error.message);
  }

  try {
    const weekly = await sendWeeklyBookingReminders();
    if (weekly.sent || weekly.failed) {
      console.log(`📅 Aviso del lunes: ${weekly.sent} recordatorios para agendar, ${weekly.failed} con error`);
    }
  } catch (error) {
    console.error('Error en el recordatorio semanal para agendar:', error.message);
  }

  try {
    const midweek = await sendMidweekBookingReminders();
    if (midweek.sent || midweek.failed) {
      console.log(`📅 Aviso del miércoles: ${midweek.sent} recordatorios para completar la semana, ${midweek.failed} con error`);
    }
  } catch (error) {
    console.error('Error en el recordatorio de mitad de semana:', error.message);
  }

  try {
    const logros = await runAchievementSweep();
    if (logros.granted || logros.flagged || logros.restored || logros.failed || logros.skipped) {
      console.log(`🏅 Logros: ${logros.granted} concedidos, ${logros.flagged} en revisión, ${logros.restored} restaurados, ${logros.failed} con error (${logros.patients} pacientes revisados${logros.skipped ? `, ${logros.skipped} fuera por el tope` : ''})`);
    }
  } catch (error) {
    console.error('Error en la pasada de logros:', error.message);
  }

  // Horarios fijos: agenda las citas que falten dentro de los días del plan (cada pasada pone el plan al día antes de mirar)
  try {
    const fixed = await syncAllRecurringSlots();
    if (fixed.created || fixed.skipped || fixed.failed) {
      console.log(`🔁 Horarios fijos: ${fixed.created} citas agendadas, ${fixed.skipped} fechas saltadas, ${fixed.failed} con error (${fixed.slots} horarios)`);
    }
  } catch (error) {
    console.error('Error en la pasada de horarios fijos:', error.message);
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
