import PatientGoal from '../../models/PatientGoal.js';
import GoalCheckin from '../../models/GoalCheckin.js';
import User from '../../models/User.js';
import { GOAL_CATALOG_VERSION, getCategory, getIndicator } from '../../config/goalCatalog.js';
import { ACTIVE_STATUSES, allocateSlot, hasAllTargets, requiresValidation, toNumber, validateGoalInput } from './goalRules.js';
import { computeGoalProgress, resolveBaseline } from './goalProgress.js';
import { makeSourceReader, seriesForGoals } from './goalSources.js';
import { dayOf } from '../achievements/dates.js';
import { todayInSantiago } from '../../utils/timezone.js';
import { notifyOnce } from '../notificationService.js';

/**
 * Operaciones sobre los objetivos. Todo error de negocio se lanza como GoalError({status, code, message}) para que el
 * controlador lo traduzca; nada aquí confía en el navegador: cada regla se vuelve a verificar en el servidor.
 */

export class GoalError extends Error {
  constructor(status, code, message, extra = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.extra = extra;
  }
}

const roleOf = (actor) => actor.role; // 'patient' | 'professional' | 'admin'

const entry = (actor, action, extra = {}) => ({ at: new Date(), by: actor?._id, byRole: actor ? roleOf(actor) : 'system', action, ...extra });

// ─── Lectura ────────────────────────────────────────────────────────────────

export async function viewGoals(goals, patientId, { reader = makeSourceReader(patientId) } = {}) {
  const seriesMap = await seriesForGoals(goals, reader);
  return goals.map((goal) => {
    const startedDay = dayOf(goal.startedAt);
    const progress = computeGoalProgress(goal, seriesMap, startedDay);
    const category = getCategory(goal.categoryId);
    return {
      id: String(goal._id),
      categoryId: goal.categoryId,
      categoryName: category?.name ?? goal.categoryId,
      icon: category?.icon ?? 'Target',
      priority: goal.slot === 1 ? 'primary' : goal.slot ? 'secondary' : null,
      slot: goal.slot ?? null,
      status: goal.status,
      requiresValidation: goal.requiresValidation,
      validated: !!goal.validatedBy,
      validatedAt: goal.validatedAt ?? null,
      selfDefined: goal.createdByRole === 'patient' && !goal.validatedBy,
      createdByRole: goal.createdByRole,
      startedAt: goal.startedAt,
      startedDay,
      targetDay: goal.targetDay ?? null,
      achievedAt: goal.achievedAt ?? null,
      discardReason: goal.discardReason ?? null,
      celebrate: goal.celebrate !== false,
      reminders: goal.reminders !== false,
      progress,
      // Historial: quién (solo el rol) y qué cambió. Nada se pisa en silencio.
      history: (goal.history ?? []).map((h) => ({ at: h.at, byRole: h.byRole, action: h.action, note: h.note ?? null, changes: h.changes ?? null })),
    };
  });
}

export const listGoals = (patientId) => PatientGoal.find({ patient: patientId }).sort({ slot: 1, createdAt: -1 });

// ─── Creación ───────────────────────────────────────────────────────────────

async function takenSlots(patientId) {
  const rows = await PatientGoal.find({ patient: patientId, slot: { $exists: true } }).select('slot status categoryId');
  return rows;
}

function slotConflict(rows, priority) {
  return new GoalError(409, priority === 'primary' ? 'PRIMARY_TAKEN' : 'SLOTS_FULL',
    priority === 'primary'
      ? 'Ya tienes un objetivo principal. Puedes pausarlo para elegir uno nuevo, o agregar este como secundario.'
      : 'Ya tienes tus 3 objetivos activos. Pausa uno para agregar otro; su progreso se conserva.',
    { activeGoals: rows.map((r) => ({ id: String(r._id), categoryId: r.categoryId, slot: r.slot, status: r.status })) });
}

