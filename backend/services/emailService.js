import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { escapeHtml } from '../middleware/sanitize.js';

/**
 * Envío de correos con Resend (Paso 11 de BLUEPRINT.md).
 *
 * Se usa `fetch` directo a la API de Resend en vez de instalar su paquete
 * oficial: es una sola petición HTTP simple (remitente, destinatario, asunto,
 * HTML), y `fetch` ya viene incluido en Node — mismo criterio que
 * `sanitizeMongo` en el Paso 06, una dependencia menos para algo así de
 * sencillo.
 */

const RESEND_API_URL = 'https://api.resend.com/emails';
const FROM_EMAIL = 'Prime F&H <no-responder@primefh.cl>';
const BRAND_TEAL = '#3D9AA6';

const formatDate = (date) =>
  format(new Date(date), "EEEE d 'de' MMMM, yyyy", { locale: es });

/**
 * Envío de bajo nivel, fire-and-forget: nunca lanza. Si falta la API key o
 * la petición falla, se registra el error y el flujo que llamó (crear una
 * cita, invitar a un paciente...) sigue funcionando igual — un correo que no
 * sale nunca debe tumbar una acción del negocio.
 */
export async function sendEmail({ to, subject, html }) {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    console.warn('⚠️  Email no enviado: falta RESEND_API_KEY en las variables de entorno');
    return { ok: false, reason: 'RESEND_API_KEY no configurada' };
  }

  try {
    const response = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ from: FROM_EMAIL, to, subject, html })
    });

    if (!response.ok) {
      // No se registra el cuerpo del error (podría reflejar datos del
      // destinatario u otros detalles sensibles) — solo el código HTTP.
      console.error(`Error enviando email (Resend respondió ${response.status})`);
      return { ok: false, reason: `Resend respondió ${response.status}` };
    }

    console.log(`✉️  Email enviado: "${subject}"`);
    return { ok: true };
  } catch (error) {
    console.error('Error enviando email:', error.message);
    return { ok: false, reason: error.message };
  }
}

// ─── Plantilla base con la marca Prime ──────────────────────────────────────
// Todo el input de usuario que se interpola (nombres, motivos, notas) pasa
// por escapeHtml antes de llegar aquí — nunca se confía en texto libre
// escrito por una persona dentro de un email HTML.
function baseTemplate({ headerColor, headerEmoji, headerTitle, bodyHtml }) {
  return `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f8fafc; border-radius: 12px; overflow: hidden;">
      <div style="background: ${headerColor}; padding: 30px; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 24px;">${headerEmoji} ${headerTitle}</h1>
        <p style="color: rgba(255,255,255,0.85); margin: 8px 0 0;">Prime F&H</p>
      </div>
      <div style="padding: 30px;">
        ${bodyHtml}
      </div>
      <div style="padding: 0 30px 30px; text-align: center;">
        <p style="color: #94a3b8; font-size: 12px;">Este es un mensaje automático de Prime F&H.</p>
      </div>
    </div>
  `;
}

const filaTabla = (etiqueta, valor, ancho) => `
  <tr>
    <td style="padding: 8px 0; color: #64748b;${ancho ? ` width: ${ancho};` : ''}">${etiqueta}:</td>
    <td style="padding: 8px 0; font-weight: 600; color: #1e293b;">${valor}</td>
  </tr>
`;

// ─── Emails de citas (antes en utils/emailService.js, con otro proveedor) ──
// Misma firma que las funciones anteriores: appointmentController.js las
// llama tal cual, sin cambios más allá del import.

export async function sendAppointmentCreatedEmail({ patient, professional, date, startTime, endTime, type }) {
  const typeLabel = type === 'kinesiologia' ? 'Kinesiología' : type === 'evaluacion' ? 'Evaluación' : 'Entrenamiento';
  const patientName = `${patient.firstName} ${patient.lastName}`;

  const html = baseTemplate({
    headerColor: BRAND_TEAL,
    headerEmoji: '📅',
    headerTitle: 'Nueva Cita Agendada',
    bodyHtml: `
      <p style="font-size: 16px; color: #334155; margin-bottom: 20px;">
        Hola <strong>${escapeHtml(professional.firstName)}</strong>, tienes una nueva cita agendada:
      </p>
      <div style="background: white; border-radius: 8px; padding: 20px; border-left: 4px solid ${BRAND_TEAL};">
        <table style="width: 100%; border-collapse: collapse;">
          ${filaTabla('Paciente', escapeHtml(patientName), '120px')}
          ${filaTabla('Tipo', escapeHtml(typeLabel))}
          ${filaTabla('Fecha', formatDate(date))}
          ${filaTabla('Horario', escapeHtml(`${startTime} - ${endTime}`))}
        </table>
      </div>
    `
  });

  await sendEmail({
    to: professional.email,
    subject: `📅 Nueva cita: ${patientName} - ${startTime}`,
    html
  });
}

