/**
 * =============================================================
 *  MIGRATE.JS — Migración de pacientes desde Airtable a MongoDB
 * =============================================================
 *
 *  Uso:
 *    node scripts/migrate.js            → Ejecuta la migración
 *    node scripts/migrate.js --dry-run  → Simula sin escribir en MongoDB
 *    node scripts/migrate.js --preview  → Muestra los primeros 5 registros de Airtable
 *
 *  Requisitos:
 *    - Variables en .env: AIRTABLE_API_KEY, AIRTABLE_BASE_ID, AIRTABLE_TABLE_NAME, MONGODB_URI
 *    - npm install airtable mongoose dotenv bcryptjs
 */

import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Airtable from 'airtable';
import bcrypt from 'bcryptjs';

// ─── 1. Cargar variables de entorno ──────────────────────────────────────────
dotenv.config();

const {
    AIRTABLE_API_KEY,
    AIRTABLE_BASE_ID,
    AIRTABLE_TABLE_NAME,
    MONGODB_URI
} = process.env;

// Validar variables obligatorias
const requiredVars = { AIRTABLE_API_KEY, AIRTABLE_BASE_ID, AIRTABLE_TABLE_NAME, MONGODB_URI };
for (const [key, value] of Object.entries(requiredVars)) {
    if (!value) {
        console.error(`❌ Variable de entorno faltante: ${key}`);
        console.error('   Revisa tu archivo .env y asegúrate de tener todas las variables configuradas.');
        process.exit(1);
    }
}

// ─── 2. Flags de CLI ─────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const PREVIEW = args.includes('--preview');

// ─── 3. Esquema de User (embebido para evitar dependencia circular) ──────────
const userSchema = new mongoose.Schema({
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, minlength: 6, select: false },
    role: { type: String, enum: ['admin', 'professional', 'patient'], default: 'patient' },
    specialty: { type: String, trim: true },
    phone: { type: String, trim: true },
    dateOfBirth: { type: Date },
    rut: { type: String, trim: true },
    address: { type: String, trim: true },
    gender: { type: String, enum: ['Masculino', 'Femenino', 'Otro', ''], default: '' },
    healthInsurance: { type: String, trim: true }, // Previsión: Fonasa, Isapre, etc.
    objectives: [String], // Objetivo: Salud, Estético, etc.
    assignedProfessional: { type: String, trim: true }, // Entrenador/Kinesiólogo asignado
    referralSource: { type: String, trim: true }, // Medio por el que llegó
    lastPaymentDate: { type: Date }, // Fecha de Pago
    emergencyContact: {
        name: String,
        phone: String,
        relationship: String
    },
    medicalInfo: {
        chronicConditions: [String],
        medications: [String],
        allergies: [String],
        injuries: [String],
        surgeries: [{ description: String, date: Date }]
    },
    isActive: { type: Boolean, default: true },
    profileImage: { type: String, default: '' },
    airtableId: { type: String, unique: true, sparse: true }, // Para tracking de migración
    lastActivityDate: { type: Date }, // Para automatización de inactivos
    source: { type: String, default: 'airtable' } // Origen del registro
}, { timestamps: true });

// Encriptar contraseña antes de guardar
userSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
});

const User = mongoose.model('User', userSchema);

// ─── 4. Mapeo de campos Airtable → MongoDB ──────────────────────────────────
/**
 * IMPORTANTE: Ajusta estos nombres de campo según TU tabla de Airtable.
 * Los nombres de la izquierda son los que buscará en Airtable.
 * Puedes tener variaciones como "Nombre", "Name", "NOMBRE", etc.
 *
 * El script intenta múltiples variantes automáticamente.
 */
function getFieldValue(fields, ...possibleNames) {
    for (const name of possibleNames) {
        if (fields[name] !== undefined && fields[name] !== null && fields[name] !== '') {
            return fields[name];
        }
    }
    return undefined;
}

