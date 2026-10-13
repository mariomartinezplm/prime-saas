import AchievementPause from '../models/AchievementPause.js';
import { isValidPeriodKey, ONCE } from '../config/achievements.js';
import { triggerAchievementEvaluation } from '../services/achievements/index.js';

const isMonth = (periodKey) => typeof periodKey === 'string' && periodKey !== ONCE && isValidPeriodKey(periodKey);

// @desc    Pausas autorizadas de un paciente (meses neutrales para las rachas)
// @route   GET /api/achievements/patients/:patientId/pauses
// @access  Private/Staff con acceso al paciente
export const getPauses = async (req, res) => {
  try {
    const pauses = await AchievementPause.find({ patient: req.params.patientId })
      .sort({ periodKey: -1 })
      .populate('createdBy', 'firstName lastName');
    res.status(200).json({ success: true, count: pauses.length, data: { pauses } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Error al obtener las pausas' });
  }
};

// @desc    Marcar un mes como pausa autorizada (lesión, vacaciones, motivos personales…)
// @route   POST /api/achievements/patients/:patientId/pauses
// @access  Private/Staff con acceso al paciente
export const createPause = async (req, res) => {
  try {
    const { periodKey, reason } = req.body;

    if (!isMonth(periodKey)) {
      return res.status(400).json({ success: false, message: 'Indica el mes con el formato AAAA-MM (por ejemplo 2026-10)' });
    }
    if (typeof reason !== 'string' || !reason.trim()) {
      return res.status(400).json({ success: false, message: 'Indica el motivo de la pausa' });
    }

    let pause;
    try {
      pause = await AchievementPause.create({
        patient: req.params.patientId,
        periodKey,
        reason: reason.trim(),
        createdBy: req.user._id
      });
    } catch (error) {
      if (error?.code === 11000) {
        return res.status(409).json({ success: false, message: 'Ese mes ya está marcado como pausa autorizada' });
      }
      throw error;
    }

    // Una pausa vuelve neutral un mes: puede completar una racha. Fire-and-forget (nunca tumba la respuesta).
    triggerAchievementEvaluation(req.params.patientId).catch(() => {});

    res.status(201).json({ success: true, data: { pause } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Error al registrar la pausa' });
  }
};

// @desc    Quitar una pausa autorizada
// @route   DELETE /api/achievements/patients/:patientId/pauses/:periodKey
// @access  Private/Staff con acceso al paciente
export const deletePause = async (req, res) => {
  try {
    if (!isMonth(req.params.periodKey)) {
      return res.status(400).json({ success: false, message: 'Mes inválido' });
    }

    const removed = await AchievementPause.findOneAndDelete({ patient: req.params.patientId, periodKey: req.params.periodKey });
    if (!removed) {
      return res.status(404).json({ success: false, message: 'Pausa no encontrada' });
    }

    // Quitarla puede dejar sin respaldo una racha ya concedida: se revisa (queda "en revisión", nunca se borra)
    triggerAchievementEvaluation(req.params.patientId).catch(() => {});

    res.status(200).json({ success: true, message: 'Pausa eliminada' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Error al eliminar la pausa' });
  }
};
