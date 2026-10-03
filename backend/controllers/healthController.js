import mongoose from 'mongoose';

// @desc    Chequeo de salud para monitoreo externo (UptimeRobot, Paso 27 de
//          BLUEPRINT.md) — sin datos sensibles en la respuesta. `version` (los
//          primeros 7 caracteres del commit que Railway desplegó) y `scheduler`
//          (si el programador de recordatorios/planes está encendido) permiten
//          comprobar desde afuera qué código corre y con qué configuración.
// @route   GET /api/health
// @access  Público
export const getHealth = (req, res) => {
  const dbConnected = mongoose.connection.readyState === 1;
  res.status(dbConnected ? 200 : 503).json({
    status: dbConnected ? 'ok' : 'error',
    db: dbConnected ? 'connected' : 'disconnected',
    version: (process.env.RAILWAY_GIT_COMMIT_SHA || 'local').slice(0, 7),
    scheduler: process.env.ENABLE_SCHEDULER === 'true' ? 'on' : 'off'
  });
};
