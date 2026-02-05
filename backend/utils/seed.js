import dotenv from 'dotenv';
import mongoose from 'mongoose';
import User from '../models/User.js';
import Availability from '../models/Availability.js';
import connectDB from '../config/database.js';

dotenv.config();

// Conectar a la base de datos
connectDB();

// Datos iniciales - Mario es admin, los demás son professional
const adminUser = {
  firstName: 'Mario',
  lastName: 'Martínez',
  email: 'mariomartinezplm@gmail.com',
  password: '123456',
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
    lastName: 'Rosas',
    email: 'felipe@primefh.cl',
    password: 'Prime2024!',
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
    password: 'Prime2024!',
    role: 'professional',
    phone: '+56912345680',
    rut: '14.567.890-1',
    isActive: true,
    dateOfBirth: new Date('1993-07-10'),
    specialty: 'Entrenamiento Personal'
  },
  {
    firstName: 'Rafael',
    lastName: 'Silva',
    email: 'rafael@primefh.cl',
    password: 'Prime2024!',
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
    password: '123456',
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
  { dayOfWeek: 1, slots: [ // Lunes
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
  ]},
  { dayOfWeek: 2, slots: [ // Martes
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
  ]},
  { dayOfWeek: 3, slots: [ // Miércoles
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
  ]},
  { dayOfWeek: 4, slots: [ // Jueves
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
  ]},
  { dayOfWeek: 5, slots: [ // Viernes
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
  ]}
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

    process.exit(0);
  } catch (error) {
    console.error('Error en seed:', error.message);
    process.exit(1);
  }
};

// Ejecutar seed
seedDatabase();
