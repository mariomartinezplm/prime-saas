import jwt from 'jsonwebtoken';
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

// Middleware para verificar que el usuario es el propietario del recurso o es admin
export const authorizeOwnerOrAdmin = (resourceUserIdField = 'patient') => {
  return (req, res, next) => {
    // Si es admin, permitir acceso
    if (req.user.role === 'admin') {
      return next();
    }

    // Verificar si el usuario es el propietario del recurso
    const resourceUserId = req.params[resourceUserIdField] || req.body[resourceUserIdField];

    if (!resourceUserId || resourceUserId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permisos para acceder a este recurso'
      });
    }

    next();
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
