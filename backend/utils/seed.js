import dotenv from 'dotenv';
import mongoose from 'mongoose';
import crypto from 'crypto';
import User from '../models/User.js';
import Availability from '../models/Availability.js';
import connectDB from '../config/database.js';

dotenv.config();

// Conectar a la base de datos
connectDB();

// SEGURIDAD (Paso 02 de BLUEPRINT.md): ninguna contraseña queda escrita en el
// código. Se toman de variables de entorno locales o, si no existen, se generan
// al azar y se imprimen UNA sola vez al final para que Mario las guarde.
const generatedPasswords = [];

function seedPassword(envVarName, label) {
  const fromEnv = process.env[envVarName];
  if (fromEnv) return fromEnv;

  // 16 bytes en base64url ≈ 22 caracteres: legible para copiar y pegar una vez.
  const generated = crypto.randomBytes(16).toString('base64url');
  generatedPasswords.push({ label, password: generated });
  return generated;
}

const adminPassword = seedPassword('SEED_ADMIN_PASSWORD', 'Admin (mariomartinezplm@gmail.com)');
const professionalPassword = seedPassword('SEED_PROFESSIONAL_PASSWORD', 'Profesionales (felipe/tomas/rafael@primefh.cl)');
const patientPassword = seedPassword('SEED_PATIENT_PASSWORD', 'Paciente de prueba');

// Datos iniciales - Mario es admin, los demás son professional
const adminUser = {
  firstName: 'Mario',
  lastName: 'Martínez',
  email: 'mariomartinezplm@gmail.com',
  password: adminPassword,
  role: 'admin',
  phone: '+56912345678',
  rut: '12.345.678-9',
  isActive: true,
  dateOfBirth: new Date('1990-01-15'),
  specialty: 'Kinesiología y Entrenamiento'
};

const professionals = [
  {
    firstName: 'Felipe',
    lastName: 'Vega',
    email: 'felipe@primefh.cl',
    password: professionalPassword,
    role: 'professional',
    phone: '+56912345679',
    rut: '13.456.789-0',
    isActive: true,
    dateOfBirth: new Date('1992-03-20'),
    specialty: 'Kinesiología'
  },
  {
    firstName: 'Tomás',
    lastName: 'Espinoza',
    email: 'tomas@primefh.cl',
    password: professionalPassword,
    role: 'professional',
    phone: '+56912345680',
    rut: '14.567.890-1',
    isActive: true,
    dateOfBirth: new Date('1993-07-10'),
    specialty: 'Entrenamiento Personal'
  },
  {
    firstName: 'Rafael',
    lastName: 'Castañeda',
    email: 'rafael@primefh.cl',
    password: professionalPassword,
    role: 'professional',
    phone: '+56912345681',
    rut: '15.678.901-2',
    isActive: true,
    dateOfBirth: new Date('1991-11-05'),
    specialty: 'Rehabilitación Deportiva'
  }
];

const samplePatients = [
  {
    firstName: 'Cony',
    lastName: 'Bravo',
    email: 'conybravo.cabs@gmail.com',
    password: patientPassword,
    role: 'patient',
    phone: '+56987654321',
    dateOfBirth: new Date('1992-08-15'),
    rut: '16.789.012-3',
    address: 'Puerto Montt',
    emergencyContact: {
      name: 'Contacto Emergencia',
      phone: '+56987654322',
      relationship: 'Familiar'
    },
    medicalInfo: {
      chronicConditions: [],
      allergies: [],
      injuries: []
    }
  }
];

