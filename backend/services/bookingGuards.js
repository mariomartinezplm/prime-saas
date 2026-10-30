import { getSessionBalanceByType, planForBooking, bookingInstant, bookingWindowOf, bookablePlansFor } from './clientPlanService.js';
import { formatDayMonthSantiago } from '../utils/timezone.js';

// Reglas de saldo y plan para AGENDAR una cita. Vivían dentro de appointmentController.js; se movieron aquí SIN cambiar su
// comportamiento para que las use también el horario fijo (recurringSlotService.js) y las reglas sean una sola.

// Tipos de cita que sí consumen una sesión del plan (Paso 15 de BLUEPRINT.md).
// 'evaluacion' = Evaluación de kinesiología: desde la decisión de Mario del 2026-10-24 SÍ descuenta, de las sesiones del plan de
// kinesiología (ej. 1 de las 10), y ahí empieza a correr el plan. Antes era un primer contacto gratuito.
export const DEDUCTIBLE_TYPES = ['kinesiologia', 'entrenamiento', 'evaluacion'];

// De qué plan se descuenta cada tipo de cita: la evaluación sale del plan de kinesiología
export const planServiceOf = (type) => (type === 'evaluacion' ? 'kinesiologia' : type);

// Un paciente solo puede agendar por sí mismo los tipos que consumen una sesión de su plan (la evaluación de kinesiología
// también, y se le exige saldo de kinesiología). Cualquier otro tipo lo agenda el centro: antes un paciente podía pedir
// type:'evaluacion' y saltarse el chequeo de saldo (cita gratis).
export function checkTypeBookableByPatient(type) {
  if (DEDUCTIBLE_TYPES.includes(type)) return null;
  return {
    status: 403,
    body: { success: false, message: 'Ese tipo de cita lo agenda el centro. Contacta a Prime F&H.', code: 'TYPE_NOT_ALLOWED' }
  };
}

// ¿Tiene el paciente algún plan con sesiones para agendar? Si no, no ve los horarios (decisión de Mario): solo se le muestra
// que debe renovar. Un plan con renovación pendiente de pago sigue contando dentro de su plazo (la regla de fecha límite se exige al agendar).
export async function patientHasBookablePlan(patientId) {
  for (const type of new Set(DEDUCTIBLE_TYPES.map(planServiceOf))) {
    const balance = await getSessionBalanceByType(patientId, type);
    if (balance.totalAvailable > 0) return true;
  }
  return false;
}

export const PLAN_LOCKED_MESSAGE = 'Para ver los horarios necesitas un plan vigente con sesiones disponibles. Contacta a Prime F&H para renovar.';

// Bloqueo por plan (ClientPlan) vencido o sin sesiones disponibles DE ESE TIPO.
// Consciente del tipo de cita: un paciente con plan de kinesiología no debe
// pasar este chequeo para agendar entrenamiento, aunque tenga saldo de kine.
// Devuelve null si puede agendar, o un objeto { status, body } listo para responder si no puede.
export async function checkSessionBalanceForBooking(patientId, type, { date, startTime } = {}) {
  if (!DEDUCTIBLE_TYPES.includes(type)) return null; // evaluación: sin bloqueo de saldo

  const balance = await getSessionBalanceByType(patientId, planServiceOf(type));

  if (date && startTime) {
    const sessionStart = bookingInstant(date, startTime);
    // La cita sale del ciclo al que pertenece su fecha: el vigente, el siguiente si ya está pagado, o (hasta el día 5) lo que queda
    // del último ciclo. Más allá, esa fecha todavía no se puede agendar.
    const target = await planForBooking(patientId, planServiceOf(type), sessionStart);
    if (target) {
      const { plan } = target;
      const left = plan.sessionsAvailable();
      // Renovación pendiente de pago: se puede agendar solo dentro del plazo de pago (hasta el día 5)
      if (plan.paymentPending && left > 0 && sessionStart.getTime() >= plan.paymentDueBy.getTime()) {
        const lastDay = formatDayMonthSantiago(new Date(plan.paymentDueBy.getTime() - 1));
        return {
          status: 403,
          body: {
            success: false,
            message: `Tu renovación está pendiente de pago: por ahora puedes agendar sesiones hasta el ${lastDay}. Para agendar después, contacta a Prime F&H para registrar tu pago.`,
            code: 'PAYMENT_PENDING'
          }
        };
      }
      if (left + balance.extraSessionsAvailable > 0) return null;
    } else if (balance.hasActivePlan) {
      // Hay plan, pero esa fecha queda fuera de lo que cubre (o del plazo de pago): se dice hasta cuándo sí se puede
      const win = bookingWindowOf(await bookablePlansFor(patientId, planServiceOf(type)));
      if (win) {
        return {
          status: 403,
          body: {
            success: false,
            message: `Tu plan te permite agendar hasta el ${formatDayMonthSantiago(win.until)}. Para agendar después, contacta a Prime F&H para renovar.`,
            code: 'OUTSIDE_PLAN'
          }
        };
      }
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