function mapAirtableToPatient(record) {
    const fields = record.fields;

    // ── Nombre y Apellido (campos exactos de tu tabla) ──
    let firstName = getFieldValue(fields, 'Nombre', 'Primer Nombre');
    let lastName = getFieldValue(fields, 'Apellido');

    // Limpiar espacios extra
    if (firstName) firstName = firstName.trim();
    if (lastName) lastName = lastName.trim();

    // ── Email (campo exacto: "Correo Electrónico") ──
    const email = getFieldValue(fields, 'Correo Electrónico', 'Email', 'Correo', 'correo');

    // ── Teléfono ──
    const phone = getFieldValue(fields, 'Teléfono', 'Celular');

    // ── RUT ──
    const rut = getFieldValue(fields, 'RUT', 'Rut');

    // ── Dirección ──
    const address = getFieldValue(fields, 'Dirección', 'Direccion');

    // ── Género ──
    const gender = getFieldValue(fields, 'Género', 'Genero') || '';

    // ── Previsión de salud ──
    const healthInsurance = getFieldValue(fields, 'Previsión', 'Prevision');

    // ── Fecha de nacimiento ──
    let dateOfBirth = getFieldValue(fields, 'Fecha de Nacimiento');
    if (dateOfBirth && typeof dateOfBirth === 'string') {
        dateOfBirth = new Date(dateOfBirth);
        if (isNaN(dateOfBirth.getTime())) dateOfBirth = undefined;
    }

    // ── Estado activo (campo "Estado Actual") ──
    const activeField = getFieldValue(fields, 'Estado Actual', 'Activo', 'Estado');
    let isActive = true;
    if (typeof activeField === 'boolean') {
        isActive = activeField;
    } else if (typeof activeField === 'string') {
        const lower = activeField.toLowerCase();
        isActive = !['inactivo', 'inactive', 'no', 'false', 'baja', 'dado de baja', 'suspendido'].includes(lower);
    }

    // ── Objetivos (campo array de Airtable) ──
    const objectives = getFieldValue(fields, 'Objetivo');

    // ── Profesional asignado ──
    const assignedProfessional = getFieldValue(fields, 'Entrenador/Kinesiólogo');

    // ── Medio por el que llegó ──
    const referralArr = getFieldValue(fields, 'Medio por el que llegó');
    const referralSource = Array.isArray(referralArr) ? referralArr.join(', ') : referralArr;

    // ── Fecha de pago ──
    let lastPaymentDate = getFieldValue(fields, 'Fecha de Pago');
    if (lastPaymentDate && typeof lastPaymentDate === 'string') {
        lastPaymentDate = new Date(lastPaymentDate);
        if (isNaN(lastPaymentDate.getTime())) lastPaymentDate = undefined;
    }

    // ── Info médica (campos exactos de tu tabla) ──
    const healthProblems = getFieldValue(fields, 'Problemas de Salud');
    const injuriesPain = getFieldValue(fields, 'Lesiones/Dolores');
    const medications = getFieldValue(fields, 'Medicamentos');

    // ── Contacto de emergencia (viene como un solo campo de texto) ──
    const emergencyRaw = getFieldValue(fields, 'Contacto de emergencia (Nombre,  teléfono, parentesco)');
    let emergencyContact = undefined;
    if (emergencyRaw && emergencyRaw.trim()) {
        // Parsear el texto libre: "Javier Ruiz, 9571136445 (Papá)" o "Cristian Heim, Esposo, +56998792572"
        emergencyContact = {
            name: emergencyRaw.trim(),
            phone: '',
            relationship: ''
        };
        // Intentar extraer teléfono
        const phoneMatch = emergencyRaw.match(/(\+?\d[\d\s-]{6,})/);
        if (phoneMatch) emergencyContact.phone = phoneMatch[1].trim();
        // Intentar extraer parentesco entre paréntesis
        const relMatch = emergencyRaw.match(/\(([^)]+)\)/);
        if (relMatch) emergencyContact.relationship = relMatch[1].trim();
    }

    // ── Fecha de creación original en Airtable ──
    let createdAtOriginal = getFieldValue(fields, 'CreatedAt', 'Fecha de Ingreso');

    // ── Construir objeto paciente ──
    const patient = {
        firstName: firstName || 'Sin nombre',
        lastName: lastName || 'Sin apellido',
        email: email ? email.toLowerCase().trim() : null,
        password: 'PrimeFH2024!', // Contraseña temporal
        role: 'patient',
        phone: phone ? String(phone).trim() : undefined,
        rut: rut ? String(rut).trim() : undefined,
        address: address ? String(address).trim() : undefined,
        gender,
        healthInsurance: healthInsurance || undefined,
        objectives: Array.isArray(objectives) ? objectives : (objectives ? [objectives] : []),
        assignedProfessional: assignedProfessional || undefined,
        referralSource: referralSource || undefined,
        lastPaymentDate,
        dateOfBirth,
        isActive,
        airtableId: record.id,
        source: 'airtable',
        lastActivityDate: lastPaymentDate || (createdAtOriginal ? new Date(createdAtOriginal) : undefined)
    };

    // Info médica (solo si hay datos reales, ignorar "X" y "x")
    const medicalInfo = {};
    if (healthProblems && !['x', 'X', '-', 'N/A', 'n/a', 'No'].includes(healthProblems.trim())) {
        medicalInfo.chronicConditions = [String(healthProblems).trim()];
    }
    if (medications && !['x', 'X', '-', 'N/A', 'n/a', 'No'].includes(medications.trim())) {
        medicalInfo.medications = [String(medications).trim()];
    }
    if (injuriesPain && !['x', 'X', '-', 'N/A', 'n/a', 'No'].includes(injuriesPain.trim())) {
        medicalInfo.injuries = [String(injuriesPain).trim()];
    }
    if (Object.keys(medicalInfo).length > 0) {
        patient.medicalInfo = medicalInfo;
    }

    // Contacto de emergencia
    if (emergencyContact) {
        patient.emergencyContact = emergencyContact;
    }

    return patient;
}

