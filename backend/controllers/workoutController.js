import mongoose from 'mongoose';
import WorkoutSession from '../models/WorkoutSession.js';
import Appointment from '../models/Appointment.js';
import ExerciseProgress from '../models/Exercise.js';
import { hasActivePlan } from '../services/clientPlanService.js';
import { notify } from '../services/notificationService.js';
import { triggerAchievementEvaluation } from '../services/achievements/index.js';
import { exerciseHistory, resolveCanonicalName, searchExercises as searchHistory } from '../services/exerciseNames.js';
import { validateBlockInput, validateSetInput, buildSummary, sessionRecords, nextLabel, slotId, MAX_SETS_PER_BATCH } from '../services/workoutSets.js';
import { dayOf } from '../services/achievements/dates.js';
import { santiagoParts, santiagoToUtc } from '../utils/timezone.js';
import { applyRestAction, settle, remainingSec, pickStartable, isStale, REST_ACTIONS } from '../services/workoutService.js';

/**
 * Entrenamiento en curso — Incremento 1: sesión activa y relojes.
 *
 * Esta función es un REGISTRO PERSONAL del paciente. Nunca modifica la cita ni el plan, no descuenta sesiones, no toca
 * los cupos y no concede logros: solo lee la cita para saber cuándo se puede iniciar.
 */

const PLAN_MESSAGE = 'Tu plan venció o no tienes un plan activo. Contacta a Prime F&H para renovar antes de iniciar un entrenamiento.';

// Una serie guardada tal como la ve la pantalla
export const setView = (e) => ({
  id: String(e._id),
  blockId: e.blockId ?? null,
  slot: e.slot ?? null,
  exerciseName: e.exerciseName,
  setNumber: e.setNumber ?? null,
  reps: e.reps ?? null,
  weight: e.weight ?? null,
  weightUnit: e.weightUnit ?? 'kg',
  durationSec: e.durationSec ?? null,
  modality: e.modality ?? null,
  clientId: e.clientId ?? null,
  createdAt: e.createdAt ?? e.date
});

// Lo que sale hacia la pantalla: instantes, el estado del descanso ya "asentado", los bloques y las series de ESTA sesión
export function sessionView(session, now = new Date(), sets = []) {
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
    },
    blocks: (session.blocks ?? []).map((b) => ({ blockId: b.blockId, kind: b.kind, label: b.label, slots: (b.slots ?? []).map((x) => ({ slot: x.slot, exerciseName: x.exerciseName, modality: x.modality })) })),
    sets: sets.map(setView)
  };
}

// Mediodía de Chile del día de `now` (las fechas de evolución se guardan así, ver achievements/dates.js)
export const dayAtNoon = (now) => {
  const p = santiagoParts(now);
  return santiagoToUtc(p.year, p.month, p.day, 12);
};

const SET_FIELDS = '_id blockId slot exerciseName setNumber reps weight weightUnit durationSec modality clientId createdAt date';
const loadSets = (session) => ExerciseProgress.find({ workoutSession: session._id }).sort({ createdAt: 1 }).select(SET_FIELDS).lean();
// Vista completa de una sesión (con sus series)
// Resumen completo: lo guardado + las marcas personales logradas hoy (comparadas con DÍAS anteriores, solo kg)
async function summaryFor(session, sets) {
  const summary = buildSummary(session, sets);
  const withLoad = sets.some((s) => s.weight > 0);
  const previous = withLoad
    ? await ExerciseProgress.find({ patient: session.patient, workoutSession: { $ne: session._id }, weight: { $gt: 0 } }).sort({ date: -1 }).limit(3000).select('exerciseName weight weightUnit date').lean()
    : [];
  return { ...summary, records: sessionRecords(sets, previous ?? [], dayOf(session.startedAt), dayOf) };
}

