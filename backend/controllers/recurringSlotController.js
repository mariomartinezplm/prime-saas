import RecurringSlot, { RECURRING_TYPES } from '../models/RecurringSlot.js';
import User from '../models/User.js';
import Availability from '../models/Availability.js';
import { canAccessPatient } from '../middleware/auth.js';
import { getActivePlanByType } from '../services/clientPlanService.js';
import { syncSlot, MAX_RECURRING_SLOTS, formatDateEs } from '../services/recurringSlotService.js';

// Horario fijo semanal (ver services/recurringSlotService.js). Autorización en el servidor, siempre:
//   · el paciente solo ve y toca SUS horarios;
//   · el personal solo los de pacientes a los que puede acceder (404 si no, para no confirmar que existen).

const NOT_FOUND = { success: false, message: 'Horario no encontrado' };
const TIME_RE = /^([01]?\d|2[0-3]):[0-5]\d$/;
const isStaff = (user) => ['admin', 'professional'].includes(user.role);

// Lo que sale hacia la pantalla: lista cerrada (nada interno: ni quién lo creó ni avisos enviados)
export const toSlotView = (slot) => {
  const source = typeof slot.toObject === 'function' ? slot.toObject() : slot;
  return {
    _id: source._id,
    patient: source.patient,
    professional: source.professional,
    dayOfWeek: source.dayOfWeek,
    startTime: source.startTime,
    type: source.type,
    active: source.active,
    skipped: (source.skipped || []).filter((s) => s.code !== 'ALREADY_BOOKED').map((s) => ({ date: s.date, code: s.code, label: formatDateEs(s.date) })),
    createdAt: source.createdAt
  };
};

// Carga el horario y comprueba que quien pregunta puede tocarlo. Devuelve el horario o null (y ya respondió 404).
async function loadOwnedSlot(req, res) {
  const slot = await RecurringSlot.findById(req.params.id);
  if (!slot) {
    res.status(404).json(NOT_FOUND);
    return null;
  }
  const allowed = req.user.role === 'patient'
    ? String(slot.patient) === String(req.user._id)
    : await canAccessPatient(req.user, slot.patient);
  if (!allowed) {
    res.status(404).json(NOT_FOUND);
    return null;
  }
  return slot;
}

const populateSlots = (query) => query.populate('professional', 'firstName lastName');

// @route GET /api/recurring-slots/patient/me  y  /patient/:patientId
export const getPatientSlots = async (req, res) => {
  try {
    const patientId = req.params.patientId && req.params.patientId !== 'me' ? req.params.patientId : req.user._id;
    if (req.user.role === 'patient' && String(patientId) !== String(req.user._id)) {
      return res.status(404).json(NOT_FOUND);
    }
    const slots = await populateSlots(RecurringSlot.find({ patient: patientId }).sort({ dayOfWeek: 1 }));
    res.json({ success: true, data: { slots: slots.map(toSlotView) } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'No se pudieron cargar los horarios fijos' });
  }
};

