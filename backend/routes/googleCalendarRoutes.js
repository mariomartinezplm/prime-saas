import express from 'express';
import { google } from 'googleapis';
import { protect } from '../middleware/auth.js';
import Appointment from '../models/Appointment.js';

const router = express.Router();

/**
 * ⚠️ INTEGRACIÓN EN CUARENTENA (Paso 07 de BLUEPRINT.md)
 *
 * Este código NUNCA llegó a funcionar y además es inseguro. Se desactiva hasta
 * su rediseño (Paso 28), en vez de dejarlo accesible:
 *
 *  1. NO FUNCIONA: guarda los tokens en `req.user.googleTokens`, un campo que no
 *     existe en el modelo User, así que Mongoose los descarta en silencio. Lo
 *     mismo con `appointment.googleEventId`.
 *  2. FUGA ENTRE USUARIOS: `oauth2Client` es un único objeto compartido por todas
 *     las peticiones del servidor. Con dos personas usándolo a la vez, las
 *     credenciales de una pueden acabar aplicándose a la petición de la otra.
 *  3. SIN PROTECCIÓN CSRF: el flujo de OAuth no usa el parámetro `state`, así que
 *     un tercero puede inducir a conectar una cuenta de Google que no es la suya.
 *  4. PERMISOS EXCESIVOS: pide acceso total al calendario (leer, editar y borrar
 *     TODO), cuando solo necesita crear los eventos de las citas.
 *  5. SIN VERIFICAR PERTENENCIA: cualquiera podía sincronizar la cita de otra
 *     persona y ver sus notas.
 *  6. CAMPOS INEXISTENTES: usa `service`, `time_start` y `time_end`; el modelo
 *     tiene `type`, `startTime` y `endTime`.
 *
 * Para reactivarla hace falta el rediseño completo del Paso 28. El flag existe
 * solo para poder probar ese rediseño en local, no para encenderla como está.
 */
router.use((req, res, next) => {
  if (process.env.GOOGLE_CALENDAR_ENABLED === 'true') return next();

  return res.status(403).json({
    success: false,
    code: 'FEATURE_DISABLED',
    message: 'La sincronización con Google Calendar está temporalmente desactivada.'
  });
});

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  `${process.env.FRONTEND_URL}/auth/google/callback`
);

// Step 1: Generate Google OAuth URL
router.post('/auth-url', protect, (req, res) => {
  const scopes = ['https://www.googleapis.com/auth/calendar'];
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
  });
  res.json({ authUrl });
});

// Step 2: Exchange code for tokens
router.post('/callback', protect, async (req, res) => {
  try {
    const { code } = req.body;
    const { tokens } = await oauth2Client.getToken(code);
    req.user.googleTokens = tokens;
    await req.user.save();
    res.json({ success: true, message: 'Google Calendar conectado' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Step 3: Sync appointment to Google Calendar
router.post('/sync-appointment/:appointmentId', protect, async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.appointmentId);

    if (!req.user.googleTokens) {
      return res.status(400).json({ error: 'Google Calendar not connected' });
    }

    oauth2Client.setCredentials(req.user.googleTokens);
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    const event = {
      summary: `Sesión - ${appointment.service}`,
      start: { dateTime: new Date(appointment.date + ' ' + appointment.time_start) },
      end: { dateTime: new Date(appointment.date + ' ' + appointment.time_end) },
      description: appointment.notes,
    };

    const result = await calendar.events.insert({
      calendarId: 'primary',
      resource: event,
    });

    appointment.googleEventId = result.data.id;
    await appointment.save();

    res.json({ success: true, eventId: result.data.id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
