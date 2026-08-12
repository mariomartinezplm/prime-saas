import User from '../models/User.js';
import { generateToken } from '../middleware/auth.js';
import crypto from 'crypto';
import { syncPatientByEmail } from '../utils/airtableSync.js';

// NOTA DE SEGURIDAD (Paso 01 de BLUEPRINT.md):
// El registro público (POST /api/auth/register) fue eliminado. Las cuentas de
// pacientes se crean SOLO por invitación del profesional/admin (ver Paso 12).

// @desc    Login de usuario (por email o RUT)
// @route   POST /api/auth/login
// @access  Public
export const login = async (req, res) => {
  try {
    const { email, password, identifier } = req.body;

    // Soportar campo "identifier" (email o RUT) además de "email" por retrocompatibilidad
    const loginIdentifier = identifier || email;

    // Validar identifier y password
    if (!loginIdentifier || !password) {
      return res.status(400).json({
        success: false,
        message: 'Por favor ingrese email/RUT y contraseña'
      });
    }

    // Determinar si es email o RUT y buscar usuario
    const isEmail = loginIdentifier.includes('@');
    const query = isEmail
      ? { email: loginIdentifier.toLowerCase() }
      : { rut: loginIdentifier.trim() };

    let user = await User.findOne(query).select('+password');

    // Just-In-Time Sync con Airtable si no se encuentra
    if (!user && isEmail) {
      try {
        const syncedUser = await syncPatientByEmail(loginIdentifier);
        if (syncedUser) {
          // Volver a buscar para incluir el password seleccionado
          user = await User.findOne(query).select('+password');
        }
      } catch (err) {
        console.error('Error in JIT Airtable sync:', err);
      }
    }

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Credenciales inválidas'
      });
    }

    // Verificar si el usuario está activo
    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Usuario inactivo. Contacte al administrador.'
      });
    }

    // Verificar contraseña
    const isPasswordMatch = await user.comparePassword(password);

    if (!isPasswordMatch) {
      return res.status(401).json({
        success: false,
        message: 'Credenciales inválidas'
      });
    }

    // Generar token
    const token = generateToken(user._id);

    res.status(200).json({
      success: true,
      message: 'Login exitoso',
      data: {
        user: {
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          fullName: user.fullName,
          email: user.email,
          role: user.role,
          phone: user.phone,
          profileImage: user.profileImage
        },
        token
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error al iniciar sesión'
    });
  }
};

// @desc    Obtener usuario actual
// @route   GET /api/auth/me
// @access  Private
export const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    res.status(200).json({
      success: true,
      data: {
        user: {
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          fullName: user.fullName,
          email: user.email,
          role: user.role,
          phone: user.phone,
          dateOfBirth: user.dateOfBirth,
          rut: user.rut,
          address: user.address,
          profileImage: user.profileImage,
          emergencyContact: user.emergencyContact,
          medicalInfo: user.medicalInfo,
          createdAt: user.createdAt
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error al obtener datos del usuario'
    });
  }
};

// @desc    Actualizar perfil de usuario
// @route   PUT /api/auth/profile
// @access  Private
export const updateProfile = async (req, res) => {
  try {
    const fieldsToUpdate = {
      firstName: req.body.firstName,
      lastName: req.body.lastName,
      phone: req.body.phone,
      dateOfBirth: req.body.dateOfBirth,
      address: req.body.address,
      emergencyContact: req.body.emergencyContact,
      medicalInfo: req.body.medicalInfo,
      profileImage: req.body.profileImage
    };

    // Remover campos undefined
    Object.keys(fieldsToUpdate).forEach(key =>
      fieldsToUpdate[key] === undefined && delete fieldsToUpdate[key]
    );

    const user = await User.findByIdAndUpdate(
      req.user._id,
      fieldsToUpdate,
      {
        new: true,
        runValidators: true
      }
    );

    res.status(200).json({
      success: true,
      message: 'Perfil actualizado exitosamente',
      data: { user }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error al actualizar perfil'
    });
  }
};

// @desc    Cambiar contraseña
// @route   PUT /api/auth/change-password
// @access  Private
export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Por favor proporcione la contraseña actual y la nueva'
      });
    }

    // Obtener usuario con password
    const user = await User.findById(req.user._id).select('+password');

    // Verificar contraseña actual
    const isPasswordMatch = await user.comparePassword(currentPassword);

    if (!isPasswordMatch) {
      return res.status(401).json({
        success: false,
        message: 'Contraseña actual incorrecta'
      });
    }

    // Actualizar contraseña
    user.password = newPassword;
    await user.save();

    // Generar nuevo token
    const token = generateToken(user._id);

    res.status(200).json({
      success: true,
      message: 'Contraseña actualizada exitosamente',
      data: { token }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error al cambiar contraseña'
    });
  }
};

// @desc    Solicitar reseteo de contraseña
// @route   POST /api/auth/forgot-password
// @access  Public
export const forgotPassword = async (req, res) => {
  // Respuesta idéntica exista o no el usuario: no revelamos qué correos están
  // registrados (evita enumeración de cuentas).
  const genericResponse = {
    success: true,
    message: 'Si el email existe, recibirás instrucciones para restablecer tu contraseña.'
  };

  try {
    const { email } = req.body;

    if (!email || typeof email !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Ingresa tu correo electrónico'
      });
    }

    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      return res.status(200).json(genericResponse);
    }

    // Generar token de reseteo
    const resetToken = crypto.randomBytes(32).toString('hex');

    // Hash del token y establecer fecha de expiración (10 minutos)
    user.resetPasswordToken = crypto
      .createHash('sha256')
      .update(resetToken)
      .digest('hex');

    user.resetPasswordExpire = Date.now() + 10 * 60 * 1000; // 10 minutos

    await user.save({ validateBeforeSave: false });

    // TODO (Paso 13 de BLUEPRINT.md): enviar resetToken por email con Resend.
    // SEGURIDAD: el token NUNCA se devuelve en la respuesta HTTP. Quien no tiene
    // acceso al correo del titular no puede cambiarle la contraseña.

    res.status(200).json(genericResponse);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error al procesar solicitud'
    });
  }
};

// @desc    Resetear contraseña (por token email)
// @route   PUT /api/auth/reset-password/:resetToken
// @access  Public
export const resetPassword = async (req, res) => {
  try {
    const { newPassword } = req.body;

    // Hash del token recibido
    const resetPasswordToken = crypto
      .createHash('sha256')
      .update(req.params.resetToken)
      .digest('hex');

    // Buscar usuario con token válido y no expirado
    const user = await User.findOne({
      resetPasswordToken,
      resetPasswordExpire: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Token inválido o expirado'
      });
    }

    // Establecer nueva contraseña
    user.password = newPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;

    await user.save();

    // Generar nuevo token de autenticación
    const token = generateToken(user._id);

    res.status(200).json({
      success: true,
      message: 'Contraseña restablecida exitosamente',
      data: { token }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error al restablecer contraseña'
    });
  }
};

