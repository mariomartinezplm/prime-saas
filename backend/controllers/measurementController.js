import Measurement from '../models/Measurement.js';
import User from '../models/User.js';

// @desc    Crear nueva medición
// @route   POST /api/measurements
// @access  Private/Admin
export const createMeasurement = async (req, res) => {
  try {
    const { patient, date, perimeters, weight, height, bodyFatPercentage, muscleMassPercentage, notes, photos } = req.body;

    // Validar que el paciente existe
    const patientUser = await User.findById(patient);
    if (!patientUser) {
      return res.status(404).json({
        success: false,
        message: 'Paciente no encontrado'
      });
    }

    // Crear medición
    const measurement = await Measurement.create({
      patient,
      recordedBy: req.user._id,
      date: date || new Date(),
      perimeters,
      weight,
      height,
      bodyFatPercentage,
      muscleMassPercentage,
      notes,
      photos
    });

    await measurement.populate('patient', 'firstName lastName email');
    await measurement.populate('recordedBy', 'firstName lastName');

    res.status(201).json({
      success: true,
      message: 'Medición creada exitosamente',
      data: { measurement }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error al crear medición'
    });
  }
};

// @desc    Obtener todas las mediciones de un paciente
// @route   GET /api/measurements/patient/:patientId
// @access  Private
export const getPatientMeasurements = async (req, res) => {
  try {
    const { patientId } = req.params;
    const { limit = 20, sortBy = 'date', order = 'desc' } = req.query;

    // Verificar permisos: paciente solo puede ver sus propias mediciones
    if (req.user.role === 'patient' && patientId !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permisos para ver estas mediciones'
      });
    }

    const sortOrder = order === 'desc' ? -1 : 1;
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder;

    const measurements = await Measurement.find({ patient: patientId })
      .sort(sortOptions)
      .limit(parseInt(limit))
      .populate('recordedBy', 'firstName lastName');

    // Obtener estadísticas básicas
    const stats = await Measurement.aggregate([
      { $match: { patient: mongoose.Types.ObjectId(patientId) } },
      { $sort: { date: -1 } },
      {
        $group: {
          _id: null,
          totalMeasurements: { $sum: 1 },
          latestWeight: { $first: '$weight' },
          latestBMI: { $first: '$bmi' },
          firstWeight: { $last: '$weight' },
          firstBMI: { $last: '$bmi' }
        }
      }
    ]);

    res.status(200).json({
      success: true,
      count: measurements.length,
      data: {
        measurements,
        stats: stats[0] || {}
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error al obtener mediciones'
    });
  }
};

// @desc    Obtener una medición específica
// @route   GET /api/measurements/:id
// @access  Private
export const getMeasurement = async (req, res) => {
  try {
    const measurement = await Measurement.findById(req.params.id)
      .populate('patient', 'firstName lastName email phone dateOfBirth')
      .populate('recordedBy', 'firstName lastName');

    if (!measurement) {
      return res.status(404).json({
        success: false,
        message: 'Medición no encontrada'
      });
    }

    // Verificar permisos
    if (req.user.role === 'patient' && measurement.patient._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permisos para ver esta medición'
      });
    }

    res.status(200).json({
      success: true,
      data: { measurement }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error al obtener medición'
    });
  }
};

// @desc    Actualizar una medición
// @route   PUT /api/measurements/:id
// @access  Private/Admin
export const updateMeasurement = async (req, res) => {
  try {
    const { date, perimeters, weight, height, bodyFatPercentage, muscleMassPercentage, notes, photos } = req.body;

    let measurement = await Measurement.findById(req.params.id);

    if (!measurement) {
      return res.status(404).json({
        success: false,
        message: 'Medición no encontrada'
      });
    }

    // Actualizar campos
    if (date) measurement.date = date;
    if (perimeters) measurement.perimeters = { ...measurement.perimeters, ...perimeters };
    if (weight !== undefined) measurement.weight = weight;
    if (height !== undefined) measurement.height = height;
    if (bodyFatPercentage !== undefined) measurement.bodyFatPercentage = bodyFatPercentage;
    if (muscleMassPercentage !== undefined) measurement.muscleMassPercentage = muscleMassPercentage;
    if (notes !== undefined) measurement.notes = notes;
    if (photos) measurement.photos = photos;

    await measurement.save();

    await measurement.populate('patient', 'firstName lastName email');
    await measurement.populate('recordedBy', 'firstName lastName');

    res.status(200).json({
      success: true,
      message: 'Medición actualizada exitosamente',
      data: { measurement }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error al actualizar medición'
    });
  }
};

