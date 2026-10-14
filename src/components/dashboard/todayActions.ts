import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { appointmentEnd, appointmentStart, dayKey } from '../../lib/appointments';
import { todayLocal } from '../../lib/evolutionDate';
import { appointmentTypeLabels } from '../shared/statusMeta';
import type { Appointment, SessionBalance } from '../../types';
import type { ReadinessTodayStatus } from '../wellness/readinessStatus';

/**
 * «Para hoy» del dashboard del paciente: qué conviene hacer ahora, calculado SOLO con datos que ya existen en la app
 * (citas, saldo del plan y si ya respondió el Readiness de hoy). No hay un programa de entrenamiento en el sistema,
 * así que nunca se dice «entrena hoy»: nada de lo que se muestra es inventado.
 *
 * Este archivo es puro (sin React ni llamadas a la API) para poder probar cada caso.
 *
 * PRIORIDADES (siempre este orden; se muestran como máximo 3):
 *   1. plan-expired   no tiene plan vigente (venció o nunca tuvo): no puede agendar ni registrar evolución.
 *   2. session-live   tiene una sesión en curso ahora mismo.
 *   3. session-today  tiene una sesión hoy que todavía no empieza (la más cercana).
 *   4. readiness      tiene plan vigente y todavía no respondió el Readiness de hoy.
 *   5. plan-used-up   plan vigente, sin sesiones disponibles (y no ilimitado).
 *   6. book-next      plan vigente, con sesiones disponibles y SIN ninguna sesión por venir.
 *
 * Lo que NO se repite aquí porque ya tiene su propio aviso en la pantalla: la renovación pendiente de pago (aviso
 * amarillo de arriba) y la sesión de otro día (tarjeta «Próxima sesión»). Si no hay nada que hacer, se dice con
 * neutralidad («No tienes otras tareas para hoy»); nunca «todo en orden», porque no se puede saber.
 */

// El tipo vive junto a la tarjeta del Readiness (que es quien lo calcula); aquí solo se reutiliza
export type ReadinessToday = ReadinessTodayStatus;
// Qué se sabe del historial de planes de quien hoy no tiene plan vigente (solo se consulta en ese caso)
export type PlanHistory = 'expired' | 'none' | 'upcoming' | 'unknown';
export type TodayActionId = 'plan-expired' | 'session-live' | 'session-today' | 'readiness' | 'plan-used-up' | 'book-next';
export type TodayTarget = 'readiness' | 'plan';

export interface TodayAction {
  id: TodayActionId;
  title: string;
  detail: string;
  // Importante = impide usar la app con normalidad: lleva etiqueta de texto, no solo color
  urgent?: boolean;
  cta: { label: string; to?: string; target?: TodayTarget };
}

export type TodayStatus =
  | 'actions' // hay acciones que mostrar
  | 'loading' // todavía no se sabe si falta el Readiness
  | 'empty' // se sabe todo y no hay nada pendiente
  | 'unknown'; // faltan datos (falló una carga): no se afirma nada

export interface TodayInput {
  now: Date;
  upcoming: Appointment[] | null;
  balance: SessionBalance | null;
  readiness: ReadinessToday;
  // Opcional: sin este dato se usa un texto neutral para el caso «sin plan vigente»
  planHistory?: PlanHistory;
}

export interface TodayResult {
  status: TodayStatus;
  actions: TodayAction[];
  // Con acciones ya mostradas, todavía falta saber del Readiness: se reserva el espacio para que nada «salte»
  loadingMore: boolean;
}

export const MAX_TODAY_ACTIONS = 3;

