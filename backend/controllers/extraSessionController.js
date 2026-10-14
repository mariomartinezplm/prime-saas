import ExtraSession from '../models/ExtraSession.js';
import User from '../models/User.js';

// Las rutas "/me" no traen :patientId en la URL — en ese caso se resuelve al propio usuario.
// Si la ruta SÍ trae :patientId, se respeta tal cual (y el caller decide si rechazarlo o no
// según el rol), para no enmascarar un intento de acceder al recurso de otro paciente.
function resolvePatientId(req) {
  if (!req.params.patientId) return req.user._id.toString();
  return req.params.patientId;
}

// Lo que el PACIENTE puede ver de una sesión extra suya: solo los datos propios (lista cerrada). Quedan fuera el motivo que escribe
// el personal (`reason`), quién la otorgó (`grantedBy`) y la cita interna en que se usó. Un campo nuevo del modelo NO llega al
// paciente hasta agregarlo aquí.
export const PATIENT_EXTRA_SESSION_FIELDS = ['_id', 'patient', 'serviceType', 'date', 'used', 'usedAt', 'createdAt', 'updatedAt'];

export function toPatientExtraSessionView(extraSession) {
  const source = typeof extraSession.toObject === 'function' ? extraSession.toObject() : extraSession;
  return Object.fromEntries(PATIENT_EXTRA_SESSION_FIELDS.filter((field) => source[field] !== undefined).map((field) => [field, source[field]]));
}

// @desc    Otorgar una sesión extra a un paciente
// @route   POST /api/extra-sessions
// @access  Private/Staff (admin o professional)
export const createExtraSession = async (req, res) => {
  try {
    const { patientId, serviceType, reason } = req.body;

    if (!patientId || !serviceType) {
      return res.status(400).json({
        success: false,
        message: 'patientId y serviceType son requeridos'
      });
    }

    const patient = await User.findById(patientId);
    if (!patient || patient.role !== 'patient') {
      return res.status(404).json({
        success: false,
        message: 'Paciente no encontrado'
      });
    }

    // Un profesional solo puede otorgar sesiones extra a sus propios pacientes asignados
    if (
      req.user.role === 'professional' &&
      (!patient.assignedProfessionalId || patient.assignedProfessionalId.toString() !== req.user._id.toString())
    ) {
      return res.status(403).json({
        success: false,
        message: 'Solo puedes otorgar sesiones extra a tus pacientes asignados'
      });
    }

    const extraSession = await ExtraSession.create({
      patient: patientId,
      serviceType,
      reason,
      grantedBy: req.user._id
    });

    await extraSession.populate('patient', 'firstName lastName email');
    await extraSession.populate('grantedBy', 'firstName lastName');

    res.status(201).json({
      success: true,
      message: 'Sesión extra otorgada exitosamente',
      data: { extraSession }
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message || 'Error al otorgar la sesión extra'
    });
  }
};

// @desc    Listar sesiones extra de un paciente
// @route   GET /api/extra-sessions/patient/:patientId
// @access  Private (paciente propio o staff)
export const getPatientExtraSessions = async (req, res) => {
  try {
    const patientId = resolvePatientId(req);

    if (req.user.role === 'patient' && patientId !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permisos para ver las sesiones extra de este paciente'
      });
    }

    // El personal ve el documento completo (con el motivo y quién la otorgó); el paciente, solo los datos propios de la sesión
    const staff = ['admin', 'professional'].includes(req.user.role);
    let query = ExtraSession.find({ patient: patientId });
    if (staff) query = query.populate('grantedBy', 'firstName lastName');
    const found = await query.sort({ createdAt: -1 });
    const extraSessions = staff ? found : found.map(toPatientExtraSessionView);

    res.status(200).json({
      success: true,
      count: extraSessions.length,
      data: { extraSessions }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error al obtener las sesiones extra'
    });
  }
};