const viewOf = async (session, now) => sessionView(session, now, await loadSets(session));

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

    res.status(200).json({ success: true, data: { serverNow: now, session: session ? await viewOf(session, now) : null, startable, closedStale } });
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
    if (existing) return res.status(200).json({ success: true, data: { serverNow: now, session: await viewOf(existing, now), resumed: true } });
    const sameStart = await WorkoutSession.findOne({ patient: req.user._id, clientId });
    if (sameStart) return res.status(200).json({ success: true, data: { serverNow: now, session: await viewOf(sameStart, now), resumed: true } });

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
      return res.status(201).json({ success: true, data: { serverNow: now, session: await viewOf(session, now), resumed: false } });
    } catch (error) {
      // Dos toques casi a la vez: el índice único dejó pasar solo uno; se devuelve ese
      if (error?.code === 11000) {
        const winner = await WorkoutSession.findOne({ patient: req.user._id, status: 'active' });
        if (winner) return res.status(200).json({ success: true, data: { serverNow: now, session: await viewOf(winner, now), resumed: true } });
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
      return res.status(409).json({ success: false, message: 'El descanso cambió en otro lugar. Mostramos el estado actual.', code: 'STALE_VERSION', data: { serverNow: now, session: await viewOf(session, now) } });
    }

    const result = applyRestAction(session.rest, action, { seconds }, now);
    if (result.error) return res.status(400).json({ success: false, message: result.error, code: result.code, data: { serverNow: now, session: await viewOf(session, now) } });

    // Actualización condicionada a la versión leída: dos pestañas no se pisan en silencio
    const updated = await WorkoutSession.findOneAndUpdate(
      { _id: session._id, patient: req.user._id, status: 'active', $or: [{ 'rest.version': currentVersion }, { 'rest.version': { $exists: false } }] },
      { $set: { rest: result.rest, lastActivityAt: now } },
      { new: true }
    );
    if (!updated) {
      const fresh = await WorkoutSession.findById(session._id);
      return res.status(409).json({ success: false, message: 'El descanso cambió en otro lugar. Mostramos el estado actual.', code: 'STALE_VERSION', data: { serverNow: now, session: await viewOf(fresh, now) } });
    }
    res.status(200).json({ success: true, data: { serverNow: now, session: await viewOf(updated, now) } });
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
    let justClosed = false;
    if (session.status === 'active') {
      session.status = 'finished';
      session.endedAt = now;
      session.lastActivityAt = now;
      session.rest.state = 'idle';
      session.rest.dueAt = undefined;
      session.rest.remainingSec = undefined;
      session.rest.version = (session.rest.version ?? 0) + 1;
      await session.save();
      justClosed = true;
    }
    // Repetir «Finalizar» no cambia nada: devuelve lo ya cerrado
    const sets = await loadSets(session);
    const summary = await summaryFor(session, sets);
    // UN solo aviso al profesional por entrenamiento (no uno por serie), sin cifras de salud en el texto
    if (justClosed && sets.length > 0) notifyProfessional(req.user, sets.length);
    res.status(200).json({ success: true, data: { serverNow: now, session: sessionView(session, now, sets), summary } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'No se pudo finalizar tu entrenamiento' });
  }
};

function notifyProfessional(user, setCount) {
  if (!user.assignedProfessionalId) return;
  notify(user.assignedProfessionalId, 'evolution_updated', {
    title: 'Entrenamiento registrado',
    body: `${user.firstName} ${user.lastName} registró un entrenamiento con ${setCount} ${setCount === 1 ? 'serie' : 'series'}.`,
    link: `/app/admin/pacientes/${user._id}`
  }).catch((error) => console.error('Error al avisar el entrenamiento al profesional:', error.message));
}

// @desc    Resumen de lo realmente guardado en una sesión
// @route   GET /api/workouts/:id/summary
// @access  Private/Patient
export const getSummary = async (req, res) => {
  try {
    const session = await ownSession(req, res);
    if (!session) return;
    const sets = await loadSets(session);
    res.status(200).json({ success: true, data: { summary: await summaryFor(session, sets) } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'No se pudo obtener el resumen' });
  }
};

// @desc    Buscar ejercicios en el HISTORIAL del propio paciente: recientes, frecuentes y coincidencias
// @route   GET /api/workouts/exercises/search?q=
// @access  Private/Patient
export const searchExercises = async (req, res) => {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q.slice(0, 60) : '';
    // La referencia «última vez» no incluye lo que ya se guardó en la sesión de hoy
    const active = await WorkoutSession.findOne({ patient: req.user._id, status: 'active' }).select('_id');
    res.status(200).json({ success: true, data: searchHistory(await exerciseHistory(req.user._id, { excludeSession: active?._id }), q) });
  } catch (error) {
    res.status(500).json({ success: false, message: 'No se pudo buscar tus ejercicios' });
  }
};

