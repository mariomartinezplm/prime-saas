import nodemailer from 'nodemailer';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

// ─── Configuración del transporter ───────────────────────────────────────────
let transporter = null;

function getTransporter() {
    if (transporter) return transporter;

    const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;

    if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
        console.warn('⚠️  Email no configurado: faltan variables SMTP_HOST, SMTP_USER o SMTP_PASS en .env');
        return null;
    }

    transporter = nodemailer.createTransport({
        host: SMTP_HOST,
        port: parseInt(SMTP_PORT || '587'),
        secure: (SMTP_PORT || '587') === '465',
        auth: {
            user: SMTP_USER,
            pass: SMTP_PASS
        }
    });

    return transporter;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function formatDate(date) {
    return format(new Date(date), "EEEE d 'de' MMMM, yyyy", { locale: es });
}

function formatTime(time) {
    return time; // Already HH:MM format
}

const FROM_EMAIL = () => process.env.SMTP_FROM || process.env.SMTP_USER || 'notificaciones@primefh.cl';

// ─── Templates ───────────────────────────────────────────────────────────────
function appointmentCreatedHTML(data) {
    const { patientName, professionalName, date, startTime, endTime, type } = data;
    const typeLabel = type === 'kinesiologia' ? 'Kinesiología' : type === 'evaluacion' ? 'Evaluación' : 'Entrenamiento';

    return `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f8fafc; border-radius: 12px; overflow: hidden;">
      <div style="background: linear-gradient(135deg, #1a365d, #2d5a87); padding: 30px; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 24px;">📅 Nueva Cita Agendada</h1>
        <p style="color: rgba(255,255,255,0.8); margin: 8px 0 0;">Prime F&H</p>
      </div>
      <div style="padding: 30px;">
        <p style="font-size: 16px; color: #334155; margin-bottom: 20px;">
          Hola <strong>${professionalName}</strong>, tienes una nueva cita agendada:
        </p>
        <div style="background: white; border-radius: 8px; padding: 20px; border-left: 4px solid #2d8f7b;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="padding: 8px 0; color: #64748b; width: 120px;">Paciente:</td><td style="padding: 8px 0; font-weight: 600; color: #1e293b;">${patientName}</td></tr>
            <tr><td style="padding: 8px 0; color: #64748b;">Tipo:</td><td style="padding: 8px 0; font-weight: 600; color: #1e293b;">${typeLabel}</td></tr>
            <tr><td style="padding: 8px 0; color: #64748b;">Fecha:</td><td style="padding: 8px 0; font-weight: 600; color: #1e293b;">${formatDate(date)}</td></tr>
            <tr><td style="padding: 8px 0; color: #64748b;">Horario:</td><td style="padding: 8px 0; font-weight: 600; color: #1e293b;">${formatTime(startTime)} - ${formatTime(endTime)}</td></tr>
          </table>
        </div>
      </div>
      <div style="padding: 0 30px 30px; text-align: center;">
        <p style="color: #94a3b8; font-size: 12px;">Este es un mensaje automático de Prime F&H.</p>
      </div>
    </div>
  `;
}

function appointmentCancelledHTML(data) {
    const { patientName, professionalName, date, startTime, cancelledByName, reason } = data;

    return `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f8fafc; border-radius: 12px; overflow: hidden;">
      <div style="background: linear-gradient(135deg, #991b1b, #dc2626); padding: 30px; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 24px;">❌ Cita Cancelada</h1>
        <p style="color: rgba(255,255,255,0.8); margin: 8px 0 0;">Prime F&H</p>
      </div>
      <div style="padding: 30px;">
        <p style="font-size: 16px; color: #334155; margin-bottom: 20px;">
          Hola <strong>${professionalName}</strong>, se ha cancelado una cita:
        </p>
        <div style="background: white; border-radius: 8px; padding: 20px; border-left: 4px solid #dc2626;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="padding: 8px 0; color: #64748b; width: 130px;">Paciente:</td><td style="padding: 8px 0; font-weight: 600; color: #1e293b;">${patientName}</td></tr>
            <tr><td style="padding: 8px 0; color: #64748b;">Fecha:</td><td style="padding: 8px 0; font-weight: 600; color: #1e293b;">${formatDate(date)}</td></tr>
            <tr><td style="padding: 8px 0; color: #64748b;">Hora:</td><td style="padding: 8px 0; font-weight: 600; color: #1e293b;">${formatTime(startTime)}</td></tr>
            <tr><td style="padding: 8px 0; color: #64748b;">Cancelado por:</td><td style="padding: 8px 0; font-weight: 600; color: #1e293b;">${cancelledByName}</td></tr>
            ${reason ? `<tr><td style="padding: 8px 0; color: #64748b;">Motivo:</td><td style="padding: 8px 0; color: #1e293b;">${reason}</td></tr>` : ''}
          </table>
        </div>
      </div>
      <div style="padding: 0 30px 30px; text-align: center;">
        <p style="color: #94a3b8; font-size: 12px;">Este es un mensaje automático de Prime F&H.</p>
      </div>
    </div>
  `;
}

