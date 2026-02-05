import Availability from '../models/Availability.js';
import Appointment from '../models/Appointment.js';
import { startOfDay, endOfDay, parseISO, getDay } from 'date-fns';

// @desc    Obtener disponibilidad de un profesional
// @route   GET /api/availability/:professionalId
// @access  Private
export const getAvailability = async (req, res) => {
  try {
    let availability = await Availability.findOne({
      professional: req.params.professionalId
    }).populate('professional', 'firstName lastName specialty');

    if (!availability) {
      return res.status(200).json({
        success: true,
        data: { availability: null }
      });
    }

    res.status(200).json({
      success: true,
      data: { availability }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error al obtener disponibilidad'
    });
  }
};

// @desc    Crear o actualizar horario semanal
// @route   PUT /api/availability/:professionalId/schedule
// @access  Private/Staff
export const updateWeeklySchedule = async (req, res) => {
  try {
    const { weeklySchedule } = req.body;

    let availability = await Availability.findOne({
      professional: req.params.professionalId
    });

    if (!availability) {
      availability = new Availability({
        professional: req.params.professionalId,
        weeklySchedule
      });
    } else {
      availability.weeklySchedule = weeklySchedule;
    }

    await availability.save();

    res.status(200).json({
      success: true,
      message: 'Horario semanal actualizado',
      data: { availability }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error al actualizar horario'
    });
  }
};

// @desc    Bloquear fecha/slots
// @route   POST /api/availability/:professionalId/block
// @access  Private/Staff
export const blockDate = async (req, res) => {
  try {
    const { date, slots, allDay, reason } = req.body;

    let availability = await Availability.findOne({
      professional: req.params.professionalId
    });

    if (!availability) {
      availability = new Availability({
        professional: req.params.professionalId,
        weeklySchedule: [],
        blockedDates: []
      });
    }

    availability.blockedDates.push({
      date: new Date(date),
      slots: slots || [],
      allDay: allDay || false,
      reason
    });

    await availability.save();

    res.status(200).json({
      success: true,
      message: 'Fecha bloqueada exitosamente',
      data: { availability }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error al bloquear fecha'
    });
  }
};

// @desc    Desbloquear fecha
// @route   DELETE /api/availability/:professionalId/block/:blockId
// @access  Private/Staff
export const unblockDate = async (req, res) => {
  try {
    const availability = await Availability.findOne({
      professional: req.params.professionalId
    });

    if (!availability) {
      return res.status(404).json({
        success: false,
        message: 'No se encontró disponibilidad'
      });
    }

    availability.blockedDates = availability.blockedDates.filter(
      b => b._id.toString() !== req.params.blockId
    );

    await availability.save();

    res.status(200).json({
      success: true,
      message: 'Bloqueo eliminado',
      data: { availability }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error al desbloquear fecha'
    });
  }
};

// @desc    Obtener slots disponibles para una fecha específica
// @route   GET /api/availability/:professionalId/slots/:date
// @access  Private
export const getAvailableSlots = async (req, res) => {
  try {
    const { professionalId, date } = req.params;
    const targetDate = parseISO(date);
    const dayOfWeek = getDay(targetDate);

    const availability = await Availability.findOne({ professional: professionalId });

    if (!availability) {
      return res.status(200).json({
        success: true,
        data: { date, availableSlots: [], bookedSlots: [], blockedSlots: [] }
      });
    }

    // Get weekly schedule for this day
    const daySchedule = availability.weeklySchedule.find(d => d.dayOfWeek === dayOfWeek);
    if (!daySchedule || daySchedule.slots.length === 0) {
      return res.status(200).json({
        success: true,
        data: { date, availableSlots: [], bookedSlots: [], blockedSlots: [] }
      });
    }

    const allSlots = daySchedule.slots.map(s => s.startTime);

    // Check blocked dates
    const blocked = availability.blockedDates.find(b => {
      const bDate = new Date(b.date);
      return bDate.toISOString().split('T')[0] === date;
    });

    let blockedSlots = [];
    if (blocked) {
      if (blocked.allDay) {
        return res.status(200).json({
          success: true,
          data: { date, availableSlots: [], bookedSlots: [], blockedSlots: allSlots }
        });
      }
      blockedSlots = blocked.slots.map(s => s.startTime);
    }

    // Get existing appointments
    const existingAppointments = await Appointment.find({
      professional: professionalId,
      date: { $gte: startOfDay(targetDate), $lte: endOfDay(targetDate) },
      status: { $ne: 'cancelled' }
    });

    const bookedSlots = existingAppointments.map(apt => apt.startTime);
    const availableSlots = allSlots.filter(
      slot => !bookedSlots.includes(slot) && !blockedSlots.includes(slot)
    );

    res.status(200).json({
      success: true,
      data: { date, availableSlots, bookedSlots, blockedSlots }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error al obtener slots'
    });
  }
};