export async function createGoal(patientId, actor, body, { reader = makeSourceReader(patientId) } = {}) {
  const checked = validateGoalInput(body);
  if (!checked.ok) throw new GoalError(400, 'INVALID_GOAL', checked.errors[0], { errors: checked.errors });
  const { category, indicators } = checked;

  const priority = body.priority === 'primary' ? 'primary' : 'secondary';
  const needsPro = requiresValidation(category, indicators);
  const status = needsPro && actor.role !== 'professional' ? 'pending_validation' : 'active';
  if (status === 'active' && needsPro && !hasAllTargets(indicators)) {
    throw new GoalError(400, 'TARGET_REQUIRED', 'Define la meta de cada indicador para activar este objetivo');
  }

  // Punto de partida: un registro real que ya exista; si no hay, queda pendiente del primer registro (nunca se inventa)
  const today = todayInSantiago();
  for (const ind of indicators) {
    const series = await reader.series(ind);
    const baseline = resolveBaseline(series, null, today);
    if (baseline) {
      ind.baseline = { value: baseline.value, day: baseline.day, refId: baseline.refId ?? undefined };
      if (ind.target) {
        const wrongWay = (ind.direction === 'increase' && ind.target.value <= baseline.value) || (ind.direction === 'decrease' && ind.target.value >= baseline.value);
        if (wrongWay) {
          throw new GoalError(400, 'TARGET_NOT_AHEAD', `La meta de «${ind.label}» debe estar ${ind.direction === 'increase' ? 'por encima' : 'por debajo'} de tu punto de partida (${baseline.value} ${ind.unit})`);
        }
      }
    }
    if (ind.target) {
      ind.targetSetBy = actor._id;
      ind.targetSetByRole = actor.role;
    }
  }

  // Reemplazo opcional: pausar uno existente para liberar su cupo (si lo que sigue falla, se reanuda)
  let paused = null;
  let pausedSlot;
  if (body.pauseGoalId) {
    paused = await PatientGoal.findOne({ _id: body.pauseGoalId, patient: patientId, slot: { $exists: true } });
    if (!paused) throw new GoalError(404, 'NOT_FOUND', 'No encontramos el objetivo que querías pausar');
    pausedSlot = paused.slot;
    await applyPause(paused, actor, 'Pausado para agregar otro objetivo');
  }

  try {
    const rows = await takenSlots(patientId);
    const alloc = allocateSlot(rows.map((r) => r.slot), priority);
    if (alloc.error) throw slotConflict(rows, priority);

    const goal = new PatientGoal({
      patient: patientId,
      categoryId: category.id,
      catalogVersion: GOAL_CATALOG_VERSION,
      slot: alloc.slot,
      status,
      indicators,
      requiresValidation: needsPro,
      createdBy: actor._id,
      createdByRole: actor.role,
      validatedBy: needsPro && actor.role === 'professional' ? actor._id : undefined,
      validatedAt: needsPro && actor.role === 'professional' ? new Date() : undefined,
      targetDay: /^\d{4}-\d{2}-\d{2}$/.test(body.targetDay ?? '') ? body.targetDay : undefined,
      celebrate: body.celebrate !== false,
      history: [entry(actor, 'created', { changes: { indicators: indicators.map((i) => ({ indicatorId: i.indicatorId, direction: i.direction, target: i.target ?? null })) } })],
    });
    if (needsPro && actor.role === 'professional') goal.history.push(entry(actor, 'validated'));
    if (status === 'pending_validation') goal.history.push(entry(actor, 'submitted_for_validation'));
    try {
      await goal.save();
    } catch (error) {
      if (error?.code === 11000) throw slotConflict(await takenSlots(patientId), priority); // otro pedido tomó el cupo en el mismo instante
      throw error;
    }
    if (status === 'pending_validation') await notifyProfessional(patientId, goal);
    return goal;
  } catch (error) {
    if (paused) await applyResume(paused, actor, pausedSlot, 'Se reanuda: no se pudo crear el objetivo nuevo').catch(() => {});
    throw error;
  }
}

