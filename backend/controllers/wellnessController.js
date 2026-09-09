import WellnessCheckin from '../models/WellnessCheckin.js';
import User from '../models/User.js';
import { hasActivePlan } from '../services/clientPlanService.js';
import { notify } from '../services/notificationService.js';
import { todayInSantiago } from '../utils/timezone.js';

const PLAN_EXPIRED_MESSAGE = 'Tu plan venció o no tienes un plan activo. Contacta a Prime F&H para renovar antes de registrar tu check-in.';
const ALERT_THRESHOLD = 2.5;

// @desc    Registrar el check-in de bienestar del día
// @route   POST /api/wellness
// @access  Private/Patient (siempre self, con plan activo)
export const createCheckin = async (req, res) => {
  try {
    const patientId = req.user._id;
    const { sleep, energy, stress, soreness, mood, notes } = req.body;

    if (!(await hasActivePlan(patientId))) {
      return res.status(403).json({
        success: false,
        message: PLAN_EXPIRED_MESSAGE,
        code: 'NO_ACTIVE_PLAN_SESSIONS'
      });
    }

    const checkin = await WellnessCheckin.create({
      patient: patientId,
      date: todayInSantiago(),
      sleep,
      energy,
      stress,
      soreness,
      mood,
      notes
    });

    // Alerta al profesional si el promedio del día es bajo (Paso 19: notify)
    if (checkin.average() < ALERT_THRESHOLD) {
      const patientUser = await User.findById(patientId).select('firstName lastName assignedProfessionalId');
      if (patientUser?.assignedProfessionalId) {
        notify(patientUser.assignedProfessionalId, 'wellness_alert', {
          title: 'Alerta de bienestar',
          body: `${patientUser.firstName} ${patientUser.lastName} registró un check-in de bienestar bajo hoy (promedio ${checkin.average().toFixed(1)}/5).`,
          link: `/app/admin/pacientes/${patientId}`
        }).catch((error) => {
          console.error('Error al notificar alerta de bienestar:', error.message);
        });
      }
    }

    res.status(201).json({
      success: true,
      message: 'Check-in registrado exitosamente',
      data: { checkin }
    });
  } catch (error) {
    // Índice único {patient, date}: segundo check-in del mismo día -> 409, no 500.
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'Ya registraste tu check-in de hoy.',
        code: 'ALREADY_CHECKED_IN_TODAY'
      });
    }
    res.status(500).json({
      success: false,
      message: error.message || 'Error al registrar el check-in'
    });
  }
};

// @desc    Obtener el check-in de HOY del paciente autenticado (o null si no ha respondido)
// @route   GET /api/wellness/me
// @access  Private/Patient
export const getTodayCheckin = async (req, res) => {
  try {
    const checkin = await WellnessCheckin.findOne({
      patient: req.user._id,
      date: todayInSantiago()
    });

    res.status(200).json({
      success: true,
      data: { checkin: checkin || null }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error al obtener el check-in de hoy'
    });
  }
};

// @desc    Historial de check-ins de un paciente (últimos 30)
// @route   GET /api/wellness/patient/:patientId
// @access  Private (paciente propio o staff — pertenencia via authorizePatientAccess en la ruta)
export const getPatientCheckins = async (req, res) => {
  try {
    const { patientId } = req.params;

    const checkins = await WellnessCheckin.find({ patient: patientId })
      .sort({ date: -1 })
      .limit(30);

    res.status(200).json({
      success: true,
      count: checkins.length,
      data: { checkins }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error al obtener el historial de check-ins'
    });
  }
};

// @desc    Tendencia de bienestar de la última semana, por paciente — admin ve
// todos, profesional solo los suyos (+ los sin asignar, mismo criterio que el
// resto de la app)
// @route   GET /api/wellness/trends
// @access  Private/Staff
export const getTrends = async (req, res) => {
  try {
    const patientQuery = { role: 'patient', isActive: true };
    if (req.user.role === 'professional') {
      patientQuery.$or = [
        { assignedProfessionalId: req.user._id },
        { assignedProfessionalId: { $exists: false } },
        { assignedProfessionalId: null }
      ];
    }
    const patients = await User.find(patientQuery).select('firstName lastName');

    const weekAgo = new Date(todayInSantiago());
    weekAgo.setDate(weekAgo.getDate() - 6);
    const weekAgoStr = weekAgo.toISOString().split('T')[0];

    const checkins = await WellnessCheckin.find({
      patient: { $in: patients.map((p) => p._id) },
      date: { $gte: weekAgoStr }
    }).sort({ date: -1 });

    const checkinsByPatient = new Map();
    for (const checkin of checkins) {
      const key = checkin.patient.toString();
      if (!checkinsByPatient.has(key)) checkinsByPatient.set(key, []);
      checkinsByPatient.get(key).push(checkin);
    }

    const average = (c) => (c.sleep + c.energy + c.stress + c.soreness + c.mood) / 5;

    const trends = patients
      .map((patient) => {
        const patientCheckins = checkinsByPatient.get(patient._id.toString()) || [];
        const weeklyAverage = patientCheckins.length > 0
          ? patientCheckins.reduce((sum, c) => sum + average(c), 0) / patientCheckins.length
          : null;

        return {
          patient: { _id: patient._id, firstName: patient.firstName, lastName: patient.lastName },
          checkinsThisWeek: patientCheckins.length,
          weeklyAverage,
          lastCheckin: patientCheckins[0] || null,
          isLowAlert: weeklyAverage !== null && weeklyAverage < ALERT_THRESHOLD
        };
      })
      // Los pacientes sin ningún check-in esta semana no aportan nada a la
      // vista de tendencias — se omiten en vez de listar 40 filas vacías.
      .filter((t) => t.checkinsThisWeek > 0)
      .sort((a, b) => (a.weeklyAverage ?? 5) - (b.weeklyAverage ?? 5));

    res.status(200).json({
      success: true,
      count: trends.length,
      data: { trends }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error al obtener las tendencias de bienestar'
    });
  }
};
