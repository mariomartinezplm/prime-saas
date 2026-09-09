import mongoose from 'mongoose';

// @desc    Chequeo de salud para monitoreo externo (UptimeRobot, Paso 27 de
//          BLUEPRINT.md) — sin datos sensibles en la respuesta.
// @route   GET /api/health
// @access  Público
export const getHealth = (req, res) => {
  const dbConnected = mongoose.connection.readyState === 1;
  res.status(dbConnected ? 200 : 503).json({
    status: dbConnected ? 'ok' : 'error',
    db: dbConnected ? 'connected' : 'disconnected'
  });
};
