import dotenv from 'dotenv';
import mongoose from 'mongoose';
import User from '../models/User.js';
import connectDB from '../config/database.js';

dotenv.config();

// Conectar a la base de datos
connectDB();

// Datos iniciales
const adminUser = {
  firstName: 'Mario',
  lastName: 'Martínez',
  email: 'mario@primefh.cl',
  password: 'Prime2024!', // CAMBIAR EN PRODUCCIÓN
  role: 'admin',
  phone: '+56912345678',
  isActive: true,
  dateOfBirth: new Date('1990-01-15')
};

const samplePatients = [
  {
    firstName: 'Juan',
    lastName: 'Pérez',
    email: 'juan.perez@example.com',
    password: 'Patient123!',
    role: 'patient',
    phone: '+56987654321',
    dateOfBirth: new Date('1985-05-20'),
    rut: '12345678-9',
    address: 'Calle Principal 123, Puerto Montt',
    emergencyContact: {
      name: 'María Pérez',
      phone: '+56987654322',
      relationship: 'Esposa'
    },
    medicalInfo: {
      chronicConditions: ['Hipertensión'],
      allergies: ['Penicilina'],
      injuries: ['Lesión de rodilla derecha (2022)']
    }
  },
  {
    firstName: 'Ana',
    lastName: 'González',
    email: 'ana.gonzalez@example.com',
    password: 'Patient123!',
    role: 'patient',
    phone: '+56912345679',
    dateOfBirth: new Date('1992-08-15'),
    rut: '98765432-1',
    address: 'Avenida Los Lagos 456, Puerto Montt',
    emergencyContact: {
      name: 'Pedro González',
      phone: '+56912345680',
      relationship: 'Padre'
    },
    medicalInfo: {
      chronicConditions: [],
      allergies: [],
      injuries: []
    }
  }
];

// Función para poblar la base de datos
const seedDatabase = async () => {
  try {
    console.log('🌱 Iniciando seed de la base de datos...\n');

    // Limpiar datos existentes (CUIDADO: solo usar en desarrollo)
    if (process.env.NODE_ENV === 'development') {
      console.log('🗑️  Limpiando datos existentes...');
      await User.deleteMany({});
      console.log('✅ Datos limpiados\n');
    }

    // Crear usuario administrador (Mario Martínez)
    console.log('👤 Creando usuario administrador...');
    const admin = await User.create(adminUser);
    console.log(`✅ Admin creado: ${admin.fullName} (${admin.email})\n`);

    // Crear pacientes de ejemplo
    console.log('👥 Creando pacientes de ejemplo...');
    for (const patientData of samplePatients) {
      const patient = await User.create(patientData);
      console.log(`✅ Paciente creado: ${patient.fullName} (${patient.email})`);
    }

    console.log('\n✨ Seed completado exitosamente!\n');
    console.log('📝 Credenciales de acceso:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('👨‍⚕️ ADMINISTRADOR (Mario Martínez):');
    console.log(`   Email: ${adminUser.email}`);
    console.log(`   Password: ${adminUser.password}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('👤 PACIENTES DE EJEMPLO:');
    samplePatients.forEach((patient, index) => {
      console.log(`\n   ${index + 1}. ${patient.firstName} ${patient.lastName}:`);
      console.log(`      Email: ${patient.email}`);
      console.log(`      Password: ${patient.password}`);
    });
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error en seed:', error.message);
    process.exit(1);
  }
};

// Ejecutar seed
seedDatabase();