export async function sendAppointmentCancelledEmail({ patient, professional, date, startTime, cancelledBy, cancellationReason }) {
  const patientName = `${patient.firstName} ${patient.lastName}`;
  const cancelledByName = cancelledBy ? `${cancelledBy.firstName} ${cancelledBy.lastName}` : 'Sistema';

  const html = baseTemplate({
    headerColor: '#991b1b',
    headerEmoji: '❌',
    headerTitle: 'Cita Cancelada',
    bodyHtml: `
      <p style="font-size: 16px; color: #334155; margin-bottom: 20px;">
        Hola <strong>${escapeHtml(professional.firstName)}</strong>, se ha cancelado una cita:
      </p>
      <div style="background: white; border-radius: 8px; padding: 20px; border-left: 4px solid #dc2626;">
        <table style="width: 100%; border-collapse: collapse;">
          ${filaTabla('Paciente', escapeHtml(patientName), '130px')}
          ${filaTabla('Fecha', formatDate(date))}
          ${filaTabla('Hora', escapeHtml(startTime))}
          ${filaTabla('Cancelado por', escapeHtml(cancelledByName))}
          ${cancellationReason ? filaTabla('Motivo', escapeHtml(cancellationReason)) : ''}
        </table>
      </div>
    `
  });

  await sendEmail({
    to: professional.email,
    subject: `❌ Cita cancelada: ${patientName}`,
    html
  });
}

// ─── Reseteo de contraseña (Paso 13) ────────────────────────────────────────

export async function sendPasswordResetEmail({ user, resetUrl }) {
  const html = baseTemplate({
    headerColor: BRAND_TEAL,
    headerEmoji: '🔑',
    headerTitle: 'Restablece tu contraseña',
    bodyHtml: `
      <p style="font-size: 16px; color: #334155; margin-bottom: 20px;">
        Hola <strong>${escapeHtml(user.firstName)}</strong>, recibimos una solicitud para
        restablecer tu contraseña en Prime F&H. Elige una nueva:
      </p>
      <div style="text-align: center; margin: 24px 0;">
        <a href="${resetUrl}"
           style="display: inline-block; background: ${BRAND_TEAL}; color: white; text-decoration: none;
                  padding: 14px 28px; border-radius: 8px; font-weight: 600;">
          Restablecer contraseña
        </a>
      </div>
      <p style="font-size: 13px; color: #94a3b8;">
        Este link es válido por 10 minutos y solo se puede usar una vez. Si no fuiste tú,
        ignora este correo — tu contraseña actual sigue siendo válida. Si no funciona, cópialo
        y pégalo en tu navegador:<br>
        <span style="word-break: break-all;">${escapeHtml(resetUrl)}</span>
      </p>
    `
  });

  await sendEmail({
    to: user.email,
    subject: '🔑 Restablece tu contraseña — Prime F&H',
    html
  });
}

// ─── Invitación de alta (Paso 12) ───────────────────────────────────────────

export async function sendInviteEmail({ user, inviteUrl }) {
  const html = baseTemplate({
    headerColor: BRAND_TEAL,
    headerEmoji: '👋',
    headerTitle: 'Bienvenido a Prime F&H',
    bodyHtml: `
      <p style="font-size: 16px; color: #334155; margin-bottom: 20px;">
        Hola <strong>${escapeHtml(user.firstName)}</strong>, tu profesional te invitó a crear tu
        acceso al portal de pacientes de Prime F&H. Elige tu contraseña para activar tu cuenta:
      </p>
      <div style="text-align: center; margin: 24px 0;">
        <a href="${inviteUrl}"
           style="display: inline-block; background: ${BRAND_TEAL}; color: white; text-decoration: none;
                  padding: 14px 28px; border-radius: 8px; font-weight: 600;">
          Crear mi contraseña
        </a>
      </div>
      <p style="font-size: 13px; color: #94a3b8;">
        Este link es válido por 7 días y solo se puede usar una vez. Si no funciona, cópialo y
        pégalo en tu navegador:<br>
        <span style="word-break: break-all;">${escapeHtml(inviteUrl)}</span>
      </p>
    `
  });

  await sendEmail({
    to: user.email,
    subject: '👋 Bienvenido a Prime F&H — crea tu contraseña',
    html
  });
}

export async function sendAppointmentUpdatedEmail({ patient, professional, date, startTime, endTime, changes }) {
  const patientName = `${patient.firstName} ${patient.lastName}`;

  const html = baseTemplate({
    headerColor: '#b45309',
    headerEmoji: '🔄',
    headerTitle: 'Cita Modificada',
    bodyHtml: `
      <p style="font-size: 16px; color: #334155; margin-bottom: 20px;">
        Hola <strong>${escapeHtml(professional.firstName)}</strong>, se ha modificado una cita:
      </p>
      <div style="background: white; border-radius: 8px; padding: 20px; border-left: 4px solid #f59e0b;">
        <table style="width: 100%; border-collapse: collapse;">
          ${filaTabla('Paciente', escapeHtml(patientName), '120px')}
          ${filaTabla('Fecha', formatDate(date))}
          ${filaTabla('Horario', escapeHtml(`${startTime} - ${endTime}`))}
          ${changes ? filaTabla('Cambios', escapeHtml(changes)) : ''}
        </table>
      </div>
    `
  });

  await sendEmail({
    to: professional.email,
    subject: `🔄 Cita modificada: ${patientName}`,
    html
  });
}
