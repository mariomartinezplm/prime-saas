import ExerciseProgress from '../models/Exercise.js';
import User from '../models/User.js';
import mongoose from 'mongoose';

// @desc    Crear nuevo registro de ejercicio
// @route   POST /api/exercises
// @access  Private/Admin
export const createExerciseProgress = async (req, res) => {
  try {
    const {
      patient,
      exerciseName,
      category,
      date,
      sets,
      reps,
      weight,
      weightUnit,
      duration,
      distance,
      distanceUnit,
      rpe,
      notes,
      techniqueRating,
      videoUrl
    } = req.body;

    // Validar que el paciente existe
    const patientUser = await User.findById(patient);
    if (!patientUser) {
      return res.status(404).json({
        success: false,
        message: 'Paciente no encontrado'
      });
    }

    // Crear registro
    const exerciseProgress = await ExerciseProgress.create({
      patient,
      recordedBy: req.user._id,
      exerciseName,
      category,
      date: date || new Date(),
      sets,
      reps,
      weight,
      weightUnit,
      duration,
      distance,
      distanceUnit,
      rpe,
      notes,
      techniqueRating,
      videoUrl
    });

    await exerciseProgress.populate('patient', 'firstName lastName');
    await exerciseProgress.populate('recordedBy', 'firstName lastName');

    res.status(201).json({
      success: true,
      message: 'Registro de ejercicio creado exitosamente',
      data: { exerciseProgress }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error al crear registro de ejercicio'
    });
  }
};

// @desc    Obtener todos los registros de ejercicios de un paciente
// @route   GET /api/exercises/patient/:patientId
// @access  Private
export const getPatientExercises = async (req, res) => {
  try {
    const { patientId } = req.params;
    const { category, exerciseName, limit = 50, sortBy = 'date', order = 'desc' } = req.query;

    // Verificar permisos
    if (req.user.role === 'patient' && patientId !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permisos para ver estos registros'
      });
    }

    // Construir query
    const query = { patient: patientId };
    if (category) query.category = category;
    if (exerciseName) query.exerciseName = new RegExp(exerciseName, 'i');

    const sortOrder = order === 'desc' ? -1 : 1;
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder;

    const exercises = await ExerciseProgress.find(query)
      .sort(sortOptions)
      .limit(parseInt(limit))
      .populate('recordedBy', 'firstName lastName');

    res.status(200).json({
      success: true,
      count: exercises.length,
      data: { exercises }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error al obtener registros de ejercicios'
    });
  }
};

// @desc    Obtener un registro específico
// @route   GET /api/exercises/:id
// @access  Private
export const getExerciseProgress = async (req, res) => {
  try {
    const exerciseProgress = await ExerciseProgress.findById(req.params.id)
      .populate('patient', 'firstName lastName email')
      .populate('recordedBy', 'firstName lastName');

    if (!exerciseProgress) {
      return res.status(404).json({
        success: false,
        message: 'Registro no encontrado'
      });
    }

    // Verificar permisos
    if (req.user.role === 'patient' && exerciseProgress.patient._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permisos para ver este registro'
      });
    }

    res.status(200).json({
      success: true,
      data: { exerciseProgress }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error al obtener registro'
    });
  }
};

// @desc    Actualizar un registro de ejercicio
// @route   PUT /api/exercises/:id
// @access  Private/Admin
export const updateExerciseProgress = async (req, res) => {
  try {
    const {
      exerciseName,
      category,
      date,
      sets,
      reps,
      weight,
      weightUnit,
      duration,
      distance,
      distanceUnit,
      rpe,
      notes,
      techniqueRating,
      videoUrl
    } = req.body;

    let exerciseProgress = await ExerciseProgress.findById(req.params.id);

    if (!exerciseProgress) {
      return res.status(404).json({
        success: false,
        message: 'Registro no encontrado'
      });
    }

    // Actualizar campos
    if (exerciseName) exerciseProgress.exerciseName = exerciseName;
    if (category) exerciseProgress.category = category;
    if (date) exerciseProgress.date = date;
    if (sets !== undefined) exerciseProgress.sets = sets;
    if (reps !== undefined) exerciseProgress.reps = reps;
    if (weight !== undefined) exerciseProgress.weight = weight;
    if (weightUnit) exerciseProgress.weightUnit = weightUnit;
    if (duration !== undefined) exerciseProgress.duration = duration;
    if (distance !== undefined) exerciseProgress.distance = distance;
    if (distanceUnit) exerciseProgress.distanceUnit = distanceUnit;
    if (rpe !== undefined) exerciseProgress.rpe = rpe;
    if (notes !== undefined) exerciseProgress.notes = notes;
    if (techniqueRating !== undefined) exerciseProgress.techniqueRating = techniqueRating;
    if (videoUrl !== undefined) exerciseProgress.videoUrl = videoUrl;

    await exerciseProgress.save();

    await exerciseProgress.populate('patient', 'firstName lastName');
    await exerciseProgress.populate('recordedBy', 'firstName lastName');

    res.status(200).json({
      success: true,
      message: 'Registro actualizado exitosamente',
      data: { exerciseProgress }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error al actualizar registro'
    });
  }
};