// ─── 5. Obtener todos los registros de Airtable ──────────────────────────────
async function fetchAirtableRecords() {
    console.log('\n📡 Conectando a Airtable...');
    console.log(`   Base ID: ${AIRTABLE_BASE_ID}`);
    console.log(`   Tabla:   ${AIRTABLE_TABLE_NAME}`);

    const base = new Airtable({ apiKey: AIRTABLE_API_KEY }).base(AIRTABLE_BASE_ID);

    const records = [];

    return new Promise((resolve, reject) => {
        base(AIRTABLE_TABLE_NAME)
            .select({ pageSize: 100 })
            .eachPage(
                (pageRecords, fetchNextPage) => {
                    records.push(...pageRecords);
                    console.log(`   📄 Registros obtenidos: ${records.length}...`);
                    fetchNextPage();
                },
                (err) => {
                    if (err) {
                        reject(err);
                    } else {
                        console.log(`   ✅ Total de registros en Airtable: ${records.length}`);
                        resolve(records);
                    }
                }
            );
    });
}

// ─── 6. Conectar a MongoDB ───────────────────────────────────────────────────
async function connectMongoDB() {
    console.log('\n🍃 Conectando a MongoDB...');
    try {
        await mongoose.connect(MONGODB_URI, {
            serverSelectionTimeoutMS: 5000 // Timeout after 5s instead of 30s
        });
        console.log('   ✅ Conexión exitosa a MongoDB');
        return true;
    } catch (error) {
        console.error('   ❌ Error de conexión a MongoDB:', error.message);
        return false;
    }
}

