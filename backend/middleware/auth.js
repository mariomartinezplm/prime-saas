import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import User from '../models/User.js';

// Proteger rutas - verificar JWT
export const protect = async (req, res, next) => {
  let token;

  // Verificar si el token existe en el header Authorization
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      // Obtener token del header
      token = req.headers.authorization.split(' ')[1];

      // Verificar token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Obtener usuario del token (sin incluir password)
      req.user = await User.findById(decoded.id).select('-password');

      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Usuario no encontrado'
        });
      }

      if (!req.user.isActive) {
        return res.status(401).json({
          success: false,
          message: 'Usuario inactivo'
        });
      }

      next();
    } catch (error) {
      console.error('Error en autenticación:', error);
      return res.status(401).json({
        success: false,
        message: 'No autorizado, token inválido'
      });
    }
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'No autorizado, no se proporcionó token'
    });
  }
};

// Autorizar roles específicos
export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `El rol '${req.user.role}' no está autorizado para acceder a este recurso`
      });
    }
    next();
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// PERTENENCIA — regla única de acceso a datos de un paciente (BLUEPRINT.md §8.5)
//
//   admin        → todo
//   professional → sus pacientes asignados (assignedProfessionalId) y sus propios datos
//   patient      → solo lo suyo
//
// Se responde 404 (no 403) cuando no hay permiso: un 403 confirmaría que ese
// paciente existe, y eso ya es información que no corresponde entregar.
// ─────────────────────────────────────────────────────────────────────────────
export const canAccessPatient = async (requester, patientId) => {
  if (!requester || !patientId) return false;

  // El id puede venir crudo o dentro de un documento ya poblado
  const targetId = (patientId._id || patientId).toString();
  if (!mongoose.Types.ObjectId.isValid(targetId)) return false;

  if (requester.role === 'admin') return true;

  // Cualquiera accede siempre a sus propios datos
  if (targetId === requester._id.toString()) return true;

  if (requester.role === 'professional') {
    const patient = await User.findById(targetId).select('assignedProfessionalId role');
    if (!patient) return false;

    // Paciente SIN profesional asignado: queda en un "pool" visible para todo el
    // staff, para que nadie se pierda del sistema por un dato incompleto. En cuanto
    // se le asigna un profesional, pasa a verlo solo ese profesional (y el admin).
    if (!patient.assignedProfessionalId) return patient.role === 'patient';

    return patient.assignedProfessionalId.toString() === requester._id.toString();
  }

  return false;
};

// Versión middleware: lee el id del paciente desde los params (o el body) de la ruta
export const authorizePatientAccess = (field = 'patientId') => {
  return async (req, res, next) => {
    try {
      const patientId = req.params[field] || req.body[field];

      if (await canAccessPatient(req.user, patientId)) {
        return next();
      }

      return res.status(404).json({
        success: false,
        message: 'Recurso no encontrado'
      });
    } catch (error) {
      return next(error);
    }
  };
};

// Middleware: solo el propio profesional (o un admin) puede tocar su configuración
export const authorizeSelfOrAdmin = (field = 'professionalId') => {
  return (req, res, next) => {
    if (req.user.role === 'admin') return next();

    if (req.params[field] && req.params[field].toString() === req.user._id.toString()) {
      return next();
    }

    return res.status(403).json({
      success: false,
      message: 'Solo puedes modificar tu propia configuración'
    });
  };
};

// Helper para autorizar staff (admin + professional)
export const authorizeStaff = authorize('admin', 'professional');

// Generar JWT Token
export const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '7d'
  });
};