async function notifyProfessional(patientId, goal) {
  try {
    const patient = await User.findById(patientId).select('assignedProfessionalId firstName lastName');
    if (!patient?.assignedProfessionalId) return;
    await notifyOnce(patient.assignedProfessionalId, 'goal_pending_validation', {
      title: 'Objetivo por validar',
      body: `${patient.firstName} ${patient.lastName} propuso un objetivo que necesita tu validación.`,
      link: `/app/admin/pacientes/${patientId}`,
      dedupeKey: `goal-pending:${goal._id}`,
    });
  } catch (error) {
    console.error('No se pudo avisar al profesional de un objetivo por validar:', error.message);
  }
}

// ─── Cambios de estado ─────────────────────────────────────────────────────

async function applyPause(goal, actor, note) {
  if (!ACTIVE_STATUSES.includes(goal.status)) throw new GoalError(409, 'NOT_ACTIVE', 'Este objetivo no está activo');
  const previous = goal.slot;
  goal.status = 'paused';
  goal.pausedAt = new Date();
  goal.slot = undefined;
  goal.history.push(entry(actor, 'paused', { note, changes: { slot: previous } }));
  await goal.save();
}

async function applyResume(goal, actor, preferredSlot, note) {
  const rows = (await takenSlots(goal.patient)).filter((r) => String(r._id) !== String(goal._id));
  const priority = preferredSlot === 1 ? 'primary' : 'secondary';
  const alloc = allocateSlot(rows.map((r) => r.slot), priority);
  if (alloc.error) throw slotConflict(rows, priority);
  goal.slot = alloc.slot;
  goal.status = goal.requiresValidation && !goal.validatedBy ? 'pending_validation' : 'active';
  goal.pausedAt = undefined;
  goal.history.push(entry(actor, 'resumed', { note }));
  try {
    await goal.save();
  } catch (error) {
    if (error?.code === 11000) throw slotConflict(await takenSlots(goal.patient), priority);
    throw error;
  }
}

