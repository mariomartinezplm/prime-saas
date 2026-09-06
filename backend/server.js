import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';
import connectDB from './config/database.js';
import { errorHandler, notFound } from './middleware/error.js';
import { sanitizeMongo } from './middleware/sanitize.js';
import { apiLimiter } from './middleware/rateLimiter.js';

// Importar rutas
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import appointmentRoutes from './routes/appointmentRoutes.js';
import measurementRoutes from './routes/measurementRoutes.js';
import exerciseRoutes from './routes/exerciseRoutes.js';
import evaRoutes from './routes/evaRoutes.js';
import availabilityRoutes from './routes/availabilityRoutes.js';
import planRoutes from './routes/planRoutes.js';
import clientPlanRoutes from './routes/clientPlanRoutes.js';
import extraSessionRoutes from './routes/extraSessionRoutes.js';
import googleCalendarRoutes from './routes/googleCalendarRoutes.js';

// Cargar variables de entorno
dotenv.config();

// Conectar a MongoDB
connectDB();

// Inicializar Express
const app = express();

// ─── SEGURIDAD (Paso 06 de BLUEPRINT.md) ────────────────────────────────────

// Railway pone un proxy delante del servidor: sin esto, todas las peticiones
// parecerían venir de la misma IP y el límite de intentos sería inservible.
app.set('trust proxy', 1);

// Cabeceras de seguridad estándar (evita que la app se incruste en otro sitio,
// que el navegador adivine tipos de archivo, etc.)
app.use(helmet());

app.use(cors({
  origin: [process.env.FRONTEND_URL, 'http://localhost:5173', 'http://localhost:8080', 'http://localhost:8081'].filter(Boolean),
  credentials: true
}));

// Tope al tamaño de las peticiones: sin límite, alguien puede saturar la memoria
// del servidor enviando un cuerpo enorme. 1 MB sobra para formularios y fichas.
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Descarta operadores de MongoDB ($ne, $gt...) en lo que llega del exterior
app.use(sanitizeMongo);

// ─────────────────────────────────────────────────────────────────────────────

// Ruta de prueba
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'API de Prime F&H - Sistema de Gestión de Pacientes',
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth',
      users: '/api/users',
      appointments: '/api/appointments',
      measurements: '/api/measurements',
      exercises: '/api/exercises',
      eva: '/api/eva',
      availability: '/api/availability',
      plans: '/api/plans',
      clientPlans: '/api/client-plans',
      extraSessions: '/api/extra-sessions'
    }
  });
});

// Rutas de la API
// Techo general de peticiones para toda la API (los límites estrictos de login y
// recuperación de contraseña van en sus propias rutas, en authRoutes.js)
app.use('/api', apiLimiter);

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/measurements', measurementRoutes);
app.use('/api/exercises', exerciseRoutes);
app.use('/api/eva', evaRoutes);
app.use('/api/availability', availabilityRoutes);
app.use('/api/plans', planRoutes);
app.use('/api/client-plans', clientPlanRoutes);
app.use('/api/extra-sessions', extraSessionRoutes);

app.use('/api/google-calendar', googleCalendarRoutes);

// Middleware de manejo de errores
app.use(notFound);
app.use(errorHandler);

// Puerto del servidor
const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log(`\n🚀 Servidor corriendo en modo ${process.env.NODE_ENV || 'development'}`);
  console.log(`📡 Puerto: ${PORT}`);
  console.log(`🌐 URL: http://localhost:${PORT}`);
  console.log(`\n✨ API Endpoints disponibles:`);
  console.log(`   - Auth: http://localhost:${PORT}/api/auth`);
  console.log(`   - Users: http://localhost:${PORT}/api/users`);
  console.log(`   - Appointments: http://localhost:${PORT}/api/appointments`);
  console.log(`   - Measurements: http://localhost:${PORT}/api/measurements`);
  console.log(`   - Exercises: http://localhost:${PORT}/api/exercises`);
  console.log(`   - EVA: http://localhost:${PORT}/api/eva`);
  console.log(`   - Availability: http://localhost:${PORT}/api/availability`);
  console.log(`   - Plans: http://localhost:${PORT}/api/plans\n`);
});

// Manejo de promesas no capturadas
process.on('unhandledRejection', (err) => {
  console.error('❌ Error no manejado:', err.message);
  server.close(() => process.exit(1));
});

export default app;
