import Appointment from '../models/Appointment.js';
import User from '../models/User.js';
import { startOfDay, endOfDay, addDays, parseISO, format, isBefore, addHours } from 'date-fns';

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

    // Verificar que la fecha no sea en el pasado
    const appointmentDate = new Date(date);
    const appointmentDateTime = new Date(`${appointmentDate.toISOString().split('T')[0]}T${startTime}`);
    const now = new Date();

    if (isBefore(appointmentDateTime, now)) {
      return res.status(400).json({
        success: false,
        message: 'No se pueden crear citas en el pasado'
      });
    }

    // Si es paciente, verificar regla de 24 horas de anticipación
    if (req.user.role === 'patient') {
      const twentyFourHoursFromNow = addHours(now, 24);
      if (!isBefore(twentyFourHoursFromNow, appointmentDateTime)) {
        return res.status(400).json({
          success: false,
          message: 'Las citas deben agendarse con al menos 24 horas de anticipación'
        });
      }
    }

    // Verificar disponibilidad (no debe haber otra cita en ese horario)
    const conflictingAppointment = await Appointment.findOne({
      professional,
      date: {
        $gte: startOfDay(appointmentDate),
        $lte: endOfDay(appointmentDate)
      },
      startTime,
      status: { $ne: 'cancelled' }
    });

    if (conflictingAppointment) {
      return res.status(400).json({
        success: false,
        message: 'El horario seleccionado no está disponible'
      });
    }

    // Crear cita
    const appointment = await Appointment.create({
      patient: patientId,
      professional,
      date: appointmentDate,
      startTime,
      endTime,
      type,
      notes
    });

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

    // Si es professional, ver sus citas asignadas (y puede filtrar por paciente)
    if (req.user.role === 'professional') {
      query.professional = req.user._id;
    }

    // Filtrar por profesional (admin puede filtrar por cualquier profesional)
    if (req.query.professional && req.user.role === 'admin') {
      query.professional = req.query.professional;
    }

    // Filtros
    if (status) {
      query.status = status;
    }

    if (type) {
      query.type = type;
    }

    if (from || to) {
      query.date = {};
      if (from) {
        query.date.$gte = parseISO(from);
      }
      if (to) {
        query.date.$lte = parseISO(to);
      }
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

    // Si es paciente, verificar la regla de 24 horas
    if (req.user.role === 'patient' && !appointment.canBeCancelled()) {
      return res.status(400).json({
        success: false,
        message: 'Las citas deben cancelarse con al menos 24 horas de anticipación'
      });
    }

    // Actualizar estado
    appointment.status = 'cancelled';
    appointment.cancellationReason = req.body.reason || '';
    appointment.cancelledBy = req.user._id;
    appointment.cancelledAt = new Date();

    await appointment.save();

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

// @desc    Actualizar una cita (solo admin)
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

    // Horarios disponibles de Mario Martínez
    const weekdaySlots = [
      '07:00', '08:00', '09:00', // Mañana
      '12:00', '13:00', // Mediodía
      '16:00', '17:00', '18:00', '19:00' // Tarde
    ];

    const dayOfWeek = targetDate.getDay(); // 0 = Domingo, 6 = Sábado

    // Verificar que sea día de semana (Lunes-Viernes)
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

    // Filtrar horarios ocupados
    const bookedSlots = existingAppointments.map(apt => apt.startTime);
    const availableSlots = weekdaySlots.filter(slot => !bookedSlots.includes(slot));

    res.status(200).json({
      success: true,
      data: {
        date: format(targetDate, 'yyyy-MM-dd'),
        availableSlots,
        bookedSlots
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
        if (req.user.role === 'patient') {
          const twentyFourHoursFromNow = addHours(now, 24);
          if (!isBefore(twentyFourHoursFromNow, appointmentDateTime)) {
            errors.push({ date, startTime, error: 'Debe ser con al menos 24 horas de anticipación' });
            continue;
          }
        }

        // Check conflicts
        const conflict = await Appointment.findOne({
          professional,
          date: { $gte: startOfDay(appointmentDate), $lte: endOfDay(appointmentDate) },
          startTime,
          status: { $ne: 'cancelled' }
        });

        if (conflict) {
          errors.push({ date, startTime, error: 'Horario no disponible' });
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