// @route POST /api/recurring-slots   { dayOfWeek, startTime, type, patient? (solo personal) }
export const createSlot = async (req, res) => {
  try {
    const { dayOfWeek, startTime, type } = req.body;
    const patientId = req.user.role === 'patient' ? req.user._id : req.body.patient;

    if (isStaff(req.user) && !(await canAccessPatient(req.user, patientId))) {
      return res.status(404).json({ success: false, message: 'Paciente no encontrado' });
    }
    const patient = await User.findById(patientId).select('role isActive assignedProfessionalId');
    if (!patient || patient.role !== 'patient' || patient.isActive === false) {
      return res.status(404).json({ success: false, message: 'Paciente no encontrado' });
    }

    if (!Number.isInteger(dayOfWeek) || dayOfWeek < 1 || dayOfWeek > 6) {
      return res.status(400).json({ success: false, message: 'Elige un día de lunes a sábado' });
    }
    if (typeof startTime !== 'string' || !TIME_RE.test(startTime)) {
      return res.status(400).json({ success: false, message: 'La hora no es válida' });
    }
    if (!RECURRING_TYPES.includes(type)) {
      return res.status(400).json({ success: false, message: 'El tipo de sesión no es válido' });
    }

    // Cada paciente agenda con su profesional fijo
    const professionalId = patient.assignedProfessionalId;
    if (!professionalId) {
      return res.status(400).json({ success: false, message: 'Este paciente todavía no tiene un profesional asignado' });
    }

    // Debe tener un plan vigente de ESE tipo (si no, no hay días a los que agendar)
    const plan = await getActivePlanByType(patientId, type);
    if (!plan) {
      return res.status(403).json({
        success: false,
        code: 'NO_ACTIVE_PLAN_SESSIONS',
        message: 'Para dejar un horario fijo necesitas un plan vigente. Contacta a Prime F&H para renovar.'
      });
    }

    // La hora debe estar dentro de la atención semanal del profesional (se comprueba con una fecha de ese día de la semana)
    const availability = await Availability.findOne({ professional: professionalId }).lean();
    const hasThatHour = !!availability?.weeklySchedule?.some((d) => d.dayOfWeek === dayOfWeek && d.slots.some((s) => s.startTime === startTime));
    if (!hasThatHour) {
      return res.status(400).json({ success: false, message: 'Ese horario no está dentro de la atención de tu profesional. Elige otro.' });
    }

    if ((await RecurringSlot.countDocuments({ patient: patientId })) >= MAX_RECURRING_SLOTS) {
      return res.status(409).json({ success: false, message: `Puedes tener hasta ${MAX_RECURRING_SLOTS} horarios fijos. Quita uno para agregar otro.` });
    }

    let slot;
    try {
      slot = await RecurringSlot.create({ patient: patientId, professional: professionalId, dayOfWeek, startTime, type, createdBy: req.user._id });
    } catch (error) {
      if (error?.code === 11000) {
        return res.status(409).json({ success: false, message: 'Ya tienes un horario fijo ese día de la semana.' });
      }
      throw error;
    }

    // Se agenda de inmediato lo que falte del plan vigente (sin avisos: la persona está mirando la pantalla)
    const sync = await syncSlot(slot, { silent: true });
    await slot.populate('professional', 'firstName lastName');

    res.status(201).json({
      success: true,
      message: 'Horario fijo guardado',
      data: {
        slot: toSlotView(slot),
        created: sync.created,
        skipped: sync.skipped.filter((s) => s.code !== 'ALREADY_BOOKED').map((s) => ({ ...s, label: formatDateEs(s.date) })),
        pendingPayment: sync.pendingPayment
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'No se pudo guardar el horario fijo' });
  }
};

// @route PUT /api/recurring-slots/:id   { active }  → pausar o reanudar
export const updateSlot = async (req, res) => {
  try {
    const slot = await loadOwnedSlot(req, res);
    if (!slot) return;
    if (typeof req.body.active !== 'boolean') {
      return res.status(400).json({ success: false, message: 'Indica si el horario queda activo o en pausa' });
    }

    slot.active = req.body.active;
    await slot.save();

    let sync = null;
    if (slot.active) sync = await syncSlot(slot, { silent: true });
    await slot.populate('professional', 'firstName lastName');

    res.json({
      success: true,
      message: slot.active ? 'Horario fijo reanudado' : 'Horario fijo en pausa',
      data: {
        slot: toSlotView(slot),
        created: sync?.created ?? [],
        skipped: (sync?.skipped ?? []).filter((s) => s.code !== 'ALREADY_BOOKED').map((s) => ({ ...s, label: formatDateEs(s.date) })),
        pendingPayment: sync?.pendingPayment ?? 0
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'No se pudo actualizar el horario fijo' });
  }
};

// @route DELETE /api/recurring-slots/:id   (las citas ya agendadas se mantienen)
export const deleteSlot = async (req, res) => {
  try {
    const slot = await loadOwnedSlot(req, res);
    if (!slot) return;
    await slot.deleteOne();
    res.json({ success: true, message: 'Horario fijo eliminado. Las citas ya agendadas se mantienen.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'No se pudo eliminar el horario fijo' });
  }
};
