import jwt from 'jsonwebtoken';
import { google } from 'googleapis';
import User from '../models/User.js';
import Appointment from '../models/Appointment.js';
import { encrypt, decrypt } from '../utils/encryption.js';

// Rediseño completo (Paso 28 de BLUEPRINT.md) de la integración que estaba en
// cuarentena desde el Paso 07. Reemplaza: cliente OAuth compartido → uno por
// petición; sin CSRF → state firmado y atado al usuario que inició el flujo;
// scope total del calendario → solo calendar.events; tokens en un campo
// inexistente → User.googleTokens cifrado (select:false); sin chequeo de
// pertenencia → cada sync verifica que la cita sea del profesional que la pide.

const SCOPES = ['https://www.googleapis.com/auth/calendar.events'];
const STATE_PURPOSE = 'gcal-oauth';
const TYPE_LABELS = { kinesiologia: 'Kinesiología', entrenamiento: 'Entrenamiento', evaluacion: 'Evaluación' };

// Un cliente OAuth nuevo por petición — nunca un singleton a nivel de módulo,
// que es lo que causaba que las credenciales de un usuario se filtraran a otro.
function buildOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.FRONTEND_URL}/auth/google/callback`
  );
}

export const getAuthUrl = (req, res) => {
  const state = jwt.sign({ uid: req.user._id.toString(), purpose: STATE_PURPOSE }, process.env.JWT_SECRET, {
    expiresIn: '10m'
  });

  const oauth2Client = buildOAuthClient();
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: SCOPES,
    state
  });

  res.status(200).json({ success: true, data: { authUrl } });
};

export const handleCallback = async (req, res) => {
  try {
    const { code, state } = req.body;
    if (!code || !state) {
      return res.status(400).json({ success: false, message: 'Falta code o state' });
    }

    let payload;
    try {
      payload = jwt.verify(state, process.env.JWT_SECRET);
    } catch {
      return res.status(400).json({ success: false, message: 'state inválido o expirado' });
    }

    // Ata el state a quien inició el flujo: si otra persona (autenticada como
    // sí misma) completa este callback con un state ajeno, se rechaza — así
    // no puede terminar vinculando su sesión con la cuenta de Google de otro.
    if (payload.purpose !== STATE_PURPOSE || payload.uid !== req.user._id.toString()) {
      return res.status(400).json({ success: false, message: 'state no corresponde a este usuario' });
    }

    const oauth2Client = buildOAuthClient();
    const { tokens } = await oauth2Client.getToken(code);

    await User.findByIdAndUpdate(req.user._id, { googleTokens: encrypt(JSON.stringify(tokens)) });

    res.status(200).json({ success: true, message: 'Google Calendar conectado' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Error al conectar Google Calendar' });
  }
};

export const disconnect = async (req, res) => {
  await User.findByIdAndUpdate(req.user._id, { $unset: { googleTokens: 1 } });
  res.status(200).json({ success: true, message: 'Google Calendar desconectado' });
};

export const getStatus = async (req, res) => {
  const user = await User.findById(req.user._id).select('+googleTokens');
  res.status(200).json({ success: true, data: { connected: !!user.googleTokens } });
};

export const syncAppointment = async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.appointmentId);
    if (!appointment) {
      return res.status(404).json({ success: false, message: 'Cita no encontrada' });
    }

    // Pertenencia: solo el profesional de la cita puede sincronizarla a SU
    // propio calendario. El admin no queda exento — sincronizar la cita de
    // otro profesional no tiene sentido (iría al calendario equivocado).
    if (appointment.professional.toString() !== req.user._id.toString()) {
      return res.status(404).json({ success: false, message: 'Cita no encontrada' });
    }

    const user = await User.findById(req.user._id).select('+googleTokens');
    if (!user.googleTokens) {
      return res.status(400).json({
        success: false,
        code: 'NOT_CONNECTED',
        message: 'Primero conecta tu cuenta de Google Calendar'
      });
    }

    const oauth2Client = buildOAuthClient();
    oauth2Client.setCredentials(JSON.parse(decrypt(user.googleTokens)));
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    const dateStr = appointment.date.toISOString().split('T')[0];
    const event = {
      summary: `Prime F&H — ${TYPE_LABELS[appointment.type] || appointment.type}`,
      description: appointment.notes || undefined,
      start: { dateTime: `${dateStr}T${appointment.startTime}:00`, timeZone: 'America/Santiago' },
      end: { dateTime: `${dateStr}T${appointment.endTime}:00`, timeZone: 'America/Santiago' }
    };

    const result = appointment.googleEventId
      ? await calendar.events.update({ calendarId: 'primary', eventId: appointment.googleEventId, requestBody: event })
      : await calendar.events.insert({ calendarId: 'primary', requestBody: event });

    appointment.googleEventId = result.data.id;
    await appointment.save();

    res.status(200).json({ success: true, data: { eventId: result.data.id } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Error al sincronizar con Google Calendar' });
  }
};
