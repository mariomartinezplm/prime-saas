import mongoose from 'mongoose';
import WorkoutSession from '../models/WorkoutSession.js';
import Appointment from '../models/Appointment.js';
import { hasActivePlan } from '../services/clientPlanService.js';
import { santiagoParts } from '../utils/timezone.js';
import { applyRestAction, settle, remainingSec, pickStartable, isStale, REST_ACTIONS } from '../services/workoutService.js';

/**
 * Entrenamiento en curso — Incremento 1: sesión activa y relojes.
 *
 * Esta función es un REGISTRO PERSONAL del paciente. Nunca modifica la cita ni el plan, no descuenta sesiones, no toca
 * los cupos y no concede logros: solo lee la cita para saber cuándo se puede iniciar.
 */

const PLAN_MESSAGE = 'Tu plan venció o no tienes un plan activo. Contacta a Prime F&H para renovar antes de iniciar un entrenamiento.';

// Lo que sale hacia la pantalla: instantes y el estado del descanso ya "asentado" (un descanso vencido figura como terminado)
export function sessionView(session, now = new Date()) {
  const rest = settle(session.rest, now);
  return {
    id: String(session._id),
    appointmentId: session.appointment ? String(session.appointment) : null,
    status: session.status,
    startedAt: session.startedAt,
    endedAt: session.endedAt ?? null,
    lastActivityAt: session.lastActivityAt,
    rest: {
      state: rest.state ?? 'idle',
      dueAt: rest.dueAt ?? null,
      remainingSec: remainingSec(rest, now),
      durationSec: rest.durationSec ?? 120,
      nextDurationSec: rest.nextDurationSec ?? 120,
      version: rest.version ?? 0
    }
  };
}

// Cierra una sesión abandonada (sin actividad por 6 h). El fin es la ÚLTIMA ACTIVIDAD, no el momento del cierre.
async function closeIfStale(session, now) {
  if (!session || session.status !== 'active' || !isStale(session, now)) return null;
  session.status = 'auto_closed';
  session.endedAt = session.lastActivityAt;
  session.rest.state = 'idle';
  session.rest.dueAt = undefined;
  session.rest.remainingSec = undefined;
  await session.save();
  return session;
}

// Citas de entrenamiento de hoy y de ayer (por si el bloque cruzó la medianoche) del paciente
async function candidateAppointments(patientId, now) {
  const p = santiagoParts(now);
  // Las citas guardan el día calendario a medianoche UTC
  const dayStart = new Date(Date.UTC(p.year, p.month - 1, p.day - 1));
  const dayEnd = new Date(Date.UTC(p.year, p.month - 1, p.day + 1, 23, 59, 59));
  return Appointment.find({ patient: patientId, type: 'entrenamiento', status: 'scheduled', date: { $gte: dayStart, $lte: dayEnd } })
    .select('_id type status date startTime endTime')
    .lean();
}

// @desc    Sesión activa del paciente (si hay) y si puede iniciar una; incluye la hora del servidor para calibrar el reloj
// @route   GET /api/workouts/active
// @access  Private/Patient
export const getActive = async (req, res) => {
  try {
    const now = new Date();
    let session = await WorkoutSession.findOne({ patient: req.user._id, status: 'active' });
    let closedStale = false;
    if (session && (await closeIfStale(session, now))) {
      closedStale = true;
      session = null;
    }

    let startable = null;
    if (!session) {
      const found = pickStartable(await candidateAppointments(req.user._id, now), now);
      if (found) startable = { appointmentId: String(found.appointment._id), phase: found.phase, startTime: found.appointment.startTime, endTime: found.appointment.endTime };
    }

    res.status(200).json({ success: true, data: { serverNow: now, session: session ? sessionView(session, now) : null, startable, closedStale } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'No se pudo consultar tu entrenamiento' });
  }
};

// @desc    Iniciar el entrenamiento (el inicio es el instante en que se pulsa el botón)
// @route   POST /api/workouts/start   { appointmentId, clientId }
// @access  Private/Patient
export const startWorkout = async (req, res) => {
  try {
    const now = new Date();
    const { appointmentId, clientId } = req.body ?? {};
    if (typeof clientId !== 'string' || clientId.length < 8 || clientId.length > 80) {
      return res.status(400).json({ success: false, message: 'Falta el identificador del inicio' });
    }
    if (!mongoose.isValidObjectId(appointmentId)) {
      return res.status(400).json({ success: false, message: 'Cita no válida' });
    }

    // Reintento del mismo inicio, o ya hay una sesión activa: se devuelve la existente (nunca se crea otra)
    let existing = await WorkoutSession.findOne({ patient: req.user._id, status: 'active' });
    if (existing && (await closeIfStale(existing, now))) existing = null;
    if (existing) return res.status(200).json({ success: true, data: { serverNow: now, session: sessionView(existing, now), resumed: true } });
    const sameStart = await WorkoutSession.findOne({ patient: req.user._id, clientId });
    if (sameStart) return res.status(200).json({ success: true, data: { serverNow: now, session: sessionView(sameStart, now), resumed: true } });

    if (!(await hasActivePlan(req.user._id))) {
      return res.status(403).json({ success: false, message: PLAN_MESSAGE, code: 'NO_ACTIVE_PLAN_SESSIONS' });
    }

    // La cita debe ser DEL paciente, de entrenamiento, agendada y dentro de la ventana permitida
    const appointment = await Appointment.findOne({ _id: appointmentId, patient: req.user._id }).select('_id type status date startTime endTime').lean();
    if (!appointment) return res.status(404).json({ success: false, message: 'Cita no encontrada' });
    if (!pickStartable([appointment], now)) {
      return res.status(409).json({ success: false, message: 'Todavía no puedes iniciar este entrenamiento, o la cita ya no corresponde.', code: 'NOT_STARTABLE' });
    }

    try {
      const session = await WorkoutSession.create({ patient: req.user._id, appointment: appointment._id, clientId, startedAt: now, lastActivityAt: now });
      return res.status(201).json({ success: true, data: { serverNow: now, session: sessionView(session, now), resumed: false } });
    } catch (error) {
      // Dos toques casi a la vez: el índice único dejó pasar solo uno; se devuelve ese
      if (error?.code === 11000) {
        const winner = await WorkoutSession.findOne({ patient: req.user._id, status: 'active' });
        if (winner) return res.status(200).json({ success: true, data: { serverNow: now, session: sessionView(winner, now), resumed: true } });
      }
      throw error;
    }
  } catch (error) {
    res.status(500).json({ success: false, message: 'No se pudo iniciar tu entrenamiento' });
  }
};

