import Appointment from '../models/Appointment.js';
import Plan from '../models/Plan.js';
import User from '../models/User.js';
import { startOfDay, endOfDay, startOfWeek, endOfWeek, addDays, parseISO, format, isBefore, addHours } from 'date-fns';

// ─── Constantes de reglas ────────────────────────────────────────────────────
const MAX_PATIENTS_PER_SLOT = 4;         // Máximo 4 pacientes por hora por kinesiólogo
const PATIENT_BOOK_AHEAD_HOURS = 24;     // Pacientes: mínimo 24h de anticipación para agendar
const PATIENT_CANCEL_AHEAD_HOURS = 4;    // Pacientes: mínimo 4h de anticipación para cancelar

// ─── Helper: verificar si el usuario es staff ────────────────────────────────
function isStaff(user) {
  return ['admin', 'professional'].includes(user.role);
}

// ─── Helper: contar agendamientos del paciente en una semana ─────────────────
async function countWeeklyAppointments(patientId, date, type) {
  const weekStart = startOfWeek(new Date(date), { weekStartsOn: 1 }); // Lunes
  const weekEnd = endOfWeek(new Date(date), { weekStartsOn: 1 });     // Domingo

  return await Appointment.countDocuments({
    patient: patientId,
    date: { $gte: weekStart, $lte: weekEnd },
    type: type,
    status: { $ne: 'cancelled' }
  });
}

// ─── Helper: contar total sesiones usadas de kinesiología ────────────────────
async function countKineSessions(patientId, planId) {
  return await Appointment.countDocuments({
    patient: patientId,
    type: 'kinesiologia',
    status: { $in: ['scheduled', 'completed'] }
  });
}

// ─── Helper: contar pacientes en un slot específico ──────────────────────────
async function countPatientsInSlot(professionalId, date, startTime) {
  const targetDate = new Date(date);
  return await Appointment.countDocuments({
    professional: professionalId,
    date: {
      $gte: startOfDay(targetDate),
      $lte: endOfDay(targetDate)
    },
    startTime,
    status: { $ne: 'cancelled' }
  });
}

