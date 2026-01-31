import EVA from '../models/EVA.js';
import User from '../models/User.js';
import mongoose from 'mongoose';

// @desc    Crear nuevo registro EVA
// @route   POST /api/eva
// @access  Private/Admin
export const createEVARecord = async (req, res) => {
  try {
    const {
      patient,
      date,
      painLevel,
      bodyArea,
      painType,
      duration,
      worstTime,
      aggravatingFactors,
      relievingFactors,
      functionalImpact,
      medication,
      functionalTests,
      observations,
      treatmentPlan,
      followUp
    } = req.body;

    // Validar que el paciente existe
    const patientUser = await User.findById(patient);
    if (!patientUser) {
      return res.status(404).json({
        success: false,
        message: 'Paciente no encontrado'
      });
    }

    // Crear registro EVA
    const evaRecord = await EVA.create({
      patient,
      recordedBy: req.user._id,
      date: date || new Date(),
      painLevel,
      bodyArea,
      painType,
      duration,
      worstTime,
      aggravatingFactors,
      relievingFactors,
      functionalImpact,
      medication,
      functionalTests,
      observations,
      treatmentPlan,
      followUp
    });

    await evaRecord.populate('patient', 'firstName lastName email');
    await evaRecord.populate('recordedBy', 'firstName lastName');

    res.status(201).json({
      success: true,
      message: 'Registro EVA creado exitosamente',
      data: { evaRecord }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error al crear registro EVA'
    });
  }
};

// @desc    Obtener todos los registros EVA de un paciente
// @route   GET /api/eva/patient/:patientId
// @access  Private
export const getPatientEVARecords = async (req, res) => {
  try {
    const { patientId } = req.params;
    const { bodyArea, limit = 50, sortBy = 'date', order = 'desc' } = req.query;

    // Verificar permisos
    if (req.user.role === 'patient' && patientId !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permisos para ver estos registros'
      });
    }

    // Construir query
    const query = { patient: patientId };
    if (bodyArea) query.bodyArea = bodyArea;

    const sortOrder = order === 'desc' ? -1 : 1;
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder;

    const evaRecords = await EVA.find(query)
      .sort(sortOptions)
      .limit(parseInt(limit))
      .populate('recordedBy', 'firstName lastName');

    res.status(200).json({
      success: true,
      count: evaRecords.length,
      data: { evaRecords }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error al obtener registros EVA'
    });
  }
};

// @desc    Obtener un registro EVA específico
// @route   GET /api/eva/:id
// @access  Private
export const getEVARecord = async (req, res) => {
  try {
    const evaRecord = await EVA.findById(req.params.id)
      .populate('patient', 'firstName lastName email phone dateOfBirth medicalInfo')
      .populate('recordedBy', 'firstName lastName');

    if (!evaRecord) {
      return res.status(404).json({
        success: false,
        message: 'Registro EVA no encontrado'
      });
    }

    // Verificar permisos
    if (req.user.role === 'patient' && evaRecord.patient._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permisos para ver este registro'
      });
    }

    res.status(200).json({
      success: true,
      data: { evaRecord }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error al obtener registro EVA'
    });
  }
};

// @desc    Actualizar un registro EVA
// @route   PUT /api/eva/:id
// @access  Private/Admin
export const updateEVARecord = async (req, res) => {
  try {
    const {
      date,
      painLevel,
      bodyArea,
      painType,
      duration,
      worstTime,
      aggravatingFactors,
      relievingFactors,
      functionalImpact,
      medication,
      functionalTests,
      observations,
      treatmentPlan,
      followUp
    } = req.body;

    let evaRecord = await EVA.findById(req.params.id);

    if (!evaRecord) {
      return res.status(404).json({
        success: false,
        message: 'Registro EVA no encontrado'
      });
    }

    // Actualizar campos
    if (date) evaRecord.date = date;
    if (painLevel !== undefined) evaRecord.painLevel = painLevel;
    if (bodyArea) evaRecord.bodyArea = bodyArea;
    if (painType) evaRecord.painType = painType;
    if (duration) evaRecord.duration = duration;
    if (worstTime) evaRecord.worstTime = worstTime;
    if (aggravatingFactors) evaRecord.aggravatingFactors = aggravatingFactors;
    if (relievingFactors) evaRecord.relievingFactors = relievingFactors;
    if (functionalImpact !== undefined) evaRecord.functionalImpact = functionalImpact;
    if (medication !== undefined) evaRecord.medication = medication;
    if (functionalTests) evaRecord.functionalTests = functionalTests;
    if (observations !== undefined) evaRecord.observations = observations;
    if (treatmentPlan !== undefined) evaRecord.treatmentPlan = treatmentPlan;
    if (followUp) evaRecord.followUp = followUp;

    await evaRecord.save();

    await evaRecord.populate('patient', 'firstName lastName email');
    await evaRecord.populate('recordedBy', 'firstName lastName');

    res.status(200).json({
      success: true,
      message: 'Registro EVA actualizado exitosamente',
      data: { evaRecord }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error al actualizar registro EVA'
    });
  }
};

