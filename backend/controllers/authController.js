import User from '../models/User.js';
import RefreshToken from '../models/RefreshToken.js';
import { generateToken } from '../middleware/auth.js';
import { leerCookie } from '../utils/cookies.js';
import {
  REFRESH_TOKEN_TTL_MS,
  REFRESH_COOKIE_NAME,
  hashToken,
  generarRefreshToken,
  generarFamilyId,
  setRefreshCookie,
  clearRefreshCookie
} from '../utils/refreshTokens.js';
import crypto from 'crypto';

// Crea una familia de refresh token nueva y la deja en la cookie de la
// respuesta. Se usa en login y en cambio/reseteo de contraseña — en ambos
// casos el dispositivo actual necesita quedar con una sesión larga propia.
const emitirSesionNueva = async (res, user, req) => {
  const { rawToken, tokenHash } = generarRefreshToken();
  await RefreshToken.create({
    user: user._id,
    tokenHash,
    familyId: generarFamilyId(),
    expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
    userAgent: req.headers['user-agent'],
    ip: req.ip
  });
  setRefreshCookie(res, rawToken);
};

// Política de contraseñas (Paso 05 de BLUEPRINT.md). Debe coincidir con el
// minlength del modelo User; aquí se valida antes para devolver un 400 claro
// en vez del 500 que produciría el error de validación de Mongoose.
const MIN_PASSWORD_LENGTH = 8;
const PASSWORD_TOO_SHORT = `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres`;

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

    const user = await User.findOne(query).select('+password');

    // SEGURIDAD (Paso 02 de BLUEPRINT.md): aquí había un "Just-In-Time Sync" que,
    // ante un email desconocido, creaba la cuenta desde Airtable con una contraseña
    // fija. Cualquiera que conociera un email del Airtable entraba sin autorización.
    // Un email que no existe en la base ahora simplemente falla.

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

    // Generar access token (1h) + abrir una sesión de refresh nueva (30 días,
    // en cookie HttpOnly). Cada login abre su propia familia: cerrar sesión
    // en un dispositivo (o que le roben el refresh de ese dispositivo) nunca
    // afecta las sesiones abiertas en otros.
    const token = generateToken(user._id, user.role);
    await emitirSesionNueva(res, user, req);

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

    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      return res.status(400).json({
        success: false,
        message: PASSWORD_TOO_SHORT
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

    // Si alguien cambia su contraseña porque sospecha que le robaron la
    // cuenta, las sesiones viejas (potencialmente del atacante) deben morir
    // aquí, no seguir vivas hasta por 30 días más. El dispositivo actual se
    // queda conectado (decisión de Mario): se le abre una sesión nueva.
    await RefreshToken.updateMany(
      { user: user._id, revokedAt: null },
      { $set: { revokedAt: new Date() } }
    );

    const token = generateToken(user._id, user.role);
    await emitirSesionNueva(res, user, req);

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

    if (!newPassword || newPassword.length < MIN_PASSWORD_LENGTH) {
      return res.status(400).json({
        success: false,
        message: PASSWORD_TOO_SHORT
      });
    }

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

    // Mismo criterio que changePassword: cerrar todas las sesiones viejas
    // (pudo cambiarse la contraseña justo porque alguien más la tenía) y
    // abrir una nueva para el dispositivo actual.
    await RefreshToken.updateMany(
      { user: user._id, revokedAt: null },
      { $set: { revokedAt: new Date() } }
    );

    const token = generateToken(user._id, user.role);
    await emitirSesionNueva(res, user, req);

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

// @desc    Renovar access token usando el refresh token de la cookie
// @route   POST /api/auth/refresh
// @access  Público (identifica la sesión por la cookie, no por Bearer token:
//          un access token vencido no debe impedir renovar la sesión)
export const refresh = async (req, res) => {
  try {
    const rawToken = leerCookie(req, REFRESH_COOKIE_NAME);

    if (!rawToken) {
      return res.status(401).json({
        success: false,
        message: 'No hay sesión activa, inicia sesión de nuevo'
      });
    }

    const tokenHash = hashToken(rawToken);

    // Compare-and-swap atómico: "revocar SOLO SI sigue vivo" en una sola
    // operación. Si dos pestañas refrescan a la vez con la misma cookie,
    // solo una gana esta captura; la otra cae al caso de abajo, como si el
    // token ya se hubiera usado.
    const stored = await RefreshToken.findOneAndUpdate(
      { tokenHash, revokedAt: null },
      { $set: { revokedAt: new Date() } },
      { new: false } // interesa el documento ANTES del update
    );

    if (!stored) {
      // No se puede distinguir sin otra consulta si el token nunca existió,
      // ya expiró, o ya fue usado/revocado por otra petición — para quien
      // llama el resultado es el mismo: 401. Se busca de nuevo SOLO para
      // decidir si hay que revocar la familia entera (reuso real).
      const posibleReuso = await RefreshToken.findOne({ tokenHash });
      if (posibleReuso && (posibleReuso.revokedAt || posibleReuso.replacedByHash)) {
        await RefreshToken.updateMany(
          { familyId: posibleReuso.familyId, revokedAt: null },
          { $set: { revokedAt: new Date() } }
        );
      }

      clearRefreshCookie(res);
      return res.status(401).json({
        success: false,
        message: 'Sesión inválida, inicia sesión de nuevo',
        code: 'REFRESH_INVALID'
      });
    }

    // Defensa extra: el compare-and-swap solo mira revokedAt. Si el monitor
    // TTL de Mongo (corre cada ~60s) todavía no pasó a limpiar un token ya
    // vencido, este chequeo manual lo rechaza igual.
    if (stored.expiresAt.getTime() <= Date.now()) {
      clearRefreshCookie(res);
      return res.status(401).json({
        success: false,
        message: 'Sesión expirada, inicia sesión de nuevo'
      });
    }

    const user = await User.findById(stored.user);
    if (!user || !user.isActive) {
      clearRefreshCookie(res);
      return res.status(401).json({
        success: false,
        message: 'Usuario no encontrado o inactivo'
      });
    }

    // Rotar: nuevo token en la MISMA familia, heredando el expiresAt
    // original (decisión de Mario: 30 días fijos desde el login, no una
    // ventana que se renueva sola en cada uso).
    const { rawToken: newRawToken, tokenHash: newTokenHash } = generarRefreshToken();

    await RefreshToken.create({
      user: user._id,
      tokenHash: newTokenHash,
      familyId: stored.familyId,
      expiresAt: stored.expiresAt,
      userAgent: req.headers['user-agent'],
      ip: req.ip
    });

    await RefreshToken.updateOne(
      { _id: stored._id },
      { $set: { replacedByHash: newTokenHash } }
    );

    setRefreshCookie(res, newRawToken);

    const accessToken = generateToken(user._id, user.role);

    return res.status(200).json({
      success: true,
      message: 'Token renovado',
      data: { token: accessToken }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Error al renovar la sesión'
    });
  }
};

// @desc    Cerrar sesión: revoca el refresh token de este dispositivo
// @route   POST /api/auth/logout
// @access  Público (solo usa la cookie; un access vencido no debe impedir
//          cerrar sesión)
export const logout = async (req, res) => {
  try {
    const rawToken = leerCookie(req, REFRESH_COOKIE_NAME);

    if (rawToken) {
      // Revoca solo el token de ESTA cookie (este dispositivo), nunca toda
      // la familia — cerrar sesión en un dispositivo no debe cerrarla en
      // los demás. No importa si ya estaba revocado: el resultado para quien
      // llama es siempre el mismo.
      await RefreshToken.updateOne(
        { tokenHash: hashToken(rawToken), revokedAt: null },
        { $set: { revokedAt: new Date() } }
      );
    }

    clearRefreshCookie(res);
    return res.status(200).json({ success: true, message: 'Sesión cerrada' });
  } catch (error) {
    // El logout debe parecer exitoso incluso si algo interno falla: no tiene
    // sentido bloquear a alguien que se quiere ir.
    console.error('Error en logout:', error);
    clearRefreshCookie(res);
    return res.status(200).json({ success: true, message: 'Sesión cerrada' });
  }
};

