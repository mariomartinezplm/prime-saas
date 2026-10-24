import ClientPlan from '../models/ClientPlan.js';
import User from '../models/User.js';
import { getSessionBalance, getActivePlan, toPatientPlanView } from '../services/clientPlanService.js';
import {
  createTermPlans,
  settlePendingPlan,
  cancelPlanAndFutureCycles,
  changePlanStartDate,
  PlanDateError,
  advancePlans,
  runPlanLifecycleJob
} from '../services/planLifecycleService.js';
import { TERMS, BILLING_CYCLES, isValidGraceDays, MAX_GRACE_DAYS, paymentDueBy } from '../services/planCycles.js';
import { santiagoToUtc } from '../utils/timezone.js';
import { ownedPatientsOr, canAccessPatient } from '../middleware/auth.js';

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
    const { patientId, serviceType, sessionsTotal, unlimited, startDate, notes, replaceExisting } = req.body;
    const term = req.body.term || 'mensual';
    const billingCycle = req.body.billingCycle || 'calendar';
    const renews = req.body.renews !== false;
    const isUnlimited = unlimited === true;
    // Fecha de ingreso: sin indicarla, hoy. Con indicarla ('YYYY-MM-DD') el plan parte ese día (para quienes pagan de fecha a fecha)
    let planStart = new Date();
    if (startDate) {
      const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(startDate));
      const day = m ? santiagoToUtc(Number(m[1]), Number(m[2]), Number(m[3]), 0, 0) : null;
      const dayMs = 24 * 60 * 60 * 1000;
      if (!day || Number.isNaN(day.getTime()) || day.getTime() < Date.now() - 400 * dayMs || day.getTime() > Date.now() + 90 * dayMs) {
        return res.status(400).json({ success: false, message: 'La fecha de ingreso debe estar entre hace un año y los próximos 3 meses' });
      }
      planStart = day;
    }
    const graceDays = req.body.graceDays;
    if (graceDays !== undefined && !isValidGraceDays(graceDays)) {
      return res.status(400).json({ success: false, message: `El plazo de pago debe ser un número de días entre 0 y ${MAX_GRACE_DAYS}` });
    }

    if (!patientId || !serviceType || (!isUnlimited && !sessionsTotal)) {
      return res.status(400).json({
        success: false,
        message: 'patientId, serviceType y sessionsTotal (o unlimited) son requeridos'
      });
    }

    if (!TERMS.includes(term) || !BILLING_CYCLES.includes(billingCycle)) {
      return res.status(400).json({
        success: false,
        message: `term debe ser uno de: ${TERMS.join(', ')}; billingCycle: ${BILLING_CYCLES.join(', ')}`
      });
    }

    // Los planes anuales (Miembro Fundador) los deja solo el administrador
    if (term === 'anual' && serviceType !== 'kinesiologia' && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Solo el administrador puede registrar un plan anual' });
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
    let clientPlan;

    if (existingActive?.paymentPending && existingActive.serviceType === serviceType) {
      // Es el pago de la renovación que estaba pendiente: el ciclo queda pagado
      // y conserva las sesiones que el paciente ya usó en los días de plazo.
      clientPlan = await settlePendingPlan(existingActive, {
        sessionsTotal,
        unlimited: isUnlimited,
        term,
        renews,
        graceDays,
        registeredBy: req.user._id,
        notes
      });
    } else {
      if (existingActive) {
        // Un plan de kinesiología «hasta completar» al que ya no le quedan sesiones está terminado: se cierra y el nuevo entra sin pedir confirmación
        const finishedOpenEnded = existingActive.openEnded && existingActive.sessionsAvailable() === 0;
        if (finishedOpenEnded) {
          existingActive.status = 'expired';
          await existingActive.save();
        } else if (!replaceExisting) {
          await existingActive.populate('patient', 'firstName lastName email');
          return res.status(409).json({
            success: false,
            message: 'El paciente ya tiene un plan activo vigente.',
            data: { existingPlan: existingActive }
          });
        }
        else await cancelPlanAndFutureCycles(existingActive);
      }

      clientPlan = await createTermPlans({
        patientId,
        serviceType,
        sessionsTotal,
        unlimited: isUnlimited,
        term,
        billingCycle,
        startDate: planStart,
        renews,
        graceDays,
        registeredBy: req.user._id,
        notes
      });
    }

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

    // El personal ve el documento completo (con las notas y quién registró el plan); el paciente, solo los datos propios de su plan
    let query = ClientPlan.find({ patient: patientId });
    if (isStaff(req.user)) query = query.populate('registeredBy', 'firstName lastName');
    const plans = await query.sort({ createdAt: -1 });
    const clientPlans = isStaff(req.user) ? plans : plans.map(toPatientPlanView);

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

    const full = await getSessionBalance(patientId);
    // Mismo criterio que el historial: al paciente le llega su plan sin notas del personal ni campos internos
    const balance = isStaff(req.user) ? full : { ...full, plan: toPatientPlanView(full.plan) };

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

    await cancelPlanAndFutureCycles(clientPlan);

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

// @desc    Listar planes (activos y vencidos): el admin ve los de todos los pacientes; un
//          profesional, solo los de SUS pacientes (asignados + pool sin profesional)
// @route   GET /api/client-plans
// @access  Private/Staff (admin o professional)
export const getAllClientPlans = async (req, res) => {
  try {
    // Dejar los planes en el estado de "ahora" antes de listar
    await advancePlans();

    const filter = { status: { $in: ['active', 'expired'] } };
    // SEGURIDAD: antes un profesional recibía los planes (con nombre y correo) de todos los
    // pacientes del centro. El alcance lo decide el servidor, con la misma regla de pertenencia.
    if (req.user.role === 'professional') {
      const ownedIds = await User.distinct('_id', { role: 'patient', $or: ownedPatientsOr(req.user._id) });
      filter.patient = { $in: ownedIds };
    }

    const clientPlans = await ClientPlan.find(filter)
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
    const summary = await runPlanLifecycleJob();

    res.status(200).json({
      success: true,
      message: 'Verificación de planes completa',
      data: summary
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error al verificar vencimientos'
    });
  }
};

// @desc    Cambiar el plazo de pago (días desde que empieza el ciclo nuevo) de los planes vigentes de un paciente y servicio
// @route   PUT /api/client-plans/:id/grace-days   { graceDays }
// @access  Private/Admin, Private/Professional (sus pacientes)
export const updateGraceDays = async (req, res) => {
  try {
    const { graceDays } = req.body;
    if (!isValidGraceDays(graceDays)) {
      return res.status(400).json({ success: false, message: `El plazo de pago debe ser un número de días entre 0 y ${MAX_GRACE_DAYS}` });
    }

    const plan = await ClientPlan.findById(req.params.id);
    if (!plan || !(await canAccessPatient(req.user, plan.patient))) {
      return res.status(404).json({ success: false, message: 'Plan no encontrado' });
    }

    // Todos los ciclos vigentes del mismo paciente y servicio quedan con el mismo plazo
    const plans = await ClientPlan.find({
      patient: plan.patient,
      serviceType: plan.serviceType,
      status: { $in: ['active', 'upcoming'] }
    });

    const now = new Date();
    for (const p of plans) {
      if (p.paymentPending && paymentDueBy(p.startDate, graceDays).getTime() <= now.getTime()) {
        return res.status(400).json({
          success: false,
          message: 'Con ese plazo la fecha de pago ya habría pasado. Elige un plazo mayor.'
        });
      }
    }
    for (const p of plans) {
      p.graceDays = graceDays;
      if (p.paymentPending) p.paymentDueBy = paymentDueBy(p.startDate, graceDays);
      await p.save();
    }
    if (!plans.some((p) => String(p._id) === String(plan._id))) {
      plan.graceDays = graceDays;
      await plan.save();
    }

    res.json({ success: true, message: 'Plazo de pago actualizado', data: { graceDays } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'No se pudo actualizar el plazo de pago' });
  }
};

// @desc    Cambiar la fecha de inicio de un plan (mueve también los demás ciclos del mismo pago)
// @route   PUT /api/client-plans/:id/start-date   { startDate: 'YYYY-MM-DD' }
// @access  Private/Admin, Private/Professional (sus pacientes)
export const updatePlanStartDate = async (req, res) => {
  try {
    const plan = await ClientPlan.findById(req.params.id);
    if (!plan || !(await canAccessPatient(req.user, plan.patient))) {
      return res.status(404).json({ success: false, message: 'Plan no encontrado' });
    }

    const cycles = await changePlanStartDate(plan, req.body?.startDate);
    await advancePlans({ patientId: plan.patient });

    res.json({
      success: true,
      message: 'Fecha de inicio actualizada. Las sesiones ya usadas se mantienen.',
      data: { updated: cycles.length }
    });
  } catch (error) {
    if (error instanceof PlanDateError) {
      return res.status(400).json({ success: false, message: error.message });
    }
    res.status(500).json({ success: false, message: 'No se pudo cambiar la fecha de inicio' });
  }
};