// ─── 7. Función principal de migración ───────────────────────────────────────
async function migrate() {
    console.log('═══════════════════════════════════════════════════════');
    console.log('  🔄 MIGRACIÓN AIRTABLE → MONGODB — Prime F&H');
    console.log('═══════════════════════════════════════════════════════');

    if (DRY_RUN) {
        console.log('⚠️  MODO DRY-RUN: No se escribirá nada en MongoDB');
    }

    // Paso 1: Obtener registros de Airtable
    let airtableRecords;
    try {
        airtableRecords = await fetchAirtableRecords();
    } catch (error) {
        console.error('\n❌ Error al conectar con Airtable:', error.message);
        if (error.message.includes('NOT_FOUND')) {
            console.error('   → La tabla o base no fue encontrada. Verifica AIRTABLE_BASE_ID y AIRTABLE_TABLE_NAME.');
        }
        if (error.message.includes('AUTHENTICATION_REQUIRED') || error.message.includes('INVALID_API_KEY')) {
            console.error('   → API Key inválida. Verifica AIRTABLE_API_KEY en tu .env');
        }
        process.exit(1);
    }

    if (airtableRecords.length === 0) {
        console.log('\n⚠️  No se encontraron registros en Airtable. Nada que migrar.');
        process.exit(0);
    }

    // Modo preview: mostrar los primeros registros y salir
    if (PREVIEW) {
        console.log('\n🔍 VISTA PREVIA — Primeros 5 registros de Airtable:\n');
        const previewRecords = airtableRecords.slice(0, 5);
        previewRecords.forEach((record, i) => {
            console.log(`── Registro ${i + 1} (ID: ${record.id}) ──`);
            console.log('   Campos originales:', JSON.stringify(record.fields, null, 2));
            console.log('   Mapeo resultado:', JSON.stringify(mapAirtableToPatient(record), null, 2));
            console.log('');
        });

        // Mostrar todos los campos disponibles
        const allFieldNames = new Set();
        airtableRecords.forEach(r => Object.keys(r.fields).forEach(f => allFieldNames.add(f)));
        console.log('📋 Campos disponibles en Airtable:');
        console.log('  ', [...allFieldNames].join(', '));
        console.log('\n💡 Ajusta el mapeo en la función mapAirtableToPatient() si algún campo no se reconoce.');
        process.exit(0);
    }

    // Paso 2: Conectar a MongoDB
    // (Ahora conectamos siempre para verificar credenciales, incluso en dry-run)
    const connected = await connectMongoDB();
    if (!connected) process.exit(1);

    // Paso 3: Procesar y migrar
    console.log('\n🔄 Procesando registros...\n');

    let migrated = 0;
    let skippedDuplicate = 0;
    let skippedNoEmail = 0;
    let errors = 0;
    const errorDetails = [];

    for (const record of airtableRecords) {
        try {
            const patientData = mapAirtableToPatient(record);

            // Validar que tenga email (es obligatorio en el modelo)
            if (!patientData.email) {
                skippedNoEmail++;
                console.log(`   ⏩ Saltado (sin email): ${patientData.firstName} ${patientData.lastName}`);
                continue;
            }

            if (DRY_RUN) {
                migrated++;
                console.log(`   ✅ [DRY] ${patientData.firstName} ${patientData.lastName} (${patientData.email})`);
                continue;
            }

            // Verificar si ya existe (por email o por airtableId)
            const existingUser = await User.findOne({
                $or: [
                    { email: patientData.email },
                    { airtableId: record.id }
                ]
            });

            if (existingUser) {
                skippedDuplicate++;
                console.log(`   ⏩ Ya existe: ${patientData.email} (saltado)`);
                continue;
            }

            // Crear el paciente
            await User.create(patientData);
            migrated++;
            console.log(`   ✅ Migrado: ${patientData.firstName} ${patientData.lastName} (${patientData.email})`);

        } catch (error) {
            errors++;
            const name = record.fields['Nombre'] || record.fields['Name'] || record.id;
            errorDetails.push({ name, error: error.message });
            console.log(`   ❌ Error: ${name} → ${error.message}`);
        }
    }

    // ─── Resumen de la migración ──────────────────────────────────────────
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('  📊 RESUMEN DE MIGRACIÓN');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`  📥 Total registros en Airtable:  ${airtableRecords.length}`);
    console.log(`  ✅ Migrados exitosamente:         ${migrated}`);
    console.log(`  ⏩ Saltados (ya existían):        ${skippedDuplicate}`);
    console.log(`  ⏩ Saltados (sin email):          ${skippedNoEmail}`);
    console.log(`  ❌ Errores:                       ${errors}`);
    console.log('═══════════════════════════════════════════════════════');

    if (DRY_RUN) {
        console.log('\n⚠️  Esto fue un DRY-RUN. No se guardó nada en MongoDB.');
        console.log('   Ejecuta sin --dry-run para migrar de verdad:');
        console.log('   → node scripts/migrate.js\n');
    } else {
        console.log(`\n🎉 ${migrated} pacientes migrados exitosamente a MongoDB.`);
        console.log('   Contraseña temporal: PrimeFH2024!');
        console.log('   Los pacientes pueden cambiarla al hacer login por primera vez.\n');
    }

    if (errorDetails.length > 0) {
        console.log('──── Detalle de errores ────');
        errorDetails.forEach(({ name, error }) => {
            console.log(`  • ${name}: ${error}`);
        });
        console.log('');
    }

    // Cerrar conexión
    if (!DRY_RUN) {
        await mongoose.connection.close();
        console.log('🔐 Conexión a MongoDB cerrada.');
    }

    process.exit(0);
}

// ─── 8. Ejecutar ─────────────────────────────────────────────────────────────
migrate().catch((err) => {
    console.error('\n💥 Error fatal durante la migración:', err);
    process.exit(1);
});
