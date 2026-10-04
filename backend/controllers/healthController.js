import mongoose from 'mongoose';
import { isStorageConfigured } from '../services/storageService.js';
import { isAirtableConfigured } from '../utils/airtableSync.js';
import { googleConfigStatus } from '../utils/googleConfig.js';

// @desc    Chequeo de salud para monitoreo externo (UptimeRobot, Paso 27 de
//          BLUEPRINT.md) — sin datos sensibles en la respuesta. `version` (los
//          primeros 7 caracteres del commit que Railway desplegó) y `scheduler`
//          (si el programador de recordatorios/planes está encendido) permiten
//          comprobar desde afuera qué código corre y con qué configuración.
//          `storage` (R2), `email` (Resend) y `airtable` solo dicen si las variables están
//          cargadas ("on"/"off"); `google` además distingue "incomplete" y "bad-client-id".
//          Nunca se devuelve ningún valor.
// @route   GET /api/health
// @access  Público
export const getHealth = (req, res) => {
  const dbConnected = mongoose.connection.readyState === 1;
  res.status(dbConnected ? 200 : 503).json({
    status: dbConnected ? 'ok' : 'error',
    db: dbConnected ? 'connected' : 'disconnected',
    version: (process.env.RAILWAY_GIT_COMMIT_SHA || 'local').slice(0, 7),
    scheduler: process.env.ENABLE_SCHEDULER === 'true' ? 'on' : 'off',
    storage: isStorageConfigured() ? 'on' : 'off',
    email: process.env.RESEND_API_KEY ? 'on' : 'off',
    airtable: isAirtableConfigured() ? 'on' : 'off',
    google: googleConfigStatus()
  });
};
