import express from 'express';
import { google } from 'googleapis';
import { protect } from '../middleware/auth.js';
import Appointment from '../models/Appointment.js';

const router = express.Router();

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