export async function performAction(goal, actor, body, { reader = makeSourceReader(goal.patient) } = {}) {
  const note = typeof body.note === 'string' ? body.note.trim().slice(0, 300) : undefined;
  switch (body.action) {
    case 'pause':
      await applyPause(goal, actor, note);
      return goal;

    case 'resume':
      if (goal.status !== 'paused') throw new GoalError(409, 'NOT_PAUSED', 'Este objetivo no está pausado');
      await applyResume(goal, actor, body.priority === 'primary' ? 1 : 2, note);
      return goal;

    case 'discard': {
      if (goal.status === 'discarded' || goal.status === 'achieved') throw new GoalError(409, 'ALREADY_CLOSED', 'Este objetivo ya está cerrado');
      if (actor.role !== 'patient' && !note) throw new GoalError(400, 'REASON_REQUIRED', 'Indica el motivo para descartar el objetivo');
      goal.status = 'discarded';
      goal.discardedAt = new Date();
      goal.discardReason = note;
      goal.slot = undefined;
      goal.history.push(entry(actor, 'discarded', { note }));
      await goal.save();
      return goal;
    }

    case 'validate': {
      // Solo un profesional valida metas clínicas: ni el paciente ni el administrador
      if (actor.role !== 'professional') throw new GoalError(403, 'PROFESSIONAL_ONLY', 'Solo un profesional puede validar este objetivo');
      if (goal.status !== 'pending_validation') throw new GoalError(409, 'NOT_PENDING', 'Este objetivo no está pendiente de validación');
      await applyTargets(goal, actor, body.targets, reader, { allowAll: true });
      if (!hasAllTargets(goal.indicators)) throw new GoalError(400, 'TARGET_REQUIRED', 'Define la meta de cada indicador antes de validar');
      goal.status = 'active';
      goal.validatedBy = actor._id;
      goal.validatedAt = new Date();
      goal.history.push(entry(actor, 'validated', { note }));
      await goal.save();
      return goal;
    }

    case 'update_target': {
      if (goal.status === 'discarded' || goal.status === 'achieved') throw new GoalError(409, 'ALREADY_CLOSED', 'Este objetivo ya está cerrado');
      // Una meta clínica solo la cambia un profesional; si el paciente toca una validada, vuelve a validación (no se debilita en silencio)
      if (goal.requiresValidation && actor.role === 'admin') throw new GoalError(403, 'PROFESSIONAL_ONLY', 'Solo un profesional puede cambiar una meta clínica');
      const changed = await applyTargets(goal, actor, body.targets, reader, { note });
      if (!changed) throw new GoalError(400, 'NO_CHANGE', 'No hay cambios en la meta');
      if (actor.role === 'patient' && goal.requiresValidation && goal.status === 'active') {
        goal.status = 'pending_validation';
        goal.validatedBy = undefined;
        goal.validatedAt = undefined;
        goal.history.push(entry(actor, 'submitted_for_validation', { note: 'Cambió la meta: queda pendiente de validación' }));
      }
      await goal.save();
      if (goal.status === 'pending_validation') await notifyProfessional(goal.patient, goal);
      return goal;
    }

    case 'make_primary': {
      if (!ACTIVE_STATUSES.includes(goal.status)) throw new GoalError(409, 'NOT_ACTIVE', 'Solo un objetivo activo puede ser el principal');
      if (goal.slot === 1) throw new GoalError(409, 'ALREADY_PRIMARY', 'Este objetivo ya es el principal');
      const rows = await takenSlots(goal.patient);
      const current = rows.find((r) => r.slot === 1 && String(r._id) !== String(goal._id));
      const previousSlot = goal.slot;
      if (!current) {
        goal.slot = 1;
        goal.history.push(entry(actor, 'priority_changed', { note, changes: { from: previousSlot, to: 1 } }));
        try {
          await goal.save();
        } catch (error) {
          if (error?.code === 11000) throw slotConflict(await takenSlots(goal.patient), 'primary');
          throw error;
        }
        return goal;
      }
      // Intercambio: el principal actual pasa al cupo de este objetivo (se libera uno y luego se ocupa el otro, en ese orden)
      const other = await PatientGoal.findById(current._id);
      if (!other) throw new GoalError(409, 'CONFLICT', 'Reintenta: los objetivos cambiaron');
      other.slot = undefined;
      await other.save();
      try {
        goal.slot = 1;
        goal.history.push(entry(actor, 'priority_changed', { note, changes: { from: previousSlot, to: 1 } }));
        await goal.save();
        other.slot = previousSlot;
        other.history.push(entry(actor, 'priority_changed', { note: 'Pasó a secundario al elegir otro principal', changes: { from: 1, to: previousSlot } }));
        await other.save();
      } catch (error) {
        // Si algo falla, el principal anterior recupera su lugar
        goal.slot = previousSlot;
        await goal.save().catch(() => {});
        other.slot = 1;
        await other.save().catch(() => {});
        throw error?.code === 11000 ? slotConflict(await takenSlots(goal.patient), 'primary') : error;
      }
      return goal;
    }

    case 'update_settings': {
      if (typeof body.celebrate === 'boolean') goal.celebrate = body.celebrate;
      if (typeof body.reminders === 'boolean') goal.reminders = body.reminders;
      if (body.targetDay === null) goal.targetDay = undefined;
      else if (typeof body.targetDay === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.targetDay)) goal.targetDay = body.targetDay;
      await goal.save();
      return goal;
    }

    default:
      throw new GoalError(400, 'BAD_ACTION', 'Acción no reconocida');
  }
}