// @desc    Crear nueva cita
// @route   POST /api/appointments
// @access  Private
export const createAppointment = async (req, res) => {
  try {
    const { professional, date, startTime, endTime, type, notes } = req.body;

    // Si es paciente, asignar automáticamente como patient
    const patientId = req.user.role === 'patient' ? req.user._id : req.body.patient;

    // Validar que el paciente existe
    const patient = await User.findById(patientId);
    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'Paciente no encontrado'
      });
    }

    // Validar que el profesional existe y tiene rol admin o professional
    const professionalUser = await User.findById(professional);
    if (!professionalUser || !['admin', 'professional'].includes(professionalUser.role)) {
      return res.status(404).json({
        success: false,
        message: 'Profesional no encontrado'
      });
    }

    // ─── Reglas solo para PACIENTES (staff puede agendar sin restricciones) ───
    const appointmentDate = new Date(date);
    const appointmentDateTime = new Date(`${appointmentDate.toISOString().split('T')[0]}T${startTime}`);
    const now = new Date();

    // No permitir citas en el pasado (para todos)
    if (isBefore(appointmentDateTime, now)) {
      return res.status(400).json({
        success: false,
        message: 'No se pueden crear citas en el pasado'
      });
    }

    if (!isStaff(req.user)) {
      // ──── REGLA 1: Pacientes deben agendar con 24h de anticipación ────
      const minBookingTime = addHours(now, PATIENT_BOOK_AHEAD_HOURS);
      if (isBefore(appointmentDateTime, minBookingTime)) {
        return res.status(400).json({
          success: false,
          message: `Las citas deben agendarse con al menos ${PATIENT_BOOK_AHEAD_HOURS} horas de anticipación`
        });
      }

      // ──── REGLA 2: Verificar plan del paciente ────
      let activePlan = await Plan.findOne({
        patient: patientId,
        status: 'active',
        endDate: { $gte: now }
      });

      // Si no hay plan en sistema, verificar si el usuario es "Activo" (ej. migrado de Airtable)
      if (!activePlan) {
        // Recargar usuario para asegurar estado actual
        const userToCheck = isStaff(req.user) ? await User.findById(patientId) : req.user;

        if (!userToCheck.isActive) {
          return res.status(400).json({
            success: false,
            message: 'Tu cuenta no está activa. Debes regularizar tu pago para poder agendar.'
          });
        }

        // Si es activo pero no tiene plan doc (ej. migrado), asignamos permisos por defecto
        activePlan = {
          planType: 'entrenamiento-3x', // Asumimos plan completo por defecto para migrados
          sessionsPerWeek: 20, // Límite alto para no bloquear
          totalSessions: 9999,
          sessionsUsed: 0
        };
      }

      // ──── REGLA 3: Validar tipo de sesión según plan ────
      if (activePlan.planType === 'kinesiologia') {
        // Solo puede agendar tipo "kinesiologia"
        if (type !== 'kinesiologia') {
          return res.status(400).json({
            success: false,
            message: 'Tu plan es de kinesiología. Solo puedes agendar sesiones de kinesiología.'
          });
        }

        // Verificar que no haya superado las sesiones
        const usedSessions = await countKineSessions(patientId);
        if (usedSessions >= activePlan.totalSessions) {
          return res.status(400).json({
            success: false,
            message: `Has completado tus ${activePlan.totalSessions} sesiones de kinesiología. Tu bono ha terminado.`
          });
        }
      } else {
        // Planes de entrenamiento: solo pueden agendar "entrenamiento"
        if (type !== 'entrenamiento') {
          return res.status(400).json({
            success: false,
            message: 'Tu plan es de entrenamiento. Solo puedes agendar sesiones de entrenamiento.'
          });
        }

        // ──── REGLA 4: Límite semanal según plan ────
        // Para usuarios migrados (isActive true sin plan), activePlan.sessionsPerWeek es alto (20), así que esto pasa
        const weeklyCount = await countWeeklyAppointments(patientId, date, 'entrenamiento');
        if (weeklyCount >= activePlan.sessionsPerWeek) {
          return res.status(400).json({
            success: false,
            message: `Ya tienes ${weeklyCount} sesiones esta semana. Tu plan permite ${activePlan.sessionsPerWeek} sesiones por semana.`
          });
        }
      }
    }

    // ──── REGLA 5: Máximo 4 pacientes por hora por kinesiólogo (para todos) ────
    const patientsInSlot = await countPatientsInSlot(professional, date, startTime);
    if (patientsInSlot >= MAX_PATIENTS_PER_SLOT) {
      return res.status(400).json({
        success: false,
        message: `El horario ${startTime} ya tiene ${MAX_PATIENTS_PER_SLOT} pacientes. Selecciona otro horario.`
      });
    }

    // Crear cita
    const appointment = await Appointment.create({
      patient: patientId,
      professional,
      date: appointmentDate,
      startTime,
      endTime,
      type: type || 'entrenamiento',
      notes
    });

    // Si es kinesiología, incrementar el contador del plan
    if (type === 'kinesiologia' && !isStaff(req.user)) {
      await Plan.findOneAndUpdate(
        { patient: patientId, status: 'active', planType: 'kinesiologia' },
        { $inc: { sessionsUsed: 1 } }
      );
    }

    // Poblar datos del paciente y profesional
    await appointment.populate('patient', 'firstName lastName email phone');
    await appointment.populate('professional', 'firstName lastName');

    res.status(201).json({
      success: true,
      message: 'Cita creada exitosamente',
      data: { appointment }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error al crear cita'
    });
  }
};

// @desc    Obtener todas las citas (admin) o citas del usuario (paciente)
// @route   GET /api/appointments
// @access  Private
export const getAppointments = async (req, res) => {
  try {
    const { status, from, to, type } = req.query;

    // Construir query
    let query = {};

    // Si es paciente, solo ver sus propias citas
    if (req.user.role === 'patient') {
      query.patient = req.user._id;
    }

    // Si es professional, ver sus citas asignadas
    if (req.user.role === 'professional') {
      query.professional = req.user._id;
    }

    // Filtrar por profesional (admin puede filtrar por cualquier profesional)
    if (req.query.professional && req.user.role === 'admin') {
      query.professional = req.query.professional;
    }

    // Filtros
    if (status) query.status = status;
    if (type) query.type = type;

    if (from || to) {
      query.date = {};
      if (from) query.date.$gte = parseISO(from);
      if (to) query.date.$lte = parseISO(to);
    }

    const appointments = await Appointment.find(query)
      .populate('patient', 'firstName lastName email phone rut')
      .populate('professional', 'firstName lastName')
      .sort({ date: 1, startTime: 1 });

    res.status(200).json({
      success: true,
      count: appointments.length,
      data: { appointments }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error al obtener citas'
    });
  }
};

// @desc    Obtener una cita por ID
// @route   GET /api/appointments/:id
// @access  Private
export const getAppointment = async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id)
      .populate('patient', 'firstName lastName email phone rut dateOfBirth medicalInfo')
      .populate('professional', 'firstName lastName')
      .populate('cancelledBy', 'firstName lastName');

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Cita no encontrada'
      });
    }

    // Verificar permisos: paciente solo puede ver sus propias citas
    if (req.user.role === 'patient' && appointment.patient._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permisos para ver esta cita'
      });
    }

    res.status(200).json({
      success: true,
      data: { appointment }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error al obtener cita'
    });
  }
};

