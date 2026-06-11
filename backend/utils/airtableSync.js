import Airtable from 'airtable';
import User from '../models/User.js';

// Helpers para mapeo flexible de Airtable
function getFieldValue(fields, ...possibleNames) {
    for (const name of possibleNames) {
        if (fields[name] !== undefined && fields[name] !== null && fields[name] !== '') {
            return fields[name];
        }
    }
    return undefined;
}

export function mapAirtableToPatient(record) {
    const fields = record.fields;

    let firstName = getFieldValue(fields, 'Nombre', 'Primer Nombre');
    let lastName = getFieldValue(fields, 'Apellido');
    if (firstName) firstName = firstName.trim();
    if (lastName) lastName = lastName.trim();

    const email = getFieldValue(fields, 'Correo Electrónico', 'Email', 'Correo', 'correo');
    const phone = getFieldValue(fields, 'Teléfono', 'Celular');
    const rut = getFieldValue(fields, 'RUT', 'Rut');
    const address = getFieldValue(fields, 'Dirección', 'Direccion');
    const gender = getFieldValue(fields, 'Género', 'Genero') || '';
    const healthInsurance = getFieldValue(fields, 'Previsión', 'Prevision');

    let dateOfBirth = getFieldValue(fields, 'Fecha de Nacimiento');
    if (dateOfBirth && typeof dateOfBirth === 'string') {
        dateOfBirth = new Date(dateOfBirth);
        if (isNaN(dateOfBirth.getTime())) dateOfBirth = undefined;
    }

    const activeField = getFieldValue(fields, 'Estado Actual', 'Activo', 'Estado');
    let isActive = true;
    if (typeof activeField === 'boolean') {
        isActive = activeField;
    } else if (typeof activeField === 'string') {
        const lower = activeField.toLowerCase();
        isActive = !['inactivo', 'inactive', 'no', 'false', 'baja', 'dado de baja', 'suspendido'].includes(lower);
    }

    const objectives = getFieldValue(fields, 'Objetivo');
    const assignedProfessional = getFieldValue(fields, 'Entrenador/Kinesiólogo');
    const referralArr = getFieldValue(fields, 'Medio por el que llegó');
    const referralSource = Array.isArray(referralArr) ? referralArr.join(', ') : referralArr;

    let lastPaymentDate = getFieldValue(fields, 'Fecha de Pago');
    if (lastPaymentDate && typeof lastPaymentDate === 'string') {
        lastPaymentDate = new Date(lastPaymentDate);
        if (isNaN(lastPaymentDate.getTime())) lastPaymentDate = undefined;
    }

    const healthProblems = getFieldValue(fields, 'Problemas de Salud');
    const injuriesPain = getFieldValue(fields, 'Lesiones/Dolores');
    const medications = getFieldValue(fields, 'Medicamentos');

    const emergencyRaw = getFieldValue(fields, 'Contacto de emergencia (Nombre,  teléfono, parentesco)');
    let emergencyContact = undefined;
    if (emergencyRaw && emergencyRaw.trim()) {
        emergencyContact = { name: emergencyRaw.trim(), phone: '', relationship: '' };
        const phoneMatch = emergencyRaw.match(/(\+?\d[\d\s-]{6,})/);
        if (phoneMatch) emergencyContact.phone = phoneMatch[1].trim();
        const relMatch = emergencyRaw.match(/\(([^)]+)\)/);
        if (relMatch) emergencyContact.relationship = relMatch[1].trim();
    }

    let createdAtOriginal = getFieldValue(fields, 'CreatedAt', 'Fecha de Ingreso');

    const patient = {
        firstName: firstName || 'Sin nombre',
        lastName: lastName || 'Sin apellido',
        email: email ? email.toLowerCase().trim() : null,
        password: '123456', // Contraseña temporal
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

    if (emergencyContact) {
        patient.emergencyContact = emergencyContact;
    }

    return patient;
}

export async function fetchAllAirtableRecords() {
    const { AIRTABLE_API_KEY, AIRTABLE_BASE_ID, AIRTABLE_TABLE_NAME } = process.env;
    if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID || !AIRTABLE_TABLE_NAME) {
        throw new Error('Variables de entorno de Airtable no configuradas (AIRTABLE_API_KEY, AIRTABLE_BASE_ID, AIRTABLE_TABLE_NAME)');
    }

    const base = new Airtable({ apiKey: AIRTABLE_API_KEY }).base(AIRTABLE_BASE_ID);
    const records = [];

    return new Promise((resolve, reject) => {
        base(AIRTABLE_TABLE_NAME)
            .select({ pageSize: 100 })
            .eachPage(
                (pageRecords, fetchNextPage) => {
                    records.push(...pageRecords);
                    fetchNextPage();
                },
                (err) => {
                    if (err) reject(err);
                    else resolve(records);
                }
            );
    });
}

// Para Just-In-Time sync al login
export async function syncPatientByEmail(email) {
    if (!email) return null;

    // Al ser un sync rápido para login, traemos todo y lo filtramos en memoria
    // ya que Airtable views/formulas varían por campo
    const records = await fetchAllAirtableRecords();

    for (const raw of records) {
        const mapped = mapAirtableToPatient(raw);
        if (mapped.email === email.toLowerCase()) {

            // Actualizar o insertar en MongoDB
            const filter = { email: mapped.email };
            const options = { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true };
            const docToUpdate = { ...mapped };

            // Si ya existe, no sobrescribimos la contraseña
            delete docToUpdate.password;

            // Hacemos el try/catch acá porque mongoose upsert no maneja middlewares pre('save')
            const existingUser = await User.findOne(filter);
            if (!existingUser) {
                // Es un paciente nuevo
                return await User.create(mapped);
            } else {
                // Actualizarlo
                Object.assign(existingUser, docToUpdate);
                return await existingUser.save();
            }
        }
    }

    return null;
}

// Para sincronización manual completa
export async function syncAllPatients() {
    const records = await fetchAllAirtableRecords();
    let syncedCount = 0;
    let skippedCount = 0;

    for (const raw of records) {
        try {
            const mapped = mapAirtableToPatient(raw);
            if (!mapped.email) {
                skippedCount++;
                continue;
            }

            const filter = { email: mapped.email };
            const docToUpdate = { ...mapped };
            delete docToUpdate.password;

            const existingUser = await User.findOne(filter);
            if (!existingUser) {
                await User.create(mapped);
                syncedCount++;
            } else {
                Object.assign(existingUser, docToUpdate);
                await existingUser.save();
                syncedCount++;
            }
        } catch (err) {
            console.error('Error sincronizando registro de Airtable:', err);
            skippedCount++;
        }
    }

    return { syncedCount, skippedCount, total: records.length };
}
