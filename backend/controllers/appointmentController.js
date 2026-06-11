import Appointment from '../models/Appointment.js';
import Plan from '../models/Plan.js';
import User from '../models/User.js';
import Availability from '../models/Availability.js';
import { startOfDay, endOfDay, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, parseISO, format, isBefore, addHours } from 'date-fns';
import { sendAppointmentCreatedEmail, sendAppointmentCancelledEmail, sendAppointmentUpdatedEmail } from '../utils/emailService.js';

// ─── Constantes de reglas ────────────────────────────────────────────────────
const MAX_PATIENTS_PER_SLOT = 4;         // Máximo 4 pacientes por hora por kinesiólogo
const PATIENT_BOOK_AHEAD_HOURS = 24;     // Pacientes: mínimo 24h de anticipación para agendar
const PATIENT_CANCEL_AHEAD_HOURS = 4;    // Pacientes: mínimo 4h de anticipación para cancelar

// Límites mensuales por tipo de plan
const MONTHLY_LIMITS = {
  'entrenamiento-2x': 8,
  'entrenamiento-3x': 12,
  'kinesiologia': 10  // total (no mensual), ya controlado por totalSessions
};

// ─── Helper: verificar si el usuario es staff ────────────────────────────────
function isStaff(user) {
  return ['admin', 'professional'].includes(user.role);
}