function appointmentUpdatedHTML(data) {
    const { patientName, professionalName, date, startTime, endTime, changes } = data;

    return `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f8fafc; border-radius: 12px; overflow: hidden;">
      <div style="background: linear-gradient(135deg, #b45309, #f59e0b); padding: 30px; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 24px;">🔄 Cita Modificada</h1>
        <p style="color: rgba(255,255,255,0.8); margin: 8px 0 0;">Prime F&H</p>
      </div>
      <div style="padding: 30px;">
        <p style="font-size: 16px; color: #334155; margin-bottom: 20px;">
          Hola <strong>${professionalName}</strong>, se ha modificado una cita:
        </p>
        <div style="background: white; border-radius: 8px; padding: 20px; border-left: 4px solid #f59e0b;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="padding: 8px 0; color: #64748b; width: 120px;">Paciente:</td><td style="padding: 8px 0; font-weight: 600; color: #1e293b;">${patientName}</td></tr>
            <tr><td style="padding: 8px 0; color: #64748b;">Fecha:</td><td style="padding: 8px 0; font-weight: 600; color: #1e293b;">${formatDate(date)}</td></tr>
            <tr><td style="padding: 8px 0; color: #64748b;">Horario:</td><td style="padding: 8px 0; font-weight: 600; color: #1e293b;">${formatTime(startTime)} - ${formatTime(endTime)}</td></tr>
            ${changes ? `<tr><td style="padding: 8px 0; color: #64748b;">Cambios:</td><td style="padding: 8px 0; color: #1e293b;">${changes}</td></tr>` : ''}
          </table>
        </div>
      </div>
      <div style="padding: 0 30px 30px; text-align: center;">
        <p style="color: #94a3b8; font-size: 12px;">Este es un mensaje automático de Prime F&H.</p>
      </div>
    </div>
  `;
}

// ─── Send Functions (fire-and-forget, never throw) ───────────────────────────
export async function sendAppointmentCreatedEmail(appointmentData) {
    try {
        const transport = getTransporter();
        if (!transport) return;

        const { patient, professional, date, startTime, endTime, type } = appointmentData;

        await transport.sendMail({
            from: `"Prime F&H" <${FROM_EMAIL()}>`,
            to: professional.email,
            subject: `📅 Nueva cita: ${patient.firstName} ${patient.lastName} - ${formatTime(startTime)}`,
            html: appointmentCreatedHTML({
                patientName: `${patient.firstName} ${patient.lastName}`,
                professionalName: `${professional.firstName}`,
                date,
                startTime,
                endTime,
                type
            })
        });

        console.log(`✉️  Email de nueva cita enviado a ${professional.email}`);
    } catch (error) {
        console.error('Error enviando email de cita creada:', error.message);
    }
}

export async function sendAppointmentCancelledEmail(appointmentData) {
    try {
        const transport = getTransporter();
        if (!transport) return;

        const { patient, professional, date, startTime, cancelledBy, cancellationReason } = appointmentData;

        await transport.sendMail({
            from: `"Prime F&H" <${FROM_EMAIL()}>`,
            to: professional.email,
            subject: `❌ Cita cancelada: ${patient.firstName} ${patient.lastName}`,
            html: appointmentCancelledHTML({
                patientName: `${patient.firstName} ${patient.lastName}`,
                professionalName: `${professional.firstName}`,
                date,
                startTime,
                cancelledByName: cancelledBy ? `${cancelledBy.firstName} ${cancelledBy.lastName}` : 'Sistema',
                reason: cancellationReason
            })
        });

        console.log(`✉️  Email de cancelación enviado a ${professional.email}`);
    } catch (error) {
        console.error('Error enviando email de cancelación:', error.message);
    }
}

export async function sendAppointmentUpdatedEmail(appointmentData) {
    try {
        const transport = getTransporter();
        if (!transport) return;

        const { patient, professional, date, startTime, endTime, changes } = appointmentData;

        await transport.sendMail({
            from: `"Prime F&H" <${FROM_EMAIL()}>`,
            to: professional.email,
            subject: `🔄 Cita modificada: ${patient.firstName} ${patient.lastName}`,
            html: appointmentUpdatedHTML({
                patientName: `${patient.firstName} ${patient.lastName}`,
                professionalName: `${professional.firstName}`,
                date,
                startTime,
                endTime,
                changes
            })
        });

        console.log(`✉️  Email de modificación enviado a ${professional.email}`);
    } catch (error) {
        console.error('Error enviando email de modificación:', error.message);
    }
}