// @desc    Cancelar una cita
// @route   PUT /api/appointments/:id/cancel
// @access  Private
export const cancelAppointment = async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id);

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Cita no encontrada'
      });
    }

    // Verificar permisos
    if (req.user.role === 'patient' && appointment.patient.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permisos para cancelar esta cita'
      });
    }

    // Verificar si ya está cancelada
    if (appointment.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: 'La cita ya está cancelada'
      });
    }

    // ──── REGLA: Pacientes deben cancelar con 4h de anticipación ────
    // Staff puede cancelar en cualquier momento
    if (!isStaff(req.user)) {
      const appointmentDateTime = new Date(`${appointment.date.toISOString().split('T')[0]}T${appointment.startTime}`);
      const now = new Date();
      const minCancelTime = addHours(now, PATIENT_CANCEL_AHEAD_HOURS);

      if (!isBefore(minCancelTime, appointmentDateTime)) {
        return res.status(400).json({
          success: false,
          message: `Las citas deben cancelarse con al menos ${PATIENT_CANCEL_AHEAD_HOURS} horas de anticipación`
        });
      }
    }

    // Actualizar estado
    appointment.status = 'cancelled';
    appointment.cancellationReason = req.body.reason || '';
    appointment.cancelledBy = req.user._id;
    appointment.cancelledAt = new Date();

    await appointment.save();

    // Si era kinesiología, devolver la sesión al plan
    if (appointment.type === 'kinesiologia') {
      await Plan.findOneAndUpdate(
        { patient: appointment.patient, status: 'active', planType: 'kinesiologia' },
        { $inc: { sessionsUsed: -1 } }
      );
    }

    res.status(200).json({
      success: true,
      message: 'Cita cancelada exitosamente',
      data: { appointment }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error al cancelar cita'
    });
  }
};

// @desc    Actualizar una cita (solo staff)
// @route   PUT /api/appointments/:id
// @access  Private/Admin
export const updateAppointment = async (req, res) => {
  try {
    const { date, startTime, endTime, type, status, notes, sessionNotes, exercisesPerformed } = req.body;

    const appointment = await Appointment.findById(req.params.id);

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Cita no encontrada'
      });
    }

    // Actualizar campos
    if (date) appointment.date = date;
    if (startTime) appointment.startTime = startTime;
    if (endTime) appointment.endTime = endTime;
    if (type) appointment.type = type;
    if (status) appointment.status = status;
    if (notes !== undefined) appointment.notes = notes;
    if (sessionNotes !== undefined) appointment.sessionNotes = sessionNotes;
    if (exercisesPerformed) appointment.exercisesPerformed = exercisesPerformed;

    await appointment.save();

    await appointment.populate('patient', 'firstName lastName email phone');
    await appointment.populate('professional', 'firstName lastName');

    res.status(200).json({
      success: true,
      message: 'Cita actualizada exitosamente',
      data: { appointment }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error al actualizar cita'
    });
  }
};

// @desc    Obtener horarios disponibles para una fecha
// @route   GET /api/appointments/availability/:professionalId/:date
// @access  Private
export const getAvailability = async (req, res) => {
  try {
    const { professionalId, date } = req.params;

    const targetDate = parseISO(date);

    // Horarios disponibles
    const weekdaySlots = [
      '07:00', '08:00', '09:00',
      '12:00', '13:00',
      '16:00', '17:00', '18:00', '19:00'
    ];

    const dayOfWeek = targetDate.getDay();

    // No hay horarios fines de semana
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return res.status(200).json({
        success: true,
        data: {
          availableSlots: [],
          message: 'No hay horarios disponibles los fines de semana'
        }
      });
    }

    // Obtener citas existentes para esa fecha
    const existingAppointments = await Appointment.find({
      professional: professionalId,
      date: {
        $gte: startOfDay(targetDate),
        $lte: endOfDay(targetDate)
      },
      status: { $ne: 'cancelled' }
    });

    // Contar pacientes por slot
    const slotCounts = {};
    existingAppointments.forEach(apt => {
      slotCounts[apt.startTime] = (slotCounts[apt.startTime] || 0) + 1;
    });

    // Un slot está disponible si tiene menos de 4 pacientes
    const availableSlots = weekdaySlots.filter(slot => {
      const count = slotCounts[slot] || 0;
      return count < MAX_PATIENTS_PER_SLOT;
    });

    // Slots con info de cuántos quedan
    const slotsWithAvailability = weekdaySlots.map(slot => ({
      time: slot,
      booked: slotCounts[slot] || 0,
      available: MAX_PATIENTS_PER_SLOT - (slotCounts[slot] || 0),
      isFull: (slotCounts[slot] || 0) >= MAX_PATIENTS_PER_SLOT
    }));

    res.status(200).json({
      success: true,
      data: {
        date: format(targetDate, 'yyyy-MM-dd'),
        availableSlots,
        slotsWithAvailability,
        maxPerSlot: MAX_PATIENTS_PER_SLOT
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error al obtener disponibilidad'
    });
  }
};