// ─── Helper: contar agendamientos del paciente en el MES actual ──────────────
async function countMonthlyAppointments(patientId, date, type) {
  const targetDate = new Date(date);
  const monthStart = startOfMonth(targetDate);
  const monthEnd = endOfMonth(targetDate);

  return await Appointment.countDocuments({
    patient: patientId,
    date: { $gte: monthStart, $lte: monthEnd },
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

// ─── Helper: contar pacientes solapados en un horario ──────────────────────────
async function countPatientsInSlot(professionalId, date, targetStartTime) {
  const targetDate = new Date(date);

  // Calcular hora de fin asumiendo 1 hora de duración para verificar solapamientos
  const [hours, minutes] = targetStartTime.split(':').map(Number);
  const endHours = (hours + 1).toString().padStart(2, '0');
  const targetEndTime = `${endHours}:${minutes.toString().padStart(2, '0')}`;

  return await Appointment.countDocuments({
    professional: professionalId,
    date: {
      $gte: startOfDay(targetDate),
      $lte: endOfDay(targetDate)
    },
    // Condición de solapamiento: (cita.inicio < target.fin) AND (cita.fin > target.inicio)
    startTime: { $lt: targetEndTime },
    endTime: { $gt: targetStartTime },
    status: { $ne: 'cancelled' }
  });
}

// @desc    Crear nueva cita
// @route   POST /api/appointments
// @access  Private
export const createAppointment = async (req, res) => {
  try {
    let { professional, date, startTime, type, notes } = req.body;

  // Si es paciente, asignar automáticamente como patient
  const patientId = req.user.role === 'patient' ? req.user._id : req.body.patient;

  // Forzar endTime a 1 hora después de startTime
  const [hours, minutes] = startTime.split(':').map(Number);
  const endHours = (hours + 1).toString().padStart(2, '0');
  const endTime = `${endHours}:${minutes.toString().padStart(2, '0')}`;

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
      const userToCheck = isStaff(req.user) ? await User.findById(patientId) : req.user;

      if (!userToCheck.isActive) {
        return res.status(400).json({
          success: false,
          message: 'Tu cuenta no está activa. Debes regularizar tu pago para poder agendar.'
        });
      }

      // Si es activo pero no tiene plan doc, asignamos permisos por defecto
      activePlan = {
        planType: 'entrenamiento-3x',
        sessionsPerWeek: 20,
        sessionsPerMonth: 99,
        totalSessions: 9999,
        sessionsUsed: 0
      };
    }

    // ──── REGLA 3: Validar tipo de sesión según plan ────
    if (activePlan.planType === 'kinesiologia') {
      if (type !== 'kinesiologia') {
        return res.status(400).json({
          success: false,
          message: 'Tu plan es de kinesiología. Solo puedes agendar sesiones de kinesiología.'
        });
      }

      // Verificar que no haya superado las sesiones totales (10)
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

      // ──── REGLA 4: Límite MENSUAL según plan ────
      const monthlyLimit = MONTHLY_LIMITS[activePlan.planType] || activePlan.sessionsPerMonth || 12;
      const monthlyCount = await countMonthlyAppointments(patientId, date, 'entrenamiento');
      if (monthlyCount >= monthlyLimit) {
        return res.status(400).json({
          success: false,
          message: `Ya tienes ${monthlyCount} sesiones este mes. Tu plan permite ${monthlyLimit} sesiones por mes.`
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
  await appointment.populate('professional', 'firstName lastName email');

  // ──── ENVIAR EMAIL DE NOTIFICACIÓN AL PROFESIONAL (fire & forget) ────
  sendAppointmentCreatedEmail({
    patient: appointment.patient,
    professional: appointment.professional,
    date: appointment.date,
    startTime: appointment.startTime,
    endTime: appointment.endTime,
    type: appointment.type
  });

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

    // Guardar datos antes de cancelar para el email
    await appointment.populate('patient', 'firstName lastName email');
    await appointment.populate('professional', 'firstName lastName email');

    // Actualizar estado
    appointment.status = 'cancelled';
    appointment.cancellationReason = req.body.reason || '';
    appointment.cancelledBy = req.user._id;
    appointment.cancelledAt = new Date();

    await appointment.save();

    // Si era kinesiología, devolver la sesión al plan
    if (appointment.type === 'kinesiologia') {
      await Plan.findOneAndUpdate(
        { patient: appointment.patient._id || appointment.patient, status: 'active', planType: 'kinesiologia' },
        { $inc: { sessionsUsed: -1 } }
      );
    }

    // ──── ENVIAR EMAIL DE CANCELACIÓN AL PROFESIONAL ────
    sendAppointmentCancelledEmail({
      patient: appointment.patient,
      professional: appointment.professional,
      date: appointment.date,
      startTime: appointment.startTime,
      cancelledBy: req.user,
      cancellationReason: appointment.cancellationReason
    });

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

    // Track changes for email
    const changes = [];
    if (date && date !== appointment.date?.toISOString()?.split('T')[0]) changes.push('Fecha');
    if (startTime && startTime !== appointment.startTime) changes.push('Hora de inicio');
    if (endTime && endTime !== appointment.endTime) changes.push('Hora de fin');
    if (status && status !== appointment.status) changes.push(`Estado → ${status}`);

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
    await appointment.populate('professional', 'firstName lastName email');

    // ──── ENVIAR EMAIL DE MODIFICACIÓN AL PROFESIONAL ────
    if (changes.length > 0) {
      sendAppointmentUpdatedEmail({
        patient: appointment.patient,
        professional: appointment.professional,
        date: appointment.date,
        startTime: appointment.startTime,
        endTime: appointment.endTime,
        changes: changes.join(', ')
      });
    }

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

    // Buscar la disponibilidad configurada del profesional
    const availability = await Availability.findOne({ professional: professionalId });

    if (!availability) {
      return res.status(200).json({
        success: true,
        data: {
          availableSlots: [],
          message: 'El profesional no ha configurado su horario'
        }
      });
    }

    const dayOfWeek = targetDate.getDay();

    // Obtener los horarios para este día de la semana
    const daySchedule = availability.weeklySchedule.find(d => d.dayOfWeek === dayOfWeek);

    if (!daySchedule || daySchedule.slots.length === 0) {
      return res.status(200).json({
        success: true,
        data: {
          availableSlots: [],
          message: 'No hay horarios configurados para este día'
        }
      });
    }

    // Extraer todos los startTimes configurados
    let possibleSlots = daySchedule.slots.map(s => s.startTime);

    // Revisar si la fecha entera está bloqueada
    const targetDateString = targetDate.toISOString().split('T')[0];
    const blocked = availability.blockedDates.find(b => {
      const bDate = new Date(b.date);
      return bDate.toISOString().split('T')[0] === targetDateString;
    });

    if (blocked) {
      if (blocked.allDay) {
        return res.status(200).json({
          success: true,
          data: { availableSlots: [], message: 'El día está bloqueado' }
        });
      }
      const blockedStartTimes = blocked.slots.map(s => s.startTime);
      possibleSlots = possibleSlots.filter(slot => !blockedStartTimes.includes(slot));
    }

    // Ordenar los slots
    possibleSlots.sort();

    // Obtener citas existentes para calcular ocupaciones y solapamientos reales
    const existingAppointments = await Appointment.find({
      professional: professionalId,
      date: {
        $gte: startOfDay(targetDate),
        $lte: endOfDay(targetDate)
      },
      status: { $ne: 'cancelled' }
    });

    const slotsWithAvailability = [];
    const availableSlots = [];

    for (const slot of possibleSlots) {
      // Calcular hora de fin asumiendo 1 hora de duración para verificar solapamientos
      const [hours, minutes] = slot.split(':').map(Number);
      const endHours = (hours + 1).toString().padStart(2, '0');
      const targetEndTime = `${endHours}:${minutes.toString().padStart(2, '0')}`;

      // Contar solapamientos reales cruzados
      const overlappingAppointments = existingAppointments.filter(apt => {
        return apt.startTime < targetEndTime && apt.endTime > slot;
      });

      const bookedCount = overlappingAppointments.length;
      const isFull = bookedCount >= MAX_PATIENTS_PER_SLOT;

      slotsWithAvailability.push({
        time: slot,
        booked: bookedCount,
        available: Math.max(0, MAX_PATIENTS_PER_SLOT - bookedCount),
        isFull
      });

      if (!isFull) {
        availableSlots.push(slot);
      }
    }

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

// @desc    Crear múltiples citas (reserva masiva / horario recurrente)
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
        const { professional, date, startTime, type } = apt;

        // Forzar endTime a 1 hora después de startTime
        const [hours, minutes] = startTime.split(':').map(Number);
        const endHours = (hours + 1).toString().padStart(2, '0');
        const endTime = `${endHours}:${minutes.toString().padStart(2, '0')}`;

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
        await appointment.populate('professional', 'firstName lastName email');
        created.push(appointment);
      } catch (err) {
        errors.push({ date: apt.date, startTime: apt.startTime, error: err.message });
      }
    }

    // Send one consolidated email for bulk bookings
    if (created.length > 0) {
      const firstApt = created[0];
      sendAppointmentCreatedEmail({
        patient: firstApt.patient,
        professional: firstApt.professional,
        date: firstApt.date,
        startTime: `${created.length} sesiones programadas`,
        endTime: '',
        type: firstApt.type
      });
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

    let monthlyUsed = 0;
    let kineSessions = 0;

    if (activePlan.planType === 'kinesiologia') {
      kineSessions = await countKineSessions(patientId);
    } else {
      monthlyUsed = await countMonthlyAppointments(patientId, now, 'entrenamiento');
    }

    const monthlyLimit = MONTHLY_LIMITS[activePlan.planType] || 12;

    res.status(200).json({
      success: true,
      data: {
        plan: activePlan,
        restrictions: {
          planType: activePlan.planType,
          sessionsPerMonth: monthlyLimit,
          monthlyUsed,
          monthlyRemaining: activePlan.planType !== 'kinesiologia' ? monthlyLimit - monthlyUsed : null,
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
