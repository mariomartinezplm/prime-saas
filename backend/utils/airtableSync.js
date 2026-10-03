import Airtable from 'airtable';
import crypto from 'crypto';
import User from '../models/User.js';

// SEGURIDAD (Paso 02 de BLUEPRINT.md): las cuentas importadas nacen SIN contraseña
// utilizable. Se les asigna una aleatoria que nadie conoce (ni siquiera queda
// registrada), de modo que la única forma de entrar sea la invitación por email
// que el profesional/admin envía después (Paso 12).
function generateUnusablePassword() {
    return crypto.randomBytes(32).toString('hex');
}

// Helpers para mapeo flexible de Airtable
function getFieldValue(fields, ...possibleNames) {
    for (const name of possibleNames) {
        if (fields[name] !== undefined && fields[name] !== null && fields[name] !== '') {
            return fields[name];
        }
    }
    return undefined;
}

// El modelo solo acepta Masculino/Femenino/Otro: un valor distinto en Airtable
// ("Hombre", "F"...) haría fallar el alta y el paciente no llegaría a la app.
function normalizeGender(raw) {
    if (!raw || typeof raw !== 'string') return '';
    const value = normalizeText(raw);
    if (['masculino', 'hombre', 'm'].includes(value)) return 'Masculino';
    if (['femenino', 'mujer', 'f'].includes(value)) return 'Femenino';
    return 'Otro';
}

function normalizeText(str) {
    return String(str).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
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
    const gender = normalizeGender(getFieldValue(fields, 'Género', 'Genero'));
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
        password: generateUnusablePassword(), // El paciente la define vía invitación
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

export function isAirtableConfigured() {
    const { AIRTABLE_API_KEY, AIRTABLE_BASE_ID, AIRTABLE_TABLE_NAME } = process.env;
    return !!(AIRTABLE_API_KEY && AIRTABLE_BASE_ID && AIRTABLE_TABLE_NAME);
}

export async function fetchAllAirtableRecords() {
    if (!isAirtableConfigured()) {
        throw new Error('Variables de entorno de Airtable no configuradas (AIRTABLE_API_KEY, AIRTABLE_BASE_ID, AIRTABLE_TABLE_NAME)');
    }
    const { AIRTABLE_API_KEY, AIRTABLE_BASE_ID, AIRTABLE_TABLE_NAME } = process.env;

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

// ELIMINADA (Paso 02 de BLUEPRINT.md): syncPatientByEmail().
// Era el "Just-In-Time sync al login": ante un email desconocido creaba la cuenta
// en MongoDB con una contraseña fija, sin que nadie se hubiera autenticado. Su
// único llamador era el login. La importación desde Airtable sigue disponible,
// pero solo trae pacientes NUEVOS (importNewPatients, más abajo).

// Solo se importan automáticamente los registros creados en Airtable desde esta
// fecha. Los anteriores (históricos, a veces dados de baja a propósito) solo
// entran si el admin los trae a mano con el botón de la lista de pacientes.
export const AUTO_IMPORT_FROM = new Date('2026-10-03T00:00:00-03:00');

// "Mario" a secas puede ser dos profesionales distintos: solo se asigna si el
// texto de Airtable corresponde a UN único profesional. Ante la duda el
// paciente queda sin asignar (visible para todo el personal), nunca se pierde.
export function matchStaffByName(text, staff) {
    const target = text ? normalizeText(text) : '';
    if (!target) return undefined;
    const matches = staff.filter((s) => {
        const full = normalizeText(`${s.firstName} ${s.lastName}`);
        return target.startsWith(full) || full.startsWith(target);
    });
    return matches.length === 1 ? matches[0] : undefined;
}

// La app manda: un paciente que ya existe (mismo registro de Airtable o mismo
// correo) NUNCA se modifica, así lo que el personal editó en la app no se pierde.
export async function importRecords(records, { createdSince } = {}) {
    const summary = { total: records.length, created: 0, alreadyInApp: 0, skippedNoEmail: [], failed: 0 };

    const candidates = [];
    for (const raw of records) {
        const createdTime = raw._rawJson?.createdTime ?? raw.createdTime;
        if (createdSince && !(createdTime && new Date(createdTime) >= createdSince)) continue;
        try {
            const mapped = mapAirtableToPatient(raw);
            if (!mapped.email) {
                summary.skippedNoEmail.push(`${mapped.firstName} ${mapped.lastName}`.trim());
                continue;
            }
            candidates.push(mapped);
        } catch (error) {
            summary.failed++;
            console.error(`Airtable ${raw.id}: no se pudo leer el registro (${error.message})`);
        }
    }
    if (candidates.length === 0) return summary;

    const existing = await User.find({
        $or: [
            { airtableId: { $in: candidates.map((c) => c.airtableId) } },
            { email: { $in: candidates.map((c) => c.email) } }
        ]
    }).select('airtableId email');
    const knownIds = new Set(existing.map((u) => u.airtableId).filter(Boolean));
    const knownEmails = new Set(existing.map((u) => u.email));

    const staff = await User.find({ role: { $in: ['admin', 'professional'] }, isActive: true }).select('firstName lastName');

    for (const patient of candidates) {
        if (knownIds.has(patient.airtableId) || knownEmails.has(patient.email)) {
            summary.alreadyInApp++;
            continue;
        }
        const professional = matchStaffByName(patient.assignedProfessional, staff);
        if (professional) patient.assignedProfessionalId = professional._id;

        try {
            await User.create(patient);
            summary.created++;
        } catch (error) {
            // 11000 = ya existe (otro proceso, o dos filas con el mismo correo en Airtable)
            if (error.code === 11000) {
                summary.alreadyInApp++;
            } else {
                summary.failed++;
                console.error(`Airtable ${patient.airtableId}: no se pudo crear el paciente (${error.message})`);
            }
        }
    }

    return summary;
}

export async function importNewPatients(options) {
    return importRecords(await fetchAllAirtableRecords(), options);
}
