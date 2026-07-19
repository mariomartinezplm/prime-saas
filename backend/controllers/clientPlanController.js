import ClientPlan from '../models/ClientPlan.js';
import User from '../models/User.js';
import { getSessionBalance, getActivePlan } from '../services/clientPlanService.js';

function isStaff(user) {
  return ['admin', 'professional'].includes(user.role);
}

// Las rutas "/me" no traen :patientId en la URL — en ese caso se resuelve al propio usuario.
// Si la ruta SÍ trae :patientId, se respeta tal cual (y el caller decide si rechazarlo o no
// según el rol), para no enmascarar un intento de acceder al recurso de otro paciente.
function resolvePatientId(req) {
  if (!req.params.patientId) return req.user._id.toString();
  return req.params.patientId;
}

// @desc    Registrar el pago de un plan (crea un ClientPlan)
// @route   POST /api/client-plans
// @access  Private/Admin
export const createClientPlan = async (req, res) => {
  try {
    const { patientId, serviceType, sessionsTotal, startDate, notes, replaceExisting } = req.body;

    if (!patientId || !serviceType || !sessionsTotal) {
      return res.status(400).json({
        success: false,
        message: 'patientId, serviceType y sessionsTotal son requeridos'
      });
    }

    const patient = await User.findById(patientId);
    if (!patient || patient.role !== 'patient') {
      return res.status(404).json({
        success: false,
        message: 'Paciente no encontrado'
      });
    }

    // Si ya tiene un plan activo y vigente, no se reemplaza automáticamente:
    // el frontend debe confirmar explícitamente con replaceExisting=true
    // (las sesiones del plan anterior se pierden, no se traspasan).
    const existingActive = await getActivePlan(patientId);
    if (existingActive) {
      if (!replaceExisting) {
        await existingActive.populate('patient', 'firstName lastName email');
        return res.status(409).json({
          success: false,
          message: 'El paciente ya tiene un plan activo vigente.',
          data: { existingPlan: existingActive }
        });
      }

      existingActive.status = 'cancelled';
      await existingActive.save();
    }

    const clientPlan = await ClientPlan.create({
      patient: patientId,
      serviceType,
      sessionsTotal,
      startDate: startDate ? new Date(startDate) : new Date(),
      registeredBy: req.user._id,
      notes
    });

    await clientPlan.populate('patient', 'firstName lastName email');
    await clientPlan.populate('registeredBy', 'firstName lastName');

    res.status(201).json({
      success: true,
      message: 'Plan registrado exitosamente',
      data: { clientPlan }
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message || 'Error al registrar el plan'
    });
  }
};

// @desc    Historial de planes de un paciente
// @route   GET /api/client-plans/patient/:patientId
// @access  Private (paciente propio o staff)
export const getPatientPlans = async (req, res) => {
  try {
    const patientId = resolvePatientId(req);

    if (req.user.role === 'patient' && patientId !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permisos para ver los planes de este paciente'
      });
    }

    const clientPlans = await ClientPlan.find({ patient: patientId })
      .populate('registeredBy', 'firstName lastName')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: clientPlans.length,
      data: { clientPlans }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error al obtener los planes'
    });
  }
};

// @desc    Balance de sesiones disponibles (plan activo + extras no usadas)
// @route   GET /api/client-plans/balance/:patientId
// @access  Private (paciente propio o staff)
export const getBalance = async (req, res) => {
  try {
    const patientId = resolvePatientId(req);

    if (req.user.role === 'patient' && patientId !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permisos para ver el balance de este paciente'
      });
    }

    if (!patientId) {
      return res.status(400).json({
        success: false,
        message: 'patientId es requerido'
      });
    }

    const balance = await getSessionBalance(patientId);

    res.status(200).json({
      success: true,
      data: { balance }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error al obtener el balance de sesiones'
    });
  }
};

// @desc    Cancelar un plan
// @route   PUT /api/client-plans/:id/cancel
// @access  Private/Admin
export const cancelClientPlan = async (req, res) => {
  try {
    const clientPlan = await ClientPlan.findById(req.params.id);

    if (!clientPlan) {
      return res.status(404).json({
        success: false,
        message: 'Plan no encontrado'
      });
    }

    clientPlan.status = 'cancelled';
    await clientPlan.save();

    res.status(200).json({
      success: true,
      message: 'Plan cancelado',
      data: { clientPlan }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error al cancelar el plan'
    });
  }
};

// @desc    Listar planes (activos y vencidos) de TODOS los pacientes, para el panel admin
// @route   GET /api/client-plans
// @access  Private/Staff (admin o professional)
export const getAllClientPlans = async (req, res) => {
  try {
    // Auto-sanar vencimientos antes de listar, para que el estado mostrado sea correcto
    await ClientPlan.expireOverduePlans();

    const clientPlans = await ClientPlan.find({ status: { $in: ['active', 'expired'] } })
      .populate('patient', 'firstName lastName email')
      .populate('registeredBy', 'firstName lastName')
      .sort({ endDate: 1 });

    res.status(200).json({
      success: true,
      count: clientPlans.length,
      data: { clientPlans }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error al obtener los planes'
    });
  }
};

// @desc    Disparar manualmente la verificación de vencimiento de TODOS los planes
// @route   POST /api/client-plans/expire-check
// @access  Private/Admin
export const runExpireCheck = async (req, res) => {
  try {
    const expiredCount = await ClientPlan.expireOverduePlans();

    res.status(200).json({
      success: true,
      message: `${expiredCount} plan(es) marcado(s) como vencido(s)`,
      data: { expiredCount }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error al verificar vencimientos'
    });
  }
};
