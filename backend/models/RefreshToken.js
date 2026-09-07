import mongoose from 'mongoose';

/**
 * Refresh tokens opacos (Paso 08 de BLUEPRINT.md).
 *
 * Colección separada de User: un usuario puede tener varias sesiones vivas a
 * la vez (celular + notebook), cada una con su propio documento. Meter esto
 * como un array dentro de User obligaría a reescribir el documento completo
 * del usuario en cada login/refresh/logout.
 */
const refreshTokenSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  // SEGURIDAD: igual que resetPasswordToken, nunca se guarda el valor plano
  // del refresh token — solo su SHA-256. Quien lea la base de datos no puede
  // usar estos hashes para autenticarse: necesitaría el token original, que
  // nunca se persiste. `unique` además es el índice que usan /refresh y
  // /logout para encontrar el token por su hash.
  tokenHash: {
    type: String,
    required: true,
    unique: true
  },

  // Comparte valor entre todos los tokens de una misma cadena de rotación
  // (se genera uno nuevo en cada login). Permite revocar "toda la familia"
  // con una sola query cuando se detecta reuso, sin saber de antemano
  // cuántos tokens tiene la cadena.
  familyId: {
    type: String,
    required: true,
    index: true
  },

  // Fecha FIJA heredada del login original (Decisión de Mario: la sesión
  // vence a los 30 días exactos desde que entró, use la app o no la use —
  // no se renueva en cada rotación). Es también el campo del índice TTL de
  // abajo: Mongo borra el documento solo al llegar esta fecha.
  expiresAt: {
    type: Date,
    required: true
  },

  // null mientras el token está vivo. Se setea al rotarlo, al hacer logout,
  // o al revocar toda la familia por sospecha de robo.
  revokedAt: {
    type: Date,
    default: null
  },

  // Hash del token que lo reemplazó al rotar. Distingue "reuso de un token ya
  // rotado" (señal de robo) de "logout normal" (revokedAt seteado pero esto
  // nunca se llenó).
  replacedByHash: {
    type: String,
    default: null
  },

  userAgent: String, // para que a futuro Mario pueda ver sus sesiones activas
  ip: String
}, {
  timestamps: true
});

// TTL: expireAfterSeconds:0 sobre una fecha ABSOLUTA borra el documento apenas
// se cumple expiresAt. El monitor TTL de Mongo corre cada ~60s, así que el
// borrado no es instantáneo, pero para entonces el token ya fue rechazado por
// la validación manual en el controller — esto es solo limpieza física.
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const RefreshToken = mongoose.model('RefreshToken', refreshTokenSchema);

export default RefreshToken;