// Default weekly schedule for professionals
const defaultWeeklySchedule = [
  {
    dayOfWeek: 1, slots: [ // Lunes
      { startTime: '07:00', endTime: '08:00' },
      { startTime: '08:00', endTime: '09:00' },
      { startTime: '09:00', endTime: '10:00' },
      { startTime: '10:00', endTime: '11:00' },
      { startTime: '11:00', endTime: '12:00' },
      { startTime: '15:00', endTime: '16:00' },
      { startTime: '16:00', endTime: '17:00' },
      { startTime: '17:00', endTime: '18:00' },
      { startTime: '18:00', endTime: '19:00' },
      { startTime: '19:00', endTime: '20:00' }
    ]
  },
  {
    dayOfWeek: 2, slots: [ // Martes
      { startTime: '07:00', endTime: '08:00' },
      { startTime: '08:00', endTime: '09:00' },
      { startTime: '09:00', endTime: '10:00' },
      { startTime: '10:00', endTime: '11:00' },
      { startTime: '11:00', endTime: '12:00' },
      { startTime: '15:00', endTime: '16:00' },
      { startTime: '16:00', endTime: '17:00' },
      { startTime: '17:00', endTime: '18:00' },
      { startTime: '18:00', endTime: '19:00' },
      { startTime: '19:00', endTime: '20:00' }
    ]
  },
  {
    dayOfWeek: 3, slots: [ // Miércoles
      { startTime: '07:00', endTime: '08:00' },
      { startTime: '08:00', endTime: '09:00' },
      { startTime: '09:00', endTime: '10:00' },
      { startTime: '10:00', endTime: '11:00' },
      { startTime: '11:00', endTime: '12:00' },
      { startTime: '15:00', endTime: '16:00' },
      { startTime: '16:00', endTime: '17:00' },
      { startTime: '17:00', endTime: '18:00' },
      { startTime: '18:00', endTime: '19:00' },
      { startTime: '19:00', endTime: '20:00' }
    ]
  },
  {
    dayOfWeek: 4, slots: [ // Jueves
      { startTime: '07:00', endTime: '08:00' },
      { startTime: '08:00', endTime: '09:00' },
      { startTime: '09:00', endTime: '10:00' },
      { startTime: '10:00', endTime: '11:00' },
      { startTime: '11:00', endTime: '12:00' },
      { startTime: '15:00', endTime: '16:00' },
      { startTime: '16:00', endTime: '17:00' },
      { startTime: '17:00', endTime: '18:00' },
      { startTime: '18:00', endTime: '19:00' },
      { startTime: '19:00', endTime: '20:00' }
    ]
  },
  {
    dayOfWeek: 5, slots: [ // Viernes
      { startTime: '07:00', endTime: '08:00' },
      { startTime: '08:00', endTime: '09:00' },
      { startTime: '09:00', endTime: '10:00' },
      { startTime: '10:00', endTime: '11:00' },
      { startTime: '11:00', endTime: '12:00' },
      { startTime: '15:00', endTime: '16:00' },
      { startTime: '16:00', endTime: '17:00' },
      { startTime: '17:00', endTime: '18:00' },
      { startTime: '18:00', endTime: '19:00' },
      { startTime: '19:00', endTime: '20:00' }
    ]
  }
];

// Función para poblar la base de datos
const seedDatabase = async () => {
  try {
    console.log('Iniciando seed de la base de datos...\n');

    // Limpiar datos existentes (CUIDADO: solo usar en desarrollo)
    if (process.env.NODE_ENV === 'development') {
      console.log('Limpiando datos existentes...');
      await User.deleteMany({});
      await Availability.deleteMany({});
      console.log('Datos limpiados\n');
    }

    // Crear usuario administrador (Mario Martínez)
    console.log('Creando usuario administrador...');
    const admin = await User.create(adminUser);
    console.log(`Admin creado: ${admin.fullName} (${admin.email})\n`);

    // Crear disponibilidad para el admin
    await Availability.create({
      professional: admin._id,
      weeklySchedule: defaultWeeklySchedule
    });

    // Crear profesionales
    console.log('Creando profesionales...');
    for (const profData of professionals) {
      const prof = await User.create(profData);
      console.log(`Professional creado: ${prof.fullName} (${prof.email}) - ${prof.specialty}`);

      // Create availability for each professional
      await Availability.create({
        professional: prof._id,
        weeklySchedule: defaultWeeklySchedule
      });
    }

    // Crear pacientes de ejemplo
    console.log('\nCreando pacientes de ejemplo...');
    for (const patientData of samplePatients) {
      const patient = await User.create(patientData);
      console.log(`Paciente creado: ${patient.fullName} (${patient.email})`);
    }

    console.log('\nSeed completado exitosamente!\n');
    console.log('Credenciales de acceso:');
    console.log('========================================');
    console.log('ADMINISTRADOR (Mario Martinez):');
    console.log(`   Email: ${adminUser.email}`);
    console.log(`   RUT: ${adminUser.rut}`);
    console.log(`   Password: ${adminUser.password}`);
    console.log('========================================');
    console.log('PROFESIONALES:');
    professionals.forEach((prof) => {
      console.log(`\n   ${prof.firstName} ${prof.lastName} (${prof.specialty}):`);
      console.log(`      Email: ${prof.email}`);
      console.log(`      RUT: ${prof.rut}`);
      console.log(`      Password: ${prof.password}`);
    });
    console.log('========================================');
    console.log('PACIENTES DE EJEMPLO:');
    samplePatients.forEach((patient, index) => {
      console.log(`\n   ${index + 1}. ${patient.firstName} ${patient.lastName}:`);
      console.log(`      Email: ${patient.email}`);
      console.log(`      RUT: ${patient.rut}`);
      console.log(`      Password: ${patient.password}`);
    });
    console.log('========================================\n');

    if (generatedPasswords.length > 0) {
      console.log('⚠️  GUARDA ESTAS CONTRASEÑAS AHORA — no se vuelven a mostrar.');
      console.log('   Se generaron al azar porque no definiste estas variables en tu .env local:');
      generatedPasswords.forEach(({ label }) => console.log(`      · ${label}`));
      console.log('   Para elegirlas tú, define SEED_ADMIN_PASSWORD, SEED_PROFESSIONAL_PASSWORD');
      console.log('   y SEED_PATIENT_PASSWORD en tu .env local antes de correr el seed.\n');
    }

    process.exit(0);
  } catch (error) {
    console.error('Error en seed:', error.message);
    process.exit(1);
  }
};

// Ejecutar seed
seedDatabase();