// «en 40 min», «en 2 h», «en 2 h 15 min»
export const timeUntil = (from: Date, to: Date): string => {
  const minutes = Math.max(0, Math.ceil((to.getTime() - from.getTime()) / 60000));
  if (minutes < 1) return 'ahora';
  if (minutes < 60) return `en ${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `en ${h} h` : `en ${h} h ${m} min`;
};

export const greetingFor = (now: Date): string => {
  const hour = now.getHours();
  if (hour < 12) return 'Buenos días';
  if (hour < 20) return 'Buenas tardes';
  return 'Buenas noches';
};

// «Martes 14 de octubre», en el calendario local del dispositivo
export const todayLabel = (now: Date): string => {
  const text = format(now, "EEEE d 'de' MMMM", { locale: es });
  return text.charAt(0).toUpperCase() + text.slice(1);
};

export function computeTodayActions({ now, upcoming, balance, readiness, planHistory = 'unknown' }: TodayInput): TodayResult {
  const actions: TodayAction[] = [];
  const hasPlan = balance?.hasActivePlan === true;
  const today = todayLocal(now);

  // Citas de hoy que no terminaron, de la más temprana a la más tarde
  const todays = (upcoming ?? [])
    .filter((apt) => apt.status === 'scheduled' && dayKey(apt.date) === today && appointmentEnd(apt) > now)
    .sort((a, b) => appointmentStart(a).getTime() - appointmentStart(b).getTime());
  const live = todays.find((apt) => appointmentStart(apt) <= now);
  const later = todays.find((apt) => appointmentStart(apt) > now);
  const hasAnythingComing = (upcoming ?? []).some((apt) => apt.status === 'scheduled' && appointmentEnd(apt) > now);

  // 1 (el texto distingue plan vencido, plan que aún no empieza y nunca haber tenido uno)
  if (balance && !balance.hasActivePlan) {
    const wording: Record<PlanHistory, { title: string; detail: string; cta: string }> = {
      expired: { title: 'Tu plan venció', detail: 'Contacta a Prime F&H para renovarlo y volver a agendar.', cta: 'Ver cómo renovar' },
      none: { title: 'Aún no tienes un plan activo', detail: 'Contacta a Prime F&H para activar tu plan y agendar.', cta: 'Ver mi plan' },
      upcoming: { title: 'Tu plan todavía no empieza', detail: 'Cuando comience podrás agendar tus sesiones.', cta: 'Ver mi plan' },
      unknown: { title: 'No tienes un plan vigente', detail: 'Contacta a Prime F&H para activarlo o renovarlo.', cta: 'Ver mi plan' },
    };
    const text = wording[planHistory];
    actions.push({
      id: 'plan-expired',
      title: text.title,
      detail: text.detail,
      urgent: true,
      cta: { label: text.cta, target: 'plan' },
    });
  }

  // 2 y 3 (una sola sesión: la que está en curso o, si no hay, la más cercana de hoy)
  if (live) {
    actions.push({
      id: 'session-live',
      title: 'Tu sesión está en curso',
      detail: `${live.startTime} – ${live.endTime} · ${appointmentTypeLabels[live.type]}`,
      cta: { label: 'Ver mis citas', to: '/app/mis-citas' },
    });
  } else if (later) {
    actions.push({
      id: 'session-today',
      title: `Hoy tienes sesión a las ${later.startTime}`,
      detail: `${appointmentTypeLabels[later.type]} · empieza ${timeUntil(now, appointmentStart(later))}`,
      cta: { label: 'Ver mis citas', to: '/app/mis-citas' },
    });
  }

  // 4
  if (hasPlan && readiness === 'pending') {
    actions.push({
      id: 'readiness',
      title: 'Completa tu Readiness de hoy',
      detail: 'Te toma menos de un minuto.',
      cta: { label: 'Completar', target: 'readiness' },
    });
  }

  // 5
  if (balance && hasPlan && !balance.plan?.unlimited && balance.totalAvailable === 0) {
    actions.push({
      id: 'plan-used-up',
      title: 'Usaste todas las sesiones de tu plan',
      detail: 'Contacta a Prime F&H para renovarlo.',
      cta: { label: 'Ver mi plan', target: 'plan' },
    });
  }

  // 6
  if (balance && hasPlan && balance.totalAvailable > 0 && upcoming !== null && !hasAnythingComing) {
    actions.push({
      id: 'book-next',
      title: 'Reserva tu próxima sesión',
      detail: balance.plan?.unlimited ? 'Tu plan es ilimitado.' : `Te quedan ${balance.totalAvailable} sesión(es) disponible(s).`,
      cta: { label: 'Reservar hora', to: '/app/reservar' },
    });
  }

  const shown = actions.slice(0, MAX_TODAY_ACTIONS);
  const waitingReadiness = hasPlan && readiness === 'loading';

  if (shown.length > 0) return { status: 'actions', actions: shown, loadingMore: waitingReadiness };
  if (waitingReadiness) return { status: 'loading', actions: [], loadingMore: true };

  // Sin acciones: solo se afirma «nada pendiente» si se pudo saber todo
  const knowsEverything = upcoming !== null && balance !== null && (!hasPlan || readiness === 'pending' || readiness === 'done');
  return { status: knowsEverything ? 'empty' : 'unknown', actions: [], loadingMore: false };
}
