import Appointment from '../models/Appointment.js';
import User from '../models/User.js';
import { parseISO, isBefore, addHours } from 'date-fns';
import { sendAppointmentCreatedEmail, sendAppointmentCancelledEmail, sendAppointmentUpdatedEmail } from '../services/emailService.js';
import { getSessionBalanceByType, deductSession, refundSession } from '../services/clientPlanService.js';
import { notify } from '../services/notificationService.js';
import { generateAppointmentICS } from '../services/icsService.js';
import {
  MAX_PATIENTS_PER_SLOT,
  PATIENT_BOOK_AHEAD_HOURS,
  PATIENT_CANCEL_AHEAD_HOURS,
  BULK_BOOKING_MAX_ITEMS,
  nowInSantiago,
  countOverlappingAppointments
} from '../services/bookingRulesService.js';

// Tipos de cita que sí consumen una sesión del plan (Paso 15 de BLUEPRINT.md).
// 'evaluacion' queda fuera a propósito: es un primer contacto, no una sesión
// del bono (decisión de Mario).
const DEDUCTIBLE_TYPES = ['kinesiologia', 'entrenamiento'];

// Bloqueo por plan (ClientPlan) vencido o sin sesiones disponibles DE ESE TIPO.
// Consciente del tipo de cita: un paciente con plan de kinesiología no debe
// pasar este chequeo para agendar entrenamiento, aunque tenga saldo de kine.
// Devuelve null si puede agendar, o un objeto { status, body } listo para responder si no puede.
async function checkSessionBalanceForBooking(patientId, type) {
  if (!DEDUCTIBLE_TYPES.includes(type)) return null; // evaluación: sin bloqueo de saldo

  const balance = await getSessionBalanceByType(patientId, type);
  if (balance.totalAvailable > 0) return null;

  const message = balance.hasActivePlan
    ? 'Ya utilizaste todas las sesiones de tu plan. Contacta a Prime F&H para renovar.'
    : 'Tu plan venció, no tienes un plan de este tipo, o no tienes un plan activo. Contacta a Prime F&H para renovar.';

  return {
    status: 403,
    body: { success: false, message, code: 'NO_ACTIVE_PLAN_SESSIONS' }
  };
}