// Sesión del propio paciente por id: de otra persona responde 404 (nunca revela que existe)
async function ownSession(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) {
    res.status(404).json({ success: false, message: 'Entrenamiento no encontrado' });
    return null;
  }
  const session = await WorkoutSession.findOne({ _id: req.params.id, patient: req.user._id });
  if (!session) {
    res.status(404).json({ success: false, message: 'Entrenamiento no encontrado' });
    return null;
  }
  return session;
}

// @desc    Acción sobre el descanso: start | pause | resume | add | skip | set_next
// @route   POST /api/workouts/:id/rest   { action, seconds?, expectedVersion? }
// @access  Private/Patient
export const restAction = async (req, res) => {
  try {
    const { action, seconds, expectedVersion } = req.body ?? {};
    if (!REST_ACTIONS.includes(action)) return res.status(400).json({ success: false, message: 'Acción de descanso desconocida' });
    if (seconds !== undefined && !Number.isInteger(seconds)) return res.status(400).json({ success: false, message: 'Los segundos deben ser un número entero' });

    const session = await ownSession(req, res);
    if (!session) return;
    const now = new Date();
    if (session.status !== 'active') return res.status(409).json({ success: false, message: 'Este entrenamiento ya terminó', code: 'NOT_ACTIVE' });

    const currentVersion = session.rest?.version ?? 0;
    if (expectedVersion !== undefined && expectedVersion !== currentVersion) {
      return res.status(409).json({ success: false, message: 'El descanso cambió en otro lugar. Mostramos el estado actual.', code: 'STALE_VERSION', data: { serverNow: now, session: sessionView(session, now) } });
    }

    const result = applyRestAction(session.rest, action, { seconds }, now);
    if (result.error) return res.status(400).json({ success: false, message: result.error, code: result.code, data: { serverNow: now, session: sessionView(session, now) } });

    // Actualización condicionada a la versión leída: dos pestañas no se pisan en silencio
    const updated = await WorkoutSession.findOneAndUpdate(
      { _id: session._id, patient: req.user._id, status: 'active', $or: [{ 'rest.version': currentVersion }, { 'rest.version': { $exists: false } }] },
      { $set: { rest: result.rest, lastActivityAt: now } },
      { new: true }
    );
    if (!updated) {
      const fresh = await WorkoutSession.findById(session._id);
      return res.status(409).json({ success: false, message: 'El descanso cambió en otro lugar. Mostramos el estado actual.', code: 'STALE_VERSION', data: { serverNow: now, session: sessionView(fresh, now) } });
    }
    res.status(200).json({ success: true, data: { serverNow: now, session: sessionView(updated, now) } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'No se pudo actualizar el descanso' });
  }
};

// @desc    Finalizar el entrenamiento (cierra también el descanso). NO toca la cita, el plan ni los cupos.
// @route   POST /api/workouts/:id/finish
// @access  Private/Patient
export const finishWorkout = async (req, res) => {
  try {
    const session = await ownSession(req, res);
    if (!session) return;
    const now = new Date();
    if (session.status !== 'active') {
      // Repetir «Finalizar» no cambia nada: devuelve lo ya cerrado
      return res.status(200).json({ success: true, data: { serverNow: now, session: sessionView(session, now), summary: summaryOf(session) } });
    }
    session.status = 'finished';
    session.endedAt = now;
    session.lastActivityAt = now;
    session.rest.state = 'idle';
    session.rest.dueAt = undefined;
    session.rest.remainingSec = undefined;
    session.rest.version = (session.rest.version ?? 0) + 1;
    await session.save();
    res.status(200).json({ success: true, data: { serverNow: now, session: sessionView(session, now), summary: summaryOf(session) } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'No se pudo finalizar tu entrenamiento' });
  }
};

// Duración real: del instante de inicio al de fin (sin tope de una hora)
const summaryOf = (session) => ({ durationSec: Math.max(0, Math.round((new Date(session.endedAt).getTime() - new Date(session.startedAt).getTime()) / 1000)) });