// @desc    Eliminar una medición
// @route   DELETE /api/measurements/:id
// @access  Private/Admin
export const deleteMeasurement = async (req, res) => {
  try {
    const measurement = await Measurement.findById(req.params.id);

    if (!measurement) {
      return res.status(404).json({
        success: false,
        message: 'Medición no encontrada'
      });
    }

    await measurement.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Medición eliminada exitosamente'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error al eliminar medición'
    });
  }
};

// @desc    Obtener comparación entre dos mediciones
// @route   GET /api/measurements/compare/:id1/:id2
// @access  Private
export const compareMeasurements = async (req, res) => {
  try {
    const { id1, id2 } = req.params;

    const measurement1 = await Measurement.findById(id1);
    const measurement2 = await Measurement.findById(id2);

    if (!measurement1 || !measurement2) {
      return res.status(404).json({
        success: false,
        message: 'Una o ambas mediciones no fueron encontradas'
      });
    }

    // Verificar que ambas mediciones son del mismo paciente
    if (measurement1.patient.toString() !== measurement2.patient.toString()) {
      return res.status(400).json({
        success: false,
        message: 'Las mediciones deben ser del mismo paciente'
      });
    }

    // Verificar permisos
    if (req.user.role === 'patient' && measurement1.patient.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permisos para comparar estas mediciones'
      });
    }

    // Calcular diferencias
    const comparison = {
      weight: measurement2.weight - measurement1.weight,
      height: measurement2.height - measurement1.height,
      bmi: measurement2.bmi - measurement1.bmi,
      bodyFat: measurement2.bodyFatPercentage - measurement1.bodyFatPercentage,
      muscleMass: measurement2.muscleMassPercentage - measurement1.muscleMassPercentage,
      perimeters: {}
    };

    // Comparar perímetros
    const perimeterKeys = Object.keys(measurement1.perimeters.toObject());
    perimeterKeys.forEach(key => {
      if (measurement1.perimeters[key] && measurement2.perimeters[key]) {
        comparison.perimeters[key] = measurement2.perimeters[key] - measurement1.perimeters[key];
      }
    });

    res.status(200).json({
      success: true,
      data: {
        measurement1,
        measurement2,
        comparison
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error al comparar mediciones'
    });
  }
};

// @desc    Obtener progreso de perímetros (datos para gráficos)
// @route   GET /api/measurements/progress/:patientId/:perimeter
// @access  Private
export const getPerimeterProgress = async (req, res) => {
  try {
    const { patientId, perimeter } = req.params;
    const { limit = 12 } = req.query;

    // Verificar permisos
    if (req.user.role === 'patient' && patientId !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permisos para ver este progreso'
      });
    }

    // Validar que el perímetro existe
    const validPerimeters = ['bicepLeft', 'bicepRight', 'chest', 'waist', 'hips', 'thighLeft', 'thighRight', 'calfLeft', 'calfRight', 'forearmLeft', 'forearmRight'];

    if (!validPerimeters.includes(perimeter)) {
      return res.status(400).json({
        success: false,
        message: 'Perímetro inválido'
      });
    }

    const measurements = await Measurement.find({
      patient: patientId,
      [`perimeters.${perimeter}`]: { $exists: true, $ne: null }
    })
      .sort({ date: 1 })
      .limit(parseInt(limit))
      .select(`date perimeters.${perimeter}`);

    const progressData = measurements.map(m => ({
      date: m.date,
      value: m.perimeters[perimeter]
    }));

    res.status(200).json({
      success: true,
      data: {
        perimeter,
        progress: progressData
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error al obtener progreso'
    });
  }
};
