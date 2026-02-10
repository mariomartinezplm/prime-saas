import Plan from '../models/Plan.js';

// @desc    Crear un plan
// @route   POST /api/plans
// @access  Private/Staff
export const createPlan = async (req, res) => {
  try {
    const { patient, professional, planType, duration, totalSessions, startDate, notes } = req.body;

    // Check if patient already has an active plan
    const existingPlan = await Plan.findOne({
      patient,
      status: 'active',
      endDate: { $gte: new Date() }
    });

    if (existingPlan) {
      return res.status(400).json({
        success: false,
        message: 'El paciente ya tiene un plan activo. Cancela o espera que expire el plan actual.'
      });
    }

    const planData = {
      patient,
      professional,
      planType,
      startDate: new Date(startDate),
      notes
    };

    // Duración solo para planes de entrenamiento
    if (planType !== 'kinesiologia' && duration) {
      planData.duration = duration;
    }

    // Total de sesiones personalizado para kinesiología
    if (planType === 'kinesiologia' && totalSessions) {
      planData.totalSessions = totalSessions;
    }

    const plan = await Plan.create(planData);

    await plan.populate('patient', 'firstName lastName email rut');
    await plan.populate('professional', 'firstName lastName');

    res.status(201).json({
      success: true,
      message: 'Plan creado exitosamente',
      data: { plan }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error al crear plan'
    });
  }
};

// @desc    Obtener todos los planes
// @route   GET /api/plans
// @access  Private/Staff
export const getPlans = async (req, res) => {
  try {
    const { status, patient } = req.query;
    const query = {};

    if (status) query.status = status;
    if (patient) query.patient = patient;

    // If patient role, only show their plans
    if (req.user.role === 'patient') {
      query.patient = req.user._id;
    }

    const plans = await Plan.find(query)
      .populate('patient', 'firstName lastName email rut')
      .populate('professional', 'firstName lastName')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: plans.length,
      data: { plans }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error al obtener planes'
    });
  }
};

// @desc    Obtener plan por ID
// @route   GET /api/plans/:id
// @access  Private
export const getPlan = async (req, res) => {
  try {
    const plan = await Plan.findById(req.params.id)
      .populate('patient', 'firstName lastName email rut')
      .populate('professional', 'firstName lastName');

    if (!plan) {
      return res.status(404).json({
        success: false,
        message: 'Plan no encontrado'
      });
    }

    // Patients can only see their own plans
    if (req.user.role === 'patient' && plan.patient._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permisos para ver este plan'
      });
    }

    res.status(200).json({
      success: true,
      data: { plan }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error al obtener plan'
    });
  }
};

// @desc    Obtener plan activo del paciente
// @route   GET /api/plans/active/:patientId
// @access  Private
export const getActivePlan = async (req, res) => {
  try {
    const plan = await Plan.findOne({
      patient: req.params.patientId,
      status: 'active',
      endDate: { $gte: new Date() }
    })
      .populate('patient', 'firstName lastName email rut')
      .populate('professional', 'firstName lastName');

    res.status(200).json({
      success: true,
      data: { plan: plan || null }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error al obtener plan activo'
    });
  }
};

// @desc    Actualizar plan
// @route   PUT /api/plans/:id
// @access  Private/Staff
export const updatePlan = async (req, res) => {
  try {
    const plan = await Plan.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    })
      .populate('patient', 'firstName lastName email rut')
      .populate('professional', 'firstName lastName');

    if (!plan) {
      return res.status(404).json({
        success: false,
        message: 'Plan no encontrado'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Plan actualizado',
      data: { plan }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error al actualizar plan'
    });
  }
};

// @desc    Eliminar plan
// @route   DELETE /api/plans/:id
// @access  Private/Admin
export const deletePlan = async (req, res) => {
  try {
    const plan = await Plan.findById(req.params.id);

    if (!plan) {
      return res.status(404).json({
        success: false,
        message: 'Plan no encontrado'
      });
    }

    await plan.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Plan eliminado'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error al eliminar plan'
    });
  }
};
