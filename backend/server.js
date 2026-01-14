import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import connectDB from './config/database.js';
import { errorHandler, notFound } from './middleware/error.js';

// Importar rutas
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import appointmentRoutes from './routes/appointmentRoutes.js';
import measurementRoutes from './routes/measurementRoutes.js';
import exerciseRoutes from './routes/exerciseRoutes.js';
import evaRoutes from './routes/evaRoutes.js';

// Cargar variables de entorno
dotenv.config();

// Conectar a MongoDB
connectDB();

// Inicializar Express
const app = express();

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
      eva: '/api/eva'
    }
  });
});

// Rutas de la API
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/measurements', measurementRoutes);
app.use('/api/exercises', exerciseRoutes);
app.use('/api/eva', evaRoutes);

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
  console.log(`   - EVA: http://localhost:${PORT}/api/eva\n`);
});

// Manejo de promesas no capturadas
process.on('unhandledRejection', (err) => {
  console.error('❌ Error no manejado:', err.message);
  server.close(() => process.exit(1));
});

export default app;
