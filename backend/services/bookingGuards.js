import { getSessionBalanceByType } from './clientPlanService.js';
import { santiagoToUtc, formatDayMonthSantiago } from '../utils/timezone.js';

// Reglas de saldo y plan para AGENDAR una cita. Vivían dentro de appointmentController.js; se movieron aquí SIN cambiar su
// comportamiento para que las use también el horario fijo (recurringSlotService.js) y las reglas sean una sola.

// Tipos de cita que sí consumen una sesión del plan (Paso 15 de BLUEPRINT.md).
// 'evaluacion' queda fuera a propósito: es un primer contacto, no una sesión
// del bono (decisión de Mario).
export const DEDUCTIBLE_TYPES = ['kinesiologia', 'entrenamiento'];

// Bloqueo por plan (ClientPlan) vencido o sin sesiones disponibles DE ESE TIPO.
// Consciente del tipo de cita: un paciente con plan de kinesiología no debe
// pasar este chequeo para agendar entrenamiento, aunque tenga saldo de kine.
// Devuelve null si puede agendar, o un objeto { status, body } listo para responder si no puede.
export async function checkSessionBalanceForBooking(patientId, type, { date, startTime } = {}) {
  if (!DEDUCTIBLE_TYPES.includes(type)) return null; // evaluación: sin bloqueo de saldo

  const balance = await getSessionBalanceByType(patientId, type);

  // Renovación pendiente de pago: se puede agendar solo dentro del plazo de pago
  // (hasta el día 5). Más allá, hace falta que el centro registre el pago.
  if (balance.plan?.paymentPending && balance.planSessionsAvailable > 0 && date && startTime) {
    const [year, month, day] = new Date(date).toISOString().split('T')[0].split('-').map(Number);
    const [hour, minute] = startTime.split(':').map(Number);
    const sessionStart = santiagoToUtc(year, month, day, hour, minute);

    if (sessionStart.getTime() >= balance.plan.paymentDueBy.getTime()) {
      const lastDay = formatDayMonthSantiago(new Date(balance.plan.paymentDueBy.getTime() - 1));
      return {
        status: 403,
        body: {
          success: false,
          message: `Tu renovación está pendiente de pago: por ahora puedes agendar sesiones hasta el ${lastDay}. Para agendar después, contacta a Prime F&H para registrar tu pago.`,
          code: 'PAYMENT_PENDING'
        }
      };
    }
  }

  if (balance.totalAvailable > 0) return null;

  const message = balance.hasActivePlan
    ? 'Ya utilizaste todas las sesiones de tu plan. Contacta a Prime F&H para renovar.'
    : 'Tu plan venció, no tienes un plan de este tipo, o no tienes un plan activo. Contacta a Prime F&H para renovar.';

  return {
    status: 403,
    body: { success: false, message, code: 'NO_ACTIVE_PLAN_SESSIONS' }
  };
}