// @desc    Eliminar un registro EVA
// @route   DELETE /api/eva/:id
// @access  Private/Admin
export const deleteEVARecord = async (req, res) => {
  try {
    const evaRecord = await EVA.findById(req.params.id);

    if (!evaRecord) {
      return res.status(404).json({
        success: false,
        message: 'Registro EVA no encontrado'
      });
    }

    await evaRecord.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Registro EVA eliminado exitosamente'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error al eliminar registro EVA'
    });
  }
};

// @desc    Obtener evolución del dolor en un área específica (para gráficos)
// @route   GET /api/eva/evolution/:patientId/:bodyArea
// @access  Private
export const getPainEvolution = async (req, res) => {
  try {
    const { patientId, bodyArea } = req.params;
    const { limit = 20 } = req.query;

    // Verificar permisos
    if (req.user.role === 'patient' && patientId !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permisos para ver esta información'
      });
    }

    const evolution = await EVA.getPainEvolution(
      patientId,
      bodyArea,
      parseInt(limit)
    );

    // Formatear datos para gráfico
    const chartData = evolution.map(record => ({
      date: record.date,
      painLevel: record.painLevel,
      functionalImpact: record.functionalImpact,
      observations: record.observations,
      recordedBy: record.recordedBy
    }));

    res.status(200).json({
      success: true,
      data: {
        bodyArea,
        evolution: chartData
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error al obtener evolución del dolor'
    });
  }
};

// @desc    Obtener todas las áreas con dolor de un paciente
// @route   GET /api/eva/affected-areas/:patientId
// @access  Private
export const getAffectedAreas = async (req, res) => {
  try {
    const { patientId } = req.params;

    // Verificar permisos
    if (req.user.role === 'patient' && patientId !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permisos para ver esta información'
      });
    }

    const affectedAreas = await EVA.getAffectedAreas(patientId);

    res.status(200).json({
      success: true,
      count: affectedAreas.length,
      data: { affectedAreas }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error al obtener áreas afectadas'
    });
  }
};

// @desc    Obtener resumen general del dolor de un paciente
// @route   GET /api/eva/summary/:patientId
// @access  Private
export const getPainSummary = async (req, res) => {
  try {
    const { patientId } = req.params;

    // Verificar permisos
    if (req.user.role === 'patient' && patientId !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permisos para ver esta información'
      });
    }

    // Obtener estadísticas generales
    const summary = await EVA.aggregate([
      { $match: { patient: new mongoose.Types.ObjectId(patientId) } },
      { $sort: { date: -1 } },
      {
        $group: {
          _id: null,
          totalRecords: { $sum: 1 },
          currentAvgPain: { $avg: { $first: '$painLevel' } },
          overallAvgPain: { $avg: '$painLevel' },
          maxPainLevel: { $max: '$painLevel' },
          minPainLevel: { $min: '$painLevel' },
          affectedAreasCount: { $addToSet: '$bodyArea' },
          lastRecordDate: { $max: '$date' },
          firstRecordDate: { $min: '$date' }
        }
      },
      {
        $project: {
          _id: 0,
          totalRecords: 1,
          currentAvgPain: { $round: ['$currentAvgPain', 1] },
          overallAvgPain: { $round: ['$overallAvgPain', 1] },
          maxPainLevel: 1,
          minPainLevel: 1,
          affectedAreasCount: { $size: '$affectedAreasCount' },
          lastRecordDate: 1,
          firstRecordDate: 1
        }
      }
    ]);

    // Obtener el registro más reciente
    const latestRecord = await EVA.findOne({ patient: patientId })
      .sort({ date: -1 })
      .populate('recordedBy', 'firstName lastName');

    res.status(200).json({
      success: true,
      data: {
        summary: summary[0] || {},
        latestRecord
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error al obtener resumen del dolor'
    });
  }
};