// Cambia metas indicador por indicador dejando SIEMPRE el valor anterior en el historial. Devuelve true si algo cambió.
async function applyTargets(goal, actor, targets, reader, { note, allowAll = false } = {}) {
  if (!Array.isArray(targets) || targets.length === 0) return false;
  let changed = false;
  for (const t of targets) {
    const ind = goal.indicators.find((i) => i.seriesKey === t?.seriesKey);
    if (!ind) throw new GoalError(400, 'UNKNOWN_INDICATOR', 'Uno de los indicadores no pertenece a este objetivo');
    const def = getIndicator(ind.indicatorId);
    const value = toNumber(t.value);
    if (value === null || value < def.range.min || value > def.range.max) throw new GoalError(400, 'INVALID_TARGET', `La meta de «${ind.label}» debe estar entre ${def.range.min} y ${def.range.max} ${ind.unit}`);
    const target = { value };
    if (ind.direction === 'maintain') {
      const tolerance = toNumber(t.tolerance);
      if (tolerance === null || tolerance <= 0) throw new GoalError(400, 'INVALID_TARGET', `Para mantener «${ind.label}» indica un margen mayor que 0`);
      target.tolerance = tolerance;
    }
    const baseline = ind.baseline?.value !== undefined && ind.baseline?.value !== null ? ind.baseline : resolveBaseline(await reader.series(ind), null, dayOf(goal.startedAt));
    if (baseline && ((ind.direction === 'increase' && value <= baseline.value) || (ind.direction === 'decrease' && value >= baseline.value))) {
      throw new GoalError(400, 'TARGET_NOT_AHEAD', `La meta de «${ind.label}» debe estar ${ind.direction === 'increase' ? 'por encima' : 'por debajo'} del punto de partida (${baseline.value} ${ind.unit})`);
    }
    const before = ind.target?.value !== undefined && ind.target?.value !== null ? { value: ind.target.value, tolerance: ind.target.tolerance } : null;
    if (before && before.value === target.value && (before.tolerance ?? null) === (target.tolerance ?? null)) continue;
    ind.target = target;
    ind.targetSetBy = actor._id;
    ind.targetSetByRole = actor.role;
    goal.history.push(entry(actor, 'target_changed', { note, changes: { seriesKey: ind.seriesKey, from: before, to: target } }));
    changed = true;
  }
  if (changed) goal.markModified('indicators');
  return changed || allowAll;
}

// ─── Registros manuales ────────────────────────────────────────────────────

export async function addCheckin(goal, actor, body) {
  const ind = goal.indicators.find((i) => i.seriesKey === body?.seriesKey);
  if (!ind) throw new GoalError(400, 'UNKNOWN_INDICATOR', 'Ese indicador no pertenece a este objetivo');
  if (ind.source !== 'checkin') throw new GoalError(400, 'NOT_MANUAL', 'Este indicador se alimenta solo de tus registros: no necesitas ingresarlo aquí');
  if (!['active', 'pending_validation'].includes(goal.status)) throw new GoalError(409, 'NOT_ACTIVE', 'Reanuda el objetivo para registrar valores');
  const def = getIndicator(ind.indicatorId);
  // Lo que mide el profesional solo lo ingresa un profesional; el paciente nunca escribe como si fuera una evaluación clínica
  if (def.professionalEntryOnly && actor.role === 'patient') throw new GoalError(403, 'PROFESSIONAL_ONLY', 'Este valor lo registra tu profesional');
  const value = toNumber(body.value);
  if (value === null || value < def.range.min || value > def.range.max) throw new GoalError(400, 'INVALID_VALUE', `El valor debe estar entre ${def.range.min} y ${def.range.max} ${ind.unit}`);
  const today = todayInSantiago();
  const day = /^\d{4}-\d{2}-\d{2}$/.test(body.day ?? '') ? body.day : today;
  if (day > today) throw new GoalError(400, 'FUTURE_DATE', 'La fecha no puede ser futura');
  const clientId = typeof body.clientId === 'string' ? body.clientId.slice(0, 80) : undefined;
  try {
    return await GoalCheckin.create({
      patient: goal.patient,
      seriesKey: ind.seriesKey,
      indicatorId: ind.indicatorId,
      value,
      unit: ind.unit,
      day,
      source: actor.role === 'patient' ? 'self_report' : 'professional',
      recordedBy: actor._id,
      note: typeof body.note === 'string' ? body.note.trim().slice(0, 300) : undefined,
      clientId,
    });
  } catch (error) {
    if (error?.code === 11000) return GoalCheckin.findOne({ patient: goal.patient, clientId }); // reintento: ya estaba guardado
    throw error;
  }
}