// @desc    Agregar un bloque (individual, superserie o triserie). Los ejercicios que ya existen en el historial conservan su identidad.
// @route   POST /api/workouts/:id/blocks   { blockId, kind, slots:[{ exerciseName, modality }] }
// @access  Private/Patient
export const addBlock = async (req, res) => {
  try {
    const session = await ownSession(req, res);
    if (!session) return;
    const now = new Date();
    if (session.status !== 'active') return res.status(409).json({ success: false, message: 'Este entrenamiento ya terminó', code: 'NOT_ACTIVE' });

    // Reintento del mismo bloque: se devuelve la sesión tal como está
    if (req.body?.blockId && (session.blocks ?? []).some((b) => b.blockId === req.body.blockId)) {
      return res.status(200).json({ success: true, data: { serverNow: now, session: await viewOf(session, now), resumed: true } });
    }
    const parsed = validateBlockInput(req.body, session.blocks ?? []);
    if (parsed.error) return res.status(400).json({ success: false, message: parsed.error });

    const history = await exerciseHistory(req.user._id);
    const label = nextLabel(session.blocks ?? []);
    if (!label) return res.status(400).json({ success: false, message: 'Alcanzaste el máximo de bloques de esta sesión' });

    const slots = [];
    for (const [index, slot] of parsed.slots.entries()) {
      const resolved = await resolveCanonicalName(req.user._id, slot.exerciseName, history);
      if (!resolved) return res.status(400).json({ success: false, message: 'Escribe un nombre de ejercicio válido (entre 2 y 60 caracteres)' });
      slots.push({ slot: slotId(label, index), exerciseName: resolved.name, modality: slot.modality });
    }
    const keys = new Set(slots.map((x) => x.exerciseName.toLowerCase()));
    if (keys.size !== slots.length) return res.status(400).json({ success: false, message: 'Un bloque no puede repetir el mismo ejercicio' });

    const updated = await WorkoutSession.findOneAndUpdate(
      { _id: session._id, patient: req.user._id, status: 'active', 'blocks.blockId': { $ne: parsed.blockId } },
      { $push: { blocks: { blockId: parsed.blockId, kind: parsed.kind, label, slots, createdAt: now } }, $set: { lastActivityAt: now } },
      { new: true }
    );
    const fresh = updated ?? (await WorkoutSession.findById(session._id));
    res.status(updated ? 201 : 200).json({ success: true, data: { serverNow: now, session: await viewOf(fresh, now), resumed: !updated } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'No se pudo agregar el bloque' });
  }
};

// @desc    Guardar series de un bloque (por lote e idempotente). Cada serie es UNA fila del historial de Ejercicios.
// @route   POST /api/workouts/:id/sets   { blockId, sets:[{ clientId, slot, reps?, weight?, weightUnit?, durationSec?, setNumber? }] }
// @access  Private/Patient
export const saveSets = async (req, res) => {
  try {
    const session = await ownSession(req, res);
    if (!session) return;
    const now = new Date();
    if (session.status !== 'active') return res.status(409).json({ success: false, message: 'Este entrenamiento ya terminó', code: 'NOT_ACTIVE' });

    const { blockId, sets } = req.body ?? {};
    const block = (session.blocks ?? []).find((b) => b.blockId === blockId);
    if (!block) return res.status(404).json({ success: false, message: 'Bloque no encontrado' });
    if (!Array.isArray(sets) || sets.length < 1 || sets.length > MAX_SETS_PER_BATCH) {
      return res.status(400).json({ success: false, message: `Envía entre 1 y ${MAX_SETS_PER_BATCH} series` });
    }

    // Se valida TODO antes de guardar algo: un lote con un dato inválido no guarda nada
    const clean = [];
    const seen = new Set();
    for (const input of sets) {
      const slotDef = block.slots.find((x) => x.slot === input?.slot);
      if (!slotDef) return res.status(400).json({ success: false, message: 'Ejercicio del bloque no válido' });
      if (seen.has(`${input.slot}`)) return res.status(400).json({ success: false, message: 'Cada ejercicio se guarda una vez por vuelta' });
      seen.add(`${input.slot}`);
      const parsed = validateSetInput(input, slotDef);
      if (parsed.error) return res.status(400).json({ success: false, message: parsed.error });
      clean.push({ input, slotDef, value: parsed.value });
    }

    // Registrar evolución exige plan activo (misma regla que el registro de ejercicios de siempre)
    if (!(await hasActivePlan(req.user._id))) {
      return res.status(403).json({ success: false, message: PLAN_MESSAGE.replace('iniciar un entrenamiento', 'registrar ejercicios'), code: 'NO_ACTIVE_PLAN_SESSIONS' });
    }

    const saved = [];
    for (const { input, slotDef, value } of clean) {
      // Idempotencia: el mismo clientId nunca crea una segunda fila
      const existing = await ExerciseProgress.findOne({ patient: req.user._id, clientId: input.clientId }).select(SET_FIELDS).lean();
      if (existing) {
        saved.push({ clientId: input.clientId, created: false, set: setView(existing) });
        continue;
      }
      const setNumber = input.setNumber ?? (await ExerciseProgress.countDocuments({ workoutSession: session._id, slot: slotDef.slot })) + 1;
      try {
        const doc = await ExerciseProgress.create({
          patient: req.user._id,
          recordedBy: req.user._id,
          exerciseName: slotDef.exerciseName,
          category: 'fuerza',
          // Como el resto de la evolución: el DÍA de Chile al mediodía, para que ningún lector (UTC o Chile) lo corra al día siguiente
          date: dayAtNoon(now),
          sets: 1,
          reps: value.reps,
          weight: value.weight,
          weightUnit: value.unit,
          duration: value.durationSec ? Math.round((value.durationSec / 60) * 100) / 100 : undefined,
          durationSec: value.durationSec,
          modality: slotDef.modality,
          source: 'workout',
          workoutSession: session._id,
          blockId: block.blockId,
          blockKind: block.kind,
          slot: slotDef.slot,
          setNumber,
          clientId: input.clientId
        });
        saved.push({ clientId: input.clientId, created: true, set: setView(doc) });
      } catch (error) {
        // Dos envíos casi simultáneos del mismo clientId: gana uno y el otro recibe esa misma serie
        if (error?.code !== 11000) throw error;
        const winner = await ExerciseProgress.findOne({ patient: req.user._id, clientId: input.clientId }).select(SET_FIELDS).lean();
        saved.push({ clientId: input.clientId, created: false, set: setView(winner) });
      }
    }

    await WorkoutSession.updateOne({ _id: session._id, status: 'active' }, { $set: { lastActivityAt: now } });
    // Una sola evaluación de logros por lote (primer registro, récords por días distintos): nunca tumba el guardado
    if (saved.some((x) => x.created)) triggerAchievementEvaluation(req.user._id).catch(() => {});
    const fresh = await WorkoutSession.findById(session._id);
    res.status(200).json({ success: true, data: { serverNow: now, saved, session: await viewOf(fresh, now) } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'No se pudieron guardar las series' });
  }
};

