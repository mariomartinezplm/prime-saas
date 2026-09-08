import crypto from 'crypto';
import User from '../models/User.js';
import { sendInviteEmail } from './emailService.js';

/**
 * Invitación por email para activar una cuenta (Paso 12 de BLUEPRINT.md).
 *
 * Mismo patrón que forgotPassword/resetPassword y los refresh tokens: 32
 * bytes al azar como valor real (va en el link que recibe la persona), solo
 * su sha256 se guarda en la base de datos.
 */
const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 días

// El profesional/admin nunca elige la contraseña de un paciente — se genera
// una que nadie conoce, y la única forma de entrar es aceptando la
// invitación. Mismo patrón que ya usan airtableSync.js y scripts/migrate.js
// para las cuentas importadas.
export const generateUnusablePassword = () => crypto.randomBytes(32).toString('hex');

export const createInvite = async (userId) => {
  const user = await User.findById(userId);
  if (!user) return;

  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

  user.invite = {
    tokenHash,
    expiresAt: new Date(Date.now() + INVITE_TTL_MS),
    usedAt: null
  };
  await user.save({ validateBeforeSave: false });

  const inviteUrl = `${process.env.FRONTEND_URL}/invitacion/${rawToken}`;
  await sendInviteEmail({ user, inviteUrl });
};