// @desc    Eliminar un registro de ejercicio
// @route   DELETE /api/exercises/:id
// @access  Private/Admin
export const deleteExerciseProgress = async (req, res) => {
  try {
    const exerciseProgress = await ExerciseProgress.findById(req.params.id);

    if (!exerciseProgress) {
      return res.status(404).json({
        success: false,
        message: 'Registro no encontrado'
      });
    }

    await exerciseProgress.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Registro eliminado exitosamente'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error al eliminar registro'
    });
  }
};

// @desc    Obtener progreso de un ejercicio específico (para gráficos)
// @route   GET /api/exercises/progress/:patientId/:exerciseName
// @access  Private
export const getExerciseProgressChart = async (req, res) => {
  try {
    const { patientId, exerciseName } = req.params;
    const { limit = 20 } = req.query;

    // Verificar permisos
    if (req.user.role === 'patient' && patientId !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permisos para ver este progreso'
      });
    }

    const progress = await ExerciseProgress.getExerciseProgress(
      patientId,
      exerciseName,
      parseInt(limit)
    );

    // Formatear datos para gráfico
    const chartData = progress.map(record => ({
      date: record.date,
      weight: record.weight,
      sets: record.sets,
      reps: record.reps,
      oneRepMax: record.oneRepMax,
      volume: record.sets * record.reps * (record.weight || 0),
      rpe: record.rpe
    }));

    res.status(200).json({
      success: true,
      data: {
        exerciseName,
        progress: chartData
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error al obtener progreso'
    });
  }
};

// @desc    Obtener récord personal (PR) de un ejercicio
// @route   GET /api/exercises/pr/:patientId/:exerciseName
// @access  Private
export const getPersonalRecord = async (req, res) => {
  try {
    const { patientId, exerciseName } = req.params;

    // Verificar permisos
    if (req.user.role === 'patient' && patientId !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permisos para ver este récord'
      });
    }

    const pr = await ExerciseProgress.getPersonalRecord(patientId, exerciseName);

    if (!pr) {
      return res.status(404).json({
        success: false,
        message: 'No se encontraron registros para este ejercicio'
      });
    }

    res.status(200).json({
      success: true,
      data: { personalRecord: pr }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error al obtener récord personal'
    });
  }
};

// @desc    Obtener lista de ejercicios únicos de un paciente
// @route   GET /api/exercises/list/:patientId
// @access  Private
export const getExerciseList = async (req, res) => {
  try {
    const { patientId } = req.params;

    // Verificar permisos
    if (req.user.role === 'patient' && patientId !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permisos para ver esta información'
      });
    }

    const exerciseList = await ExerciseProgress.getUniqueExercises(patientId);

    res.status(200).json({
      success: true,
      count: exerciseList.length,
      data: { exercises: exerciseList }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error al obtener lista de ejercicios'
    });
  }
};

// @desc    Obtener estadísticas de ejercicios por categoría
// @route   GET /api/exercises/stats/:patientId
// @access  Private
export const getExerciseStats = async (req, res) => {
  try {
    const { patientId } = req.params;

    // Verificar permisos
    if (req.user.role === 'patient' && patientId !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permisos para ver estas estadísticas'
      });
    }

    const stats = await ExerciseProgress.aggregate([
      { $match: { patient: new mongoose.Types.ObjectId(patientId) } },
      {
        $group: {
          _id: '$category',
          totalSessions: { $sum: 1 },
          exercises: { $addToSet: '$exerciseName' },
          avgRPE: { $avg: '$rpe' },
          lastSession: { $max: '$date' }
        }
      },
      {
        $project: {
          category: '$_id',
          totalSessions: 1,
          exerciseCount: { $size: '$exercises' },
          avgRPE: { $round: ['$avgRPE', 1] },
          lastSession: 1,
          _id: 0
        }
      },
      { $sort: { totalSessions: -1 } }
    ]);

    res.status(200).json({
      success: true,
      data: { stats }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error al obtener estadísticas'
    });
  }
};
