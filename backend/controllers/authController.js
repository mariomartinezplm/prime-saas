import User from '../models/User.js';
import { generateToken } from '../middleware/auth.js';
import crypto from 'crypto';
import { syncPatientByEmail } from '../utils/airtableSync.js';

// @desc    Registrar nuevo usuario
// @route   POST /api/auth/register
// @access  Public
export const register = async (req, res) => {
  try {
    const { firstName, lastName, email, password, phone, dateOfBirth, rut } = req.body;

    // Verificar si el usuario ya existe
    const userExists = await User.findOne({ email: email.toLowerCase() });

    if (userExists) {
      return res.status(400).json({
        success: false,
        message: 'El email ya está registrado'
      });
    }

    // Crear usuario
    const user = await User.create({
      firstName,
      lastName,
      email: email.toLowerCase(),
      password,
      phone,
      dateOfBirth,
      rut,
      role: 'patient' // Por defecto, nuevos usuarios son pacientes
    });

    // Generar token
    const token = generateToken(user._id);

    res.status(201).json({
      success: true,
      message: 'Usuario registrado exitosamente',
      data: {
        user: {
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          role: user.role,
          phone: user.phone
        },
        token
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error al registrar usuario'
    });
  }
};

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
  try {
    const { email } = req.body;

    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'No existe usuario con ese email'
      });
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

    // En producción, aquí enviarías un email con el resetToken
    // Por ahora, devolvemos el token (solo para desarrollo)

    res.status(200).json({
      success: true,
      message: 'Token de reseteo generado. En producción se enviaría por email.',
      // REMOVER en producción:
      resetToken: resetToken
    });
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

// @desc    Verificar identidad del paciente (para crear/recuperar contraseña)
// @route   POST /api/auth/verify-identity
// @access  Public
export const verifyIdentity = async (req, res) => {
  try {
    const { identifier, phone, dateOfBirth } = req.body;

    if (!identifier) {
      return res.status(400).json({
        success: false,
        message: 'Ingresa tu RUT o correo electrónico'
      });
    }

    if (!phone && !dateOfBirth) {
      return res.status(400).json({
        success: false,
        message: 'Ingresa tu teléfono o fecha de nacimiento para verificar tu identidad'
      });
    }

    // Buscar usuario por email o RUT
    const isEmail = identifier.includes('@');
    const query = isEmail
      ? { email: identifier.toLowerCase() }
      : { rut: identifier.replace(/\./g, '').trim() };

    const user = await User.findOne(query);

    if (!user) {
      // Mensaje genérico por seguridad
      return res.status(404).json({
        success: false,
        message: 'No encontramos una cuenta con esos datos. Verifica tu información o contacta al equipo Prime F&H.'
      });
    }

    // Verificar identidad con datos personales
    let verified = false;

    // Verificación por teléfono
    if (phone) {
      const normalizedInputPhone = phone.replace(/\D/g, '');
      const normalizedUserPhone = (user.phone || '').replace(/\D/g, '');
      // Comparar los últimos 8 dígitos (ignora prefijo +56)
      const inputLast8 = normalizedInputPhone.slice(-8);
      const userLast8 = normalizedUserPhone.slice(-8);
      if (inputLast8.length >= 8 && inputLast8 === userLast8) {
        verified = true;
      }
    }

    // Verificación por fecha de nacimiento
    if (!verified && dateOfBirth && user.dateOfBirth) {
      const inputDate = new Date(dateOfBirth).toISOString().split('T')[0];
      const userDate = new Date(user.dateOfBirth).toISOString().split('T')[0];
      if (inputDate === userDate) {
        verified = true;
      }
    }

    if (!verified) {
      return res.status(401).json({
        success: false,
        message: 'Los datos proporcionados no coinciden con nuestros registros. Verifica e intenta de nuevo.'
      });
    }

    // Generar token temporal para establecer contraseña (válido 15 minutos)
    const verifyToken = crypto.randomBytes(32).toString('hex');

    user.resetPasswordToken = crypto
      .createHash('sha256')
      .update(verifyToken)
      .digest('hex');
    user.resetPasswordExpire = Date.now() + 15 * 60 * 1000; // 15 minutos

    await user.save({ validateBeforeSave: false });

    res.status(200).json({
      success: true,
      message: 'Identidad verificada correctamente',
      data: {
        verifyToken,
        firstName: user.firstName,
        maskedEmail: user.email
          ? user.email.replace(/(.{2})(.*)(@.*)/, '$1***$3')
          : null
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error al verificar identidad'
    });
  }
};

// @desc    Crear/establecer nueva contraseña (después de verificar identidad)
// @route   PUT /api/auth/set-password/:verifyToken
// @access  Public
export const setNewPassword = async (req, res) => {
  try {
    const { newPassword, confirmPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'La contraseña debe tener al menos 6 caracteres'
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Las contraseñas no coinciden'
      });
    }

    // Hash del token recibido
    const hashedToken = crypto
      .createHash('sha256')
      .update(req.params.verifyToken)
      .digest('hex');

    // Buscar usuario con token válido y no expirado
    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpire: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'El enlace ha expirado. Por favor, vuelve a verificar tu identidad.'
      });
    }

    // Establecer nueva contraseña
    user.password = newPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;

    await user.save();

    // Generar token de autenticación (login automático)
    const token = generateToken(user._id);

    res.status(200).json({
      success: true,
      message: '¡Contraseña creada exitosamente! Ya puedes acceder a tu cuenta.',
      data: {
        user: {
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          fullName: user.fullName,
          email: user.email,
          role: user.role
        },
        token
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error al establecer contraseña'
    });
  }
};