// Serie de ESTE paciente que pertenece a una sesión suya todavía activa (corregir o borrar solo mientras entrena)
async function ownActiveSet(req, res) {
  if (!mongoose.isValidObjectId(req.params.setId)) {
    res.status(404).json({ success: false, message: 'Serie no encontrada' });
    return null;
  }
  const doc = await ExerciseProgress.findOne({ _id: req.params.setId, patient: req.user._id, source: 'workout' });
  const session = doc?.workoutSession ? await WorkoutSession.findOne({ _id: doc.workoutSession, patient: req.user._id }) : null;
  if (!doc || !session) {
    res.status(404).json({ success: false, message: 'Serie no encontrada' });
    return null;
  }
  if (session.status !== 'active') {
    res.status(409).json({ success: false, message: 'Este entrenamiento ya terminó. Puedes corregir el registro desde Ejercicios.', code: 'NOT_ACTIVE' });
    return null;
  }
  if (!(await hasActivePlan(req.user._id))) {
    res.status(403).json({ success: false, message: PLAN_MESSAGE.replace('iniciar un entrenamiento', 'corregir ejercicios'), code: 'NO_ACTIVE_PLAN_SESSIONS' });
    return null;
  }
  return { doc, session };
}

// @desc    Corregir una serie ya guardada (repeticiones, carga o tiempo)
// @route   PUT /api/workouts/sets/:setId
// @access  Private/Patient
export const updateSet = async (req, res) => {
  try {
    const found = await ownActiveSet(req, res);
    if (!found) return;
    const { doc, session } = found;
    const slotDef = { modality: doc.modality ?? 'weight' };
    const body = { reps: req.body?.reps ?? undefined, weight: req.body?.weight ?? undefined, weightUnit: req.body?.weightUnit ?? doc.weightUnit, durationSec: req.body?.durationSec ?? undefined, clientId: doc.clientId ?? 'edicion-sin-clave' };
    const parsed = validateSetInput(body, slotDef);
    if (parsed.error) return res.status(400).json({ success: false, message: parsed.error });
    const v = parsed.value;
    doc.reps = v.reps;
    doc.weight = v.weight;
    if (v.unit) doc.weightUnit = v.unit;
    doc.durationSec = v.durationSec;
    doc.duration = v.durationSec ? Math.round((v.durationSec / 60) * 100) / 100 : undefined;
    await doc.save();
    triggerAchievementEvaluation(req.user._id).catch(() => {});
    const now = new Date();
    await WorkoutSession.updateOne({ _id: session._id }, { $set: { lastActivityAt: now } });
    res.status(200).json({ success: true, data: { serverNow: now, set: setView(doc), session: await viewOf(await WorkoutSession.findById(session._id), now) } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'No se pudo corregir la serie' });
  }
};

// @desc    Eliminar una serie guardada por error mientras se entrena
// @route   DELETE /api/workouts/sets/:setId
// @access  Private/Patient
export const deleteSet = async (req, res) => {
  try {
    const found = await ownActiveSet(req, res);
    if (!found) return;
    await found.doc.deleteOne();
    triggerAchievementEvaluation(req.user._id).catch(() => {});
    const now = new Date();
    await WorkoutSession.updateOne({ _id: found.session._id }, { $set: { lastActivityAt: now } });
    res.status(200).json({ success: true, data: { serverNow: now, session: await viewOf(await WorkoutSession.findById(found.session._id), now) } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'No se pudo eliminar la serie' });
  }
};
