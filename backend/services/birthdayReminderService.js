import User from '../models/User.js';
import { notifyOnce } from './notificationService.js';
import { sendBirthdayDigestEmail } from './emailService.js';
import { santiagoParts } from '../utils/timezone.js';
import { birthdayIn, dayKey } from '../utils/birthDate.js';

/**
 * Cumpleaños de los pacientes para su profesional (campanita + correo), hora de Chile.
 *
 *  - Semanal: los lunes desde las 08:00, la lista de lunes a domingo (solo si hay al menos un cumpleaños).
 *  - Diario: todos los días desde las 08:00, quiénes cumplen años HOY (solo si hay alguno).
 *  - Cada profesional recibe SOLO a sus pacientes asignados. Un paciente sin profesional no avisa a nadie.
 *  - Solo pacientes activos (no interesados) con fecha de nacimiento.
 *  - Un aviso por profesional por semana / por día (dedupeKey): reintentos o varias pasadas no duplican.
 *  - La campanita lleva solo nombres y días; el correo suma la edad que cumplen. Nada clínico.
 */

export const BIRTHDAY_HOUR = 8;
const MAX_NAMES_IN_BELL = 4;

export const weekKey = (professionalId, monday) => `birthday-week:${professionalId}:${monday}`;
export const todayKey = (professionalId, day) => `birthday-today:${professionalId}:${day}`;

const dayLabel = (date) => new Intl.DateTimeFormat('es-CL', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(date);
const fullName = (patient) => `${patient.firstName ?? ''} ${patient.lastName ?? ''}`.trim();

// Los siete días (lunes a domingo) de la semana que contiene a `monday` ({year, month, day}), como fechas UTC.
const weekDays = ({ year, month, day }) => Array.from({ length: 7 }, (_, i) => new Date(Date.UTC(year, month - 1, day + i)));

// Cumpleaños de `patients` que caen en alguno de `days`, ordenados por fecha y nombre.
export function birthdaysWithin(patients, days) {
  const found = [];
  for (const patient of patients) {
    for (const date of days) {
      const birthday = birthdayIn(patient.dateOfBirth, date.getUTCFullYear());
      if (birthday && birthday.month === date.getUTCMonth() + 1 && birthday.day === date.getUTCDate()) {
        found.push({ name: fullName(patient), age: birthday.age, date, when: dayLabel(date) });
        break;
      }
    }
  }
  return found.sort((a, b) => a.date - b.date || a.name.localeCompare(b.name, 'es'));
}

const bellText = (list, withDay) => {
  const shown = list.slice(0, MAX_NAMES_IN_BELL).map((item) => (withDay ? `${item.name} (${item.when})` : item.name));
  const rest = list.length - shown.length;
  return rest > 0 ? `${shown.join(', ')} y ${rest} más` : shown.join(', ');
};

export async function sendBirthdayReminders({ now = new Date() } = {}) {
  const summary = { weekly: 0, daily: 0, duplicates: 0, failed: 0 };
  const p = santiagoParts(now);
  if (p.hour < BIRTHDAY_HOUR) return summary;

  const today = new Date(Date.UTC(p.year, p.month - 1, p.day));
  const isMonday = today.getUTCDay() === 1;
  const todayStr = dayKey(p.year, p.month, p.day);

  const patients = await User.find({
    role: 'patient',
    isActive: true,
    isProspect: { $ne: true },
    assignedProfessionalId: { $ne: null },
    dateOfBirth: { $ne: null }
  }).select('firstName lastName dateOfBirth assignedProfessionalId').lean();
  if (patients.length === 0) return summary;

  const byProfessional = new Map();
  for (const patient of patients) {
    const key = String(patient.assignedProfessionalId);
    if (!byProfessional.has(key)) byProfessional.set(key, []);
    byProfessional.get(key).push(patient);
  }

  const staff = await User.find({ _id: { $in: [...byProfessional.keys()] }, role: { $in: ['professional', 'admin'] }, isActive: true })
    .select('_id email firstName').lean();

  const week = isMonday ? weekDays({ year: p.year, month: p.month, day: p.day }) : null;

  for (const professional of staff) {
    const mine = byProfessional.get(String(professional._id)) ?? [];

    const jobs = [];
    if (week) {
      const list = birthdaysWithin(mine, week);
      if (list.length) {
        jobs.push({
          type: 'birthday_week', key: weekKey(String(professional._id), todayStr), counter: 'weekly', list,
          title: 'Cumpleaños de la semana',
          body: `Esta semana cumplen años: ${bellText(list, true)}.`,
          intro: 'Estos son los cumpleaños de tus pacientes de esta semana (de lunes a domingo):'
        });
      }
    }
    const todayList = birthdaysWithin(mine, [today]);
    if (todayList.length) {
      jobs.push({
        type: 'birthday_today', key: todayKey(String(professional._id), todayStr), counter: 'daily', list: todayList,
        title: 'Hoy están de cumpleaños',
        body: `Hoy cumplen años: ${bellText(todayList, false)}.`,
        intro: 'Hoy están de cumpleaños estos pacientes tuyos:'
      });
    }

    for (const job of jobs) {
      try {
        const created = await notifyOnce(professional._id, job.type, { title: job.title, body: job.body, link: '/app/admin/pacientes', dedupeKey: job.key });
        if (!created) {
          summary.duplicates += 1;
          continue;
        }
        summary[job.counter] += 1;
        if (professional.email) {
          // Un correo que no sale no debe tumbar la pasada (mismo criterio que el resto de los avisos)
          sendBirthdayDigestEmail({ user: professional, title: job.title, intro: job.intro, items: job.list, showAge: true })
            .catch((error) => console.error('Error enviando correo de cumpleaños:', error.message));
        }
      } catch (error) {
        summary.failed += 1;
        console.error('Error enviando aviso de cumpleaños:', error.message);
      }
    }
  }

  return summary;
}