// @desc    Crear múltiples citas (reserva masiva)
// @route   POST /api/appointments/bulk
// @access  Private
export const bulkCreateAppointments = async (req, res) => {
  try {
    const { appointments: appointmentsData } = req.body;

    if (!appointmentsData || !Array.isArray(appointmentsData) || appointmentsData.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Debe proporcionar un arreglo de citas'
      });
    }

    const patientId = req.user.role === 'patient' ? req.user._id : req.body.patient;
    const now = new Date();
    const created = [];
    const errors = [];

    for (const apt of appointmentsData) {
      try {
        const { professional, date, startTime, endTime, type } = apt;

        // Validate professional
        const professionalUser = await User.findById(professional);
        if (!professionalUser || !['admin', 'professional'].includes(professionalUser.role)) {
          errors.push({ date, startTime, error: 'Profesional no encontrado' });
          continue;
        }

        const appointmentDate = new Date(date);
        const appointmentDateTime = new Date(`${appointmentDate.toISOString().split('T')[0]}T${startTime}`);

        // 24hr rule for patients
        if (!isStaff(req.user)) {
          const minBookingTime = addHours(now, PATIENT_BOOK_AHEAD_HOURS);
          if (isBefore(appointmentDateTime, minBookingTime)) {
            errors.push({ date, startTime, error: `Debe ser con al menos ${PATIENT_BOOK_AHEAD_HOURS} horas de anticipación` });
            continue;
          }
        }

        // Check slot capacity (4 per slot)
        const patientsInSlot = await countPatientsInSlot(professional, date, startTime);
        if (patientsInSlot >= MAX_PATIENTS_PER_SLOT) {
          errors.push({ date, startTime, error: `Horario lleno (${MAX_PATIENTS_PER_SLOT}/${MAX_PATIENTS_PER_SLOT})` });
          continue;
        }

        const appointment = await Appointment.create({
          patient: patientId,
          professional,
          date: appointmentDate,
          startTime,
          endTime,
          type: type || 'entrenamiento'
        });

        await appointment.populate('patient', 'firstName lastName email phone');
        await appointment.populate('professional', 'firstName lastName');
        created.push(appointment);
      } catch (err) {
        errors.push({ date: apt.date, startTime: apt.startTime, error: err.message });
      }
    }

    res.status(201).json({
      success: true,
      message: `${created.length} citas creadas${errors.length > 0 ? `, ${errors.length} errores` : ''}`,
      data: { appointments: created, errors }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error al crear citas masivas'
    });
  }
};

// @desc    Obtener info del plan del paciente y sus restricciones
// @route   GET /api/appointments/plan-info/:patientId
// @access  Private
export const getPlanInfo = async (req, res) => {
  try {
    const { patientId } = req.params;
    const now = new Date();

    const activePlan = await Plan.findOne({
      patient: patientId,
      status: 'active',
      endDate: { $gte: now }
    }).populate('professional', 'firstName lastName');

    if (!activePlan) {
      return res.status(200).json({
        success: true,
        data: { plan: null, message: 'No hay plan activo' }
      });
    }

    let weeklyUsed = 0;
    let kineSessions = 0;

    if (activePlan.planType === 'kinesiologia') {
      kineSessions = await countKineSessions(patientId);
    } else {
      weeklyUsed = await countWeeklyAppointments(patientId, now, 'entrenamiento');
    }

    res.status(200).json({
      success: true,
      data: {
        plan: activePlan,
        restrictions: {
          planType: activePlan.planType,
          sessionsPerWeek: activePlan.sessionsPerWeek,
          weeklyUsed,
          weeklyRemaining: activePlan.planType !== 'kinesiologia' ? activePlan.sessionsPerWeek - weeklyUsed : null,
          totalSessions: activePlan.totalSessions,
          sessionsUsed: activePlan.planType === 'kinesiologia' ? kineSessions : null,
          sessionsRemaining: activePlan.planType === 'kinesiologia' ? activePlan.totalSessions - kineSessions : null,
          bookAheadHours: PATIENT_BOOK_AHEAD_HOURS,
          cancelAheadHours: PATIENT_CANCEL_AHEAD_HOURS,
          maxPatientsPerSlot: MAX_PATIENTS_PER_SLOT
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error al obtener info del plan'
    });
  }
};

// @desc    Eliminar una cita (solo admin)
// @route   DELETE /api/appointments/:id
// @access  Private/Admin
export const deleteAppointment = async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id);

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Cita no encontrada'
      });
    }

    await appointment.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Cita eliminada exitosamente'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error al eliminar cita'
    });
  }
};