// ─── Helper: verificar si el usuario es staff ────────────────────────────────
function isStaff(user) {
  return ['admin', 'professional'].includes(user.role);
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
  const now = nowInSantiago();

  // No permitir citas en el pasado (para todos)
  if (isBefore(appointmentDateTime, now)) {
    return res.status(400).json({
      success: false,
      message: 'No se pueden crear citas en el pasado'
    });
  }

  const sessionType = type || 'entrenamiento';

  if (!isStaff(req.user)) {
    // ──── REGLA 1: Pacientes deben agendar con anticipación mínima ────
    const minBookingTime = addHours(now, PATIENT_BOOK_AHEAD_HOURS);
    if (isBefore(appointmentDateTime, minBookingTime)) {
      return res.status(400).json({
        success: false,
        code: 'BOOKING_WINDOW',
        message: `Las citas deben agendarse con al menos ${PATIENT_BOOK_AHEAD_HOURS} horas de anticipación`
      });
    }

    // ──── REGLA 1b: Bloqueo por ClientPlan vencido o sin sesiones DE ESE TIPO ────
    // Esto reemplaza la vieja validación cruzada (Regla 3/4 legacy): si no hay
    // plan ni sesión extra de este tipo específico, es indistinguible de "sin
    // saldo" — mismo código NO_ACTIVE_PLAN_SESSIONS, sin exponer detalles del
    // motor interno.
    const balanceCheck = await checkSessionBalanceForBooking(patientId, sessionType);
    if (balanceCheck) {
      return res.status(balanceCheck.status).json(balanceCheck.body);
    }
  }

  // ──── REGLA 5: Máximo 4 pacientes por hora por kinesiólogo (para todos) ────
  const patientsInSlot = await countOverlappingAppointments(professional, date, startTime);
  if (patientsInSlot >= MAX_PATIENTS_PER_SLOT) {
    return res.status(400).json({
      success: false,
      message: `El horario ${startTime} ya tiene ${MAX_PATIENTS_PER_SLOT} pacientes. Selecciona otro horario.`
    });
  }

  // ──── Descuento atómico (Paso 15 de BLUEPRINT.md) ────
  // Se hace ANTES de crear la cita, no después: si no queda saldo (alguien
  // más se llevó el último cupo entre el chequeo de arriba y este instante),
  // no debe quedar ninguna cita creada — 409, no 500 ni una cita fantasma.
  let deduction = null;
  const mustDeduct = !isStaff(req.user) && DEDUCTIBLE_TYPES.includes(sessionType);

  if (mustDeduct) {
    deduction = await deductSession(patientId, sessionType, null);
    if (!deduction) {
      return res.status(409).json({
        success: false,
        code: 'SESSION_CONFLICT',
        message: 'Alguien más acaba de tomar tu último cupo disponible. Intenta de nuevo.'
      });
    }
  }

  // Crear cita
  let appointment;
  try {
    appointment = await Appointment.create({
      patient: patientId,
      professional,
      date: appointmentDate,
      startTime,
      endTime,
      type: sessionType,
      notes,
      sessionDeducted: !!deduction,
      deduction: deduction || undefined
    });
  } catch (createError) {
    // La sesión ya se descontó pero la cita no se pudo crear: se revierte
    // para no dejar un descuento fantasma sin cita asociada.
    if (deduction) await refundSession({ deduction });
    throw createError;
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

  // Notificación in-app (Paso 19) — sin email propio, el de arriba ya cubre eso.
  notify(appointment.professional._id, 'appointment_booked', {
    title: 'Nueva cita agendada',
    body: `${appointment.patient.firstName} ${appointment.patient.lastName} agendó una cita el ${appointment.date.toISOString().split('T')[0]} a las ${appointment.startTime}.`,
    link: '/app/admin/citas'
  }).catch((error) => {
    console.error('Error al notificar nueva cita al profesional:', error.message);
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

// @desc    Descargar la cita como archivo .ics (Paso 28.B de BLUEPRINT.md) —
//          sin OAuth: el paciente lo agrega con un clic a cualquier calendario.
// @route   GET /api/appointments/:id/ics
// @access  Private (paciente propio o staff)
export const getAppointmentICS = async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id)
      .populate('professional', 'firstName lastName');

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Cita no encontrada'
      });
    }

    if (req.user.role === 'patient' && appointment.patient.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permisos para ver esta cita'
      });
    }

    const ics = generateAppointmentICS(appointment);

    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="cita-primefh-${appointment._id}.ics"`);
    res.status(200).send(ics);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error al generar el archivo de calendario'
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

    // ──── ¿Con cuánta anticipación cancela? (Paso 15 de BLUEPRINT.md) ────
    // El paciente SIEMPRE puede cancelar (nunca se bloquea la acción); lo que
    // cambia es si la sesión se le devuelve o no. Cancelar con menos de 4h es
    // una acción legítima, solo que se pierde la sesión — antes esto estaba
    // mal: el código bloqueaba con 400 la cancelación tardía en vez de
    // permitirla sin reembolso, contradiciendo la regla de negocio real.
    let shouldRefund = true;
    if (!isStaff(req.user)) {
      const appointmentDateTime = new Date(`${appointment.date.toISOString().split('T')[0]}T${appointment.startTime}`);
      const minCancelTime = addHours(nowInSantiago(), PATIENT_CANCEL_AHEAD_HOURS);
      shouldRefund = isBefore(minCancelTime, appointmentDateTime);
    }
    // Cancelación hecha por el centro (staff): siempre se devuelve la sesión,
    // el paciente no debe perderla porque el centro reorganizó su agenda.

    // Guardar datos antes de cancelar para el email
    await appointment.populate('patient', 'firstName lastName email');
    await appointment.populate('professional', 'firstName lastName email');

    // Actualizar estado
    appointment.status = 'cancelled';
    appointment.cancellationReason = req.body.reason || '';
    appointment.cancelledBy = req.user._id;
    appointment.cancelledAt = new Date();

    if (appointment.sessionDeducted && shouldRefund) {
      await refundSession(appointment);
      appointment.sessionDeducted = false;
    }

    await appointment.save();

    // ──── ENVIAR EMAIL DE CANCELACIÓN AL PROFESIONAL ────
    sendAppointmentCancelledEmail({
      patient: appointment.patient,
      professional: appointment.professional,
      date: appointment.date,
      startTime: appointment.startTime,
      cancelledBy: req.user,
      cancellationReason: appointment.cancellationReason
    });

    // Notificación in-app (Paso 19) — sin email propio, el de arriba ya cubre eso.
    notify(appointment.professional._id, 'appointment_cancelled', {
      title: 'Cita cancelada',
      body: `${appointment.patient.firstName} ${appointment.patient.lastName} canceló su cita del ${appointment.date.toISOString().split('T')[0]} a las ${appointment.startTime}.`,
      link: '/app/admin/citas'
    }).catch((error) => {
      console.error('Error al notificar cancelación al profesional:', error.message);
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

    // Paso 15 de BLUEPRINT.md: cancelar por esta vía genérica se saltaría el
    // reembolso de la sesión (cancelAppointment es el único lugar que llama a
    // refundSession). Marcar completed/no-show sigue funcionando igual — la
    // sesión ya se descontó al agendar, no hay nada que hacer aquí.
    if (status === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Para cancelar una cita usa el botón de cancelar (aplica la devolución de sesión correspondiente).'
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

    if (appointmentsData.length > BULK_BOOKING_MAX_ITEMS) {
      return res.status(400).json({
        success: false,
        message: `Máximo ${BULK_BOOKING_MAX_ITEMS} citas por reserva masiva`
      });
    }

    const patientId = req.user.role === 'patient' ? req.user._id : req.body.patient;
    const now = nowInSantiago();
    const created = [];
    const skipped = [];

    // Cada cita del lote se valida y descuenta individualmente (saldo, 4h,
    // cupo, tipo) — antes esto se saltaba casi todo: el saldo se chequeaba una
    // sola vez con una llamada rota (sin el `type`, así que nunca bloqueaba
    // nada) y la sesión nunca se descontaba, dejando la reserva masiva fuera
    // del motor de descuento del Paso 15 por completo.
    for (const apt of appointmentsData) {
      const { professional, date, startTime } = apt;
      const sessionType = apt.type || 'entrenamiento';

      try {
        const professionalUser = await User.findById(professional);
        if (!professionalUser || !['admin', 'professional'].includes(professionalUser.role)) {
          skipped.push({ fecha: date, motivo: 'Profesional no encontrado' });
          continue;
        }

        const appointmentDate = new Date(date);
        const appointmentDateTime = new Date(`${appointmentDate.toISOString().split('T')[0]}T${startTime}`);

        if (isBefore(appointmentDateTime, now)) {
          skipped.push({ fecha: date, motivo: 'La fecha ya pasó' });
          continue;
        }

        if (!isStaff(req.user)) {
          const minBookingTime = addHours(now, PATIENT_BOOK_AHEAD_HOURS);
          if (isBefore(appointmentDateTime, minBookingTime)) {
            skipped.push({ fecha: date, motivo: `Debe ser con al menos ${PATIENT_BOOK_AHEAD_HOURS} horas de anticipación` });
            continue;
          }

          const balanceCheck = await checkSessionBalanceForBooking(patientId, sessionType);
          if (balanceCheck) {
            skipped.push({ fecha: date, motivo: balanceCheck.body.message });
            continue;
          }
        }

        const patientsInSlot = await countOverlappingAppointments(professional, date, startTime);
        if (patientsInSlot >= MAX_PATIENTS_PER_SLOT) {
          skipped.push({ fecha: date, motivo: `Horario lleno (${MAX_PATIENTS_PER_SLOT}/${MAX_PATIENTS_PER_SLOT})` });
          continue;
        }

        const [hours, minutes] = startTime.split(':').map(Number);
        const endTime = `${(hours + 1).toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;

        let deduction = null;
        const mustDeduct = !isStaff(req.user) && DEDUCTIBLE_TYPES.includes(sessionType);
        if (mustDeduct) {
          deduction = await deductSession(patientId, sessionType, null);
          if (!deduction) {
            skipped.push({ fecha: date, motivo: 'Alguien más tomó tu último cupo disponible' });
            continue;
          }
        }

        let appointment;
        try {
          appointment = await Appointment.create({
            patient: patientId,
            professional,
            date: appointmentDate,
            startTime,
            endTime,
            type: sessionType,
            sessionDeducted: !!deduction,
            deduction: deduction || undefined
          });
        } catch (createError) {
          if (deduction) await refundSession({ deduction });
          skipped.push({ fecha: date, motivo: createError.message || 'Error al crear la cita' });
          continue;
        }

        await appointment.populate('patient', 'firstName lastName email phone');
        await appointment.populate('professional', 'firstName lastName email');
        created.push(appointment);
      } catch (err) {
        skipped.push({ fecha: date, motivo: err.message || 'Error inesperado' });
      }
    }

    // Un solo email consolidado para toda la reserva masiva
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
      message: `${created.length} citas creadas${skipped.length > 0 ? `, ${skipped.length} no se pudieron reservar` : ''}`,
      data: { created, skipped }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error al crear citas masivas'
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
