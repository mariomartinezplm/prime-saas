import SlotClosure from '../models/SlotClosure.js';

/**
 * «Cerrar horario»: reglas puras + consultas. Una sesión dura 60 minutos, así que cerrar las 19:00 impide cualquier cita NUEVA que
 * comparta tiempo con 19:00–20:00 (las que empiezan a las 18:30, 19:00 y 19:30). Las que empiezan a las 18:00 o a las 20:00 no se tocan.
 * Las citas que ya existen nunca se modifican.
 */
export const SESSION_MINUTES = 60;

const toMin = (t) => {
  const [h, m] = String(t).split(':').map(Number);
  return h * 60 + m;
};

// ¿Una cita nueva que empieza en `slotStart` comparte tiempo con la hora cerrada que empieza en `closureStart`?
export const closureBlocks = (closureStart, slotStart) => Math.abs(toMin(closureStart) - toMin(slotStart)) < SESSION_MINUTES;

// Día calendario (YYYY-MM-DD) tal como se guardan las citas
export const dayKey = (date) => new Date(date).toISOString().slice(0, 10);

// Horas cerradas de un profesional en un día
export async function closedStartsFor(professionalId, date) {
  const rows = await SlotClosure.find({ professional: professionalId, date: dayKey(date) }).select('startTime').lean();
  return rows.map((r) => r.startTime);
}

// ¿Una cita nueva en `startTime` cae en una hora cerrada?
export async function isSlotClosed(professionalId, date, startTime) {
  const closed = await closedStartsFor(professionalId, date);
  return closed.some((c) => closureBlocks(c, startTime));
}

// De una lista de horas de inicio, las que quedan bloqueadas por alguna hora cerrada
export const blockedByClosures = (closedStarts, slotStarts) => slotStarts.filter((s) => closedStarts.some((c) => closureBlocks(c, s)));

export const SLOT_CLOSED_PATIENT_MESSAGE = 'Este horario está cerrado y no recibe más pacientes. Elige otro horario.';
export const SLOT_CLOSED_STAFF_MESSAGE = 'Este horario está cerrado: no se agregan más pacientes. ¿Quieres agregar a esta persona de todos modos?';
