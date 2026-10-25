import mongoose from 'mongoose';
import User from '../models/User.js';
import Appointment from '../models/Appointment.js';
import Measurement from '../models/Measurement.js';
import ExerciseProgress from '../models/Exercise.js';
import EVA from '../models/EVA.js';
import ClientPlan from '../models/ClientPlan.js';
import { importNewPatients } from '../utils/airtableSync.js';
import { canAccessPatient, ownedPatientsOr } from '../middleware/auth.js';
import { escapeRegex } from '../middleware/sanitize.js';
import { generateUnusablePassword, createInvite, inviteStatusOf } from '../services/inviteService.js';
import { appointmentForViewer, userForViewer } from '../services/patientViews.js';

// Documento de Mongoose → objeto plano (pasando por toJSON, que quita contraseñas y el token de invitación)
const toPlain = (doc) => (typeof doc?.toJSON === 'function' ? doc.toJSON() : doc);
import AchievementAward from '../models/AchievementAward.js';
import AchievementPause from '../models/AchievementPause.js';
import ClientFile from '../models/ClientFile.js';
import ExtraSession from '../models/ExtraSession.js';
import ProgressPhoto from '../models/ProgressPhoto.js';
import PushSubscription from '../models/PushSubscription.js';
import WellnessCheckin from '../models/WellnessCheckin.js';
import Notification from '../models/Notification.js';
import RefreshToken from '../models/RefreshToken.js';
import { deleteObject, isStorageConfigured } from '../services/storageService.js';
import { toCSV } from '../utils/csv.js';
import { SERVICE_TYPE_LABELS } from '../config/planCatalog.js';
import { todayInSantiago } from '../utils/timezone.js';

// @desc    Obtener todos los usuarios (solo admin)
// @route   GET /api/users
// @access  Private/Admin
export const getAllUsers = async (req, res) => {
  try {
    const { role, isActive, search, limit = 50, page = 1 } = req.query;

    // SEGURIDAD (Paso 04 de BLUEPRINT.md): el alcance lo decide el SERVIDOR según el
    // rol de quien pregunta, nunca los parámetros que manda el frontend. Antes, un
    // profesional que llamaba sin `role` recibía la base completa de usuarios.
    const STAFF_ROLES = ['admin', 'professional'];
    // Directorio de staff visible para no-admins: lo justo para elegir con quién agendar
    const STAFF_DIRECTORY_FIELDS = 'firstName lastName role specialty profileImage isActive';

    const query = {};
    let projection = '-password';
    // Cláusula de pertenencia; se combina con la búsqueda más abajo sin pisarla
    let ownershipOr = null;

    if (req.user.role === 'admin') {
      // El admin ve todo; respeta los filtros que le manden
      if (role) query.role = role;
      if (req.query.assignedProfessionalId) {
        query.assignedProfessionalId = req.query.assignedProfessionalId;
      }
    } else if (req.user.role === 'professional') {
      if (role && STAFF_ROLES.includes(role)) {
        // Directorio de colegas (para agendas y selectores), con datos mínimos
        query.role = role;
        projection = STAFF_DIRECTORY_FIELDS;
      } else {
        // Sus pacientes asignados + los que aún no tienen profesional asignado.
        // Estos últimos quedan en un "pool" común para que nadie desaparezca del
        // sistema por un dato incompleto; al asignarles profesional salen del pool.
        query.role = 'patient';
        ownershipOr = ownedPatientsOr(req.user._id);
      }
    } else {
      // Paciente: únicamente el directorio de staff, con datos mínimos.
      // Nunca puede listar a otros pacientes.
      if (!role || !STAFF_ROLES.includes(role)) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permisos para listar usuarios'
        });
      }
      query.role = role;
      projection = STAFF_DIRECTORY_FIELDS;
    }

    if (isActive !== undefined) query.isActive = isActive === 'true';

    const searchOr = search
      ? [
          { firstName: new RegExp(escapeRegex(search), 'i') },
          { lastName: new RegExp(escapeRegex(search), 'i') },
          { email: new RegExp(escapeRegex(search), 'i') },
          { rut: new RegExp(escapeRegex(search), 'i') }
        ]
      : null;

    // Pertenencia y búsqueda son dos condiciones que deben cumplirse AMBAS. Si se
    // asignaran las dos a query.$or, la segunda pisaría a la primera y la búsqueda
    // terminaría saltándose el filtro de pertenencia.
    if (ownershipOr && searchOr) {
      query.$and = [{ $or: ownershipOr }, { $or: searchOr }];
    } else if (ownershipOr) {
      query.$or = ownershipOr;
    } else if (searchOr) {
      query.$or = searchOr;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const users = await User.find(query)
      .select(projection)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(skip);

    const total = await User.countDocuments(query);

    // Para el personal, cada paciente lleva el estado de su invitación (nunca el token)
    const listsPatientsForStaff = query.role === 'patient' && STAFF_ROLES.includes(req.user.role);
    const payload = listsPatientsForStaff ? users.map((u) => ({ ...toPlain(u), inviteStatus: inviteStatusOf(u) })) : users;

    res.status(200).json({
      success: true,
      count: users.length,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
      data: { users: payload }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error al obtener usuarios'
    });
  }
};

// @desc    Obtener un usuario por ID
// @route   GET /api/users/:id
// @access  Private/Admin
export const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    res.status(200).json({
      success: true,
      data: { user: userForViewer(req.user, user) }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error al obtener usuario'
    });
  }
};

// Un profesional o administrador activo (a quien se le puede asignar un paciente). Un id mal formado cuenta como «no existe».
const findActiveStaff = async (id) => {
  if (!mongoose.Types.ObjectId.isValid(id)) return null;
  return User.findOne({ _id: id, role: { $in: ['admin', 'professional'] }, isActive: { $ne: false } }).select('_id');
};

// Pacientes que todavía no tienen profesional asignado
const UNASSIGNED_PATIENTS = { role: 'patient', $or: [{ assignedProfessionalId: { $exists: false } }, { assignedProfessionalId: null }] };

// @desc    Cuántos pacientes no tienen profesional asignado (solo admin)
// @route   GET /api/users/unassigned/count
export const countUnassignedPatients = async (req, res) => {
  try {
    const count = await User.countDocuments(UNASSIGNED_PATIENTS);
    res.status(200).json({ success: true, data: { count } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'No se pudo contar a los pacientes sin profesional' });
  }
};

// @desc    Asigna un profesional a TODOS los pacientes que no tienen uno (solo admin). No toca a quien ya tiene profesional.
// @route   POST /api/users/unassigned/assign   { professionalId }
export const assignUnassignedPatients = async (req, res) => {
  try {
    const staffMember = await findActiveStaff(req.body?.professionalId);
    if (!staffMember) {
      return res.status(400).json({ success: false, message: 'Elige un profesional válido' });
    }
    const result = await User.updateMany(UNASSIGNED_PATIENTS, { $set: { assignedProfessionalId: staffMember._id } });
    res.status(200).json({ success: true, data: { modified: result.modifiedCount ?? 0 } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'No se pudo asignar el profesional' });
  }
};

// @desc    Crear nuevo usuario (solo admin)
// @route   POST /api/users
// @access  Private/Admin
export const createUser = async (req, res) => {
  try {
    // SEGURIDAD (Paso 05 de BLUEPRINT.md): lista blanca explícita. Solo estos campos
    // se leen del body; cualquier otro (role, isActive, assignedProfessionalId...) se
    // ignora y lo decide el servidor más abajo.
    // NOTA (Paso 12): ya no se lee `password` del body — nadie le pone la
    // contraseña a un paciente. La cuenta nace con una inutilizable y se
    // activa por invitación (ver más abajo).
    const {
      firstName,
      lastName,
      email,
      phone,
      dateOfBirth,
      rut,
      address,
      emergencyContact,
      medicalInfo
    } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'El email es obligatorio'
      });
    }

    // Verificar si el usuario ya existe
    const userExists = await User.findOne({ email: email.toLowerCase() });

    if (userExists) {
      return res.status(400).json({
        success: false,
        message: 'El email ya está registrado'
      });
    }

    // El ROL lo decide el servidor, nunca el formulario. Antes se tomaba tal cual
    // del body: un profesional podía crearse una cuenta de administrador.
    let role = 'patient';
    let assignedProfessionalId;

    if (req.user.role === 'admin') {
      // Solo el admin puede crear staff, y solo con roles válidos
      if (['admin', 'professional', 'patient'].includes(req.body.role)) {
        role = req.body.role;
      }
      // Un paciente siempre queda con un profesional que lo atiende: el que elija el admin al registrarlo o, si no elige ninguno,
      // el propio admin que lo registra (antes quedaba «sin profesional» y el paciente no veía con quién agendar).
      // Dejarlo sin asignar es una decisión explícita: `assignedProfessionalId: ''`.
      if (role === 'patient') {
        const requested = req.body.assignedProfessionalId;
        if (requested === '') {
          assignedProfessionalId = undefined;
        } else if (requested) {
          const staffMember = await findActiveStaff(requested);
          if (!staffMember) {
            return res.status(400).json({ success: false, message: 'El profesional elegido no existe o está inactivo' });
          }
          assignedProfessionalId = staffMember._id;
        } else {
          assignedProfessionalId = req.user._id;
        }
      }
    } else {
      // Un profesional solo crea PACIENTES, y quedan asignados a él
      role = 'patient';
      assignedProfessionalId = req.user._id;
    }

    // Crear usuario con una contraseña que nadie conoce — la única forma de
    // entrar es aceptando la invitación que se manda a continuación.
    const user = await User.create({
      firstName,
      lastName,
      email: email.toLowerCase(),
      password: generateUnusablePassword(),
      role,
      phone,
      dateOfBirth,
      rut,
      address,
      emergencyContact,
      medicalInfo,
      assignedProfessionalId
    });

    // Se aplica a CUALQUIER rol, no solo pacientes: si se limitara a
    // 'patient', una cuenta de staff creada por el admin (role admin o
    // professional) quedaría con la contraseña inutilizable de arriba y sin
    // ninguna forma de entrar — nadie debe conocer la contraseña de otra
    // persona, ni siquiera entre colegas. Se espera (no fire-and-forget): la
    // escritura del token de invitación en el usuario debe quedar hecha antes
    // de responder. El envío del CORREO en sí, dentro de createInvite, ya es
    // fire-and-forget y nunca lanza.
    await createInvite(user._id);

    // Remover password de la respuesta
    user.password = undefined;

    res.status(201).json({
      success: true,
      message: 'Usuario creado exitosamente',
      data: { user }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error al crear usuario'
    });
  }
};

// @desc    Actualizar usuario (solo admin)
// @route   PUT /api/users/:id
// @access  Private/Admin
export const updateUser = async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      email,
      phone,
      dateOfBirth,
      rut,
      address,
      emergencyContact,
      medicalInfo,
      profileImage,
      gender,
      healthInsurance,
      objectives,
      referralSource
    } = req.body;

    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    // SEGURIDAD (Paso 05 de BLUEPRINT.md): un profesional solo edita pacientes, y
    // solo los suyos. Antes podía editar (o desactivar) a un admin, o ascenderse.
    if (req.user.role !== 'admin') {
      if (user.role !== 'patient') {
        return res.status(403).json({
          success: false,
          message: 'Solo un administrador puede modificar cuentas del equipo'
        });
      }
      if (!(await canAccessPatient(req.user, user._id))) {
        return res.status(404).json({
          success: false,
          message: 'Usuario no encontrado'
        });
      }
    }

    if (gender !== undefined && !['Masculino', 'Femenino', 'Otro', ''].includes(gender)) {
      return res.status(400).json({
        success: false,
        message: 'Género no válido'
      });
    }

    // Campos que puede editar cualquiera con permiso sobre este usuario
    if (gender !== undefined) user.gender = gender;
    if (healthInsurance !== undefined) user.healthInsurance = String(healthInsurance).trim();
    if (referralSource !== undefined) user.referralSource = String(referralSource).trim();
    if (Array.isArray(objectives)) {
      user.objectives = objectives.map((o) => String(o).trim()).filter(Boolean);
    }
    if (firstName) user.firstName = firstName;
    if (lastName) user.lastName = lastName;
    if (email) user.email = email.toLowerCase();
    if (phone !== undefined) user.phone = phone;
    if (dateOfBirth) user.dateOfBirth = dateOfBirth;
    if (rut !== undefined) user.rut = rut;
    if (address !== undefined) user.address = address;
    if (emergencyContact) user.emergencyContact = emergencyContact;
    if (medicalInfo) user.medicalInfo = medicalInfo;
    if (profileImage !== undefined) user.profileImage = profileImage;

    // Campos reservados al admin: rol, estado de la cuenta y asignación.
    // Si los manda un profesional, simplemente se ignoran.
    if (req.user.role === 'admin') {
      if (['admin', 'professional', 'patient'].includes(req.body.role)) {
        user.role = req.body.role;
      }
      if (req.body.isActive !== undefined) user.isActive = req.body.isActive;
      if (req.body.assignedProfessionalId !== undefined) {
        user.assignedProfessionalId = req.body.assignedProfessionalId || undefined;
      }
      // "Sobre cupo": solo tiene sentido en pacientes
      if (req.body.exemptFromCapacity !== undefined) {
        if (typeof req.body.exemptFromCapacity !== 'boolean') {
          return res.status(400).json({ success: false, message: 'exemptFromCapacity debe ser verdadero o falso' });
        }
        if (user.role === 'patient') user.exemptFromCapacity = req.body.exemptFromCapacity;
      }
      // «Miembro Fundador»: solo el administrador lo marca o lo quita; el plan no lo cambia
      if (req.body.isFounder !== undefined) {
        if (typeof req.body.isFounder !== 'boolean') {
          return res.status(400).json({ success: false, message: 'isFounder debe ser verdadero o falso' });
        }
        if (user.role === 'patient') user.isFounder = req.body.isFounder;
      }
    }
    // Un profesional puede cambiar quién atiende a SU paciente (solo a personal activo; no puede dejarlo sin asignar).
    if (req.user.role === 'professional' && req.body.assignedProfessionalId) {
      const staffMember = await findActiveStaff(req.body.assignedProfessionalId);
      if (!staffMember) {
        return res.status(400).json({ success: false, message: 'El profesional elegido no existe o está inactivo' });
      }
      user.assignedProfessionalId = staffMember._id;
    }

    await user.save();

    res.status(200).json({
      success: true,
      message: 'Usuario actualizado exitosamente',
      data: { user }
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'Ya existe otra persona con ese correo'
      });
    }
    res.status(500).json({
      success: false,
      message: error.message || 'Error al actualizar usuario'
    });
  }
};

// @desc    Eliminar usuario (solo admin)
// @route   DELETE /api/users/:id
// @access  Private/Admin
export const deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    // No permitir que el admin se desactive a sí mismo
    if (user._id.toString() === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: 'No puedes desactivar tu propia cuenta'
      });
    }

    // SEGURIDAD Y DATOS CLÍNICOS (Paso 05 de BLUEPRINT.md): se DESACTIVA, no se borra.
    // Un borrado real destruiría la ficha clínica, las mediciones y el historial de
    // citas de esa persona, que por normativa sanitaria deben conservarse. Un usuario
    // inactivo no puede iniciar sesión (lo bloquea el middleware `protect`).
    if (!user.isActive) {
      return res.status(200).json({
        success: true,
        message: 'La cuenta ya estaba desactivada'
      });
    }

    user.isActive = false;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Cuenta desactivada. El historial clínico se conserva.',
      data: { user }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error al eliminar usuario'
    });
  }
};

// @desc    Eliminar DEFINITIVAMENTE a un paciente y todo lo suyo (pensado para pacientes de prueba)
// @route   POST /api/users/:id/permanent-delete
// @access  Private/Admin, Private/Professional (solo sus pacientes)
// Exige escribir el nombre completo del paciente. No se puede deshacer.
export const permanentlyDeletePatient = async (req, res) => {
  try {
    const patient = await User.findById(req.params.id);
    if (!patient || patient.role !== 'patient') {
      return res.status(404).json({ success: false, message: 'Paciente no encontrado' });
    }
    if (!(await canAccessPatient(req.user, patient._id))) {
      return res.status(404).json({ success: false, message: 'Paciente no encontrado' });
    }

    const expected = `${patient.firstName} ${patient.lastName}`.trim().toLowerCase();
    const typed = String(req.body?.confirmName || '').trim().replace(/\s+/g, ' ').toLowerCase();
    if (!typed || typed !== expected.replace(/\s+/g, ' ')) {
      return res.status(400).json({
        success: false,
        message: 'Para eliminar, escribe el nombre completo del paciente tal como aparece'
      });
    }

    const id = patient._id;
    // Archivos privados: se borran del almacenamiento antes de perder sus claves.
    const [files, photos] = await Promise.all([
      ClientFile.find({ patient: id }).select('storageKey'),
      ProgressPhoto.find({ patient: id }).select('storageKey')
    ]);
    let storageFailures = 0;
    if (isStorageConfigured()) {
      for (const f of [...files, ...photos]) {
        if (!f.storageKey) continue;
        try { await deleteObject(f.storageKey); } catch { storageFailures += 1; }
      }
    }

    await Promise.all([
      Appointment.deleteMany({ patient: id }),
      ClientPlan.deleteMany({ patient: id }),
      ExtraSession.deleteMany({ patient: id }),
      Measurement.deleteMany({ patient: id }),
      ExerciseProgress.deleteMany({ patient: id }),
      EVA.deleteMany({ patient: id }),
      WellnessCheckin.deleteMany({ patient: id }),
      AchievementAward.deleteMany({ patient: id }),
      AchievementPause.deleteMany({ patient: id }),
      ClientFile.deleteMany({ patient: id }),
      ProgressPhoto.deleteMany({ patient: id }),
      Notification.deleteMany({ user: id }),
      PushSubscription.deleteMany({ user: id }),
      RefreshToken.deleteMany({ user: id })
    ]);
    await User.deleteOne({ _id: id });

    // Sin datos clínicos en el registro: solo quién y qué.
    console.warn(`[audit] paciente eliminado definitivamente id=${id} por=${req.user._id}`);

    res.status(200).json({
      success: true,
      message: storageFailures
        ? 'Paciente eliminado. Algunos archivos no se pudieron borrar del almacenamiento.'
        : 'Paciente eliminado definitivamente'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error al eliminar al paciente' });
  }
};

// @desc    Regenerar la invitación de un usuario (invalida la anterior)
// @route   POST /api/users/:id/resend-invite
// @access  Private/Admin, Private/Professional (dueño del paciente)
export const resendInvite = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    // Un profesional solo puede reenviar invitación a SUS pacientes — nunca
    // a otro miembro del staff. El admin puede reenviar a cualquier usuario
    // (incluido staff que él mismo haya creado).
    if (req.user.role !== 'admin') {
      if (user.role !== 'patient' || !(await canAccessPatient(req.user, user._id))) {
        return res.status(404).json({
          success: false,
          message: 'Usuario no encontrado'
        });
      }
    }

    // Reenviar también sirve para "resetear el acceso" de una cuenta ya
    // activa (el paciente perdió su contraseña, o se sospecha que alguien
    // más la tiene): generar una invitación nueva sobreescribe la anterior
    // en el mismo documento, así que la vieja queda inutilizada sola.
    await createInvite(user._id);

    res.status(200).json({
      success: true,
      message: 'Invitación reenviada'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error al reenviar la invitación'
    });
  }
};

// @desc    Obtener perfil completo de un paciente con todas sus estadísticas
// @route   GET /api/users/:id/profile
// @access  Private/Admin
export const getPatientProfile = async (req, res) => {
  try {
    const patientId = req.params.id;

    // Obtener información del paciente
    const patient = await User.findById(patientId).select('-password');

    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'Paciente no encontrado'
      });
    }

    // Obtener estadísticas
    const [appointmentCount, upcomingAppointments, measurements, exercises, evaRecords] = await Promise.all([
      Appointment.countDocuments({ patient: patientId, status: { $ne: 'cancelled' } }),
      Appointment.find({
        patient: patientId,
        status: 'scheduled',
        date: { $gte: new Date() }
      })
        .sort({ date: 1 })
        .limit(5)
        .populate('professional', 'firstName lastName'),
      Measurement.find({ patient: patientId })
        .sort({ date: -1 })
        .limit(5),
      ExerciseProgress.distinct('exerciseName', { patient: patientId }),
      EVA.find({ patient: patientId })
        .sort({ date: -1 })
        .limit(5)
    ]);

    // El estado de la invitación es solo para el personal; el propio paciente no lo necesita
    const isStaffViewer = ['admin', 'professional'].includes(req.user.role);
    const patientView = isStaffViewer ? { ...toPlain(patient), inviteStatus: inviteStatusOf(patient) } : userForViewer(req.user, patient);

    res.status(200).json({
      success: true,
      data: {
        patient: patientView,
        stats: {
          totalAppointments: appointmentCount,
          totalMeasurements: measurements.length,
          totalExercises: exercises.length,
          totalEVARecords: evaRecords.length
        },
        upcomingAppointments: upcomingAppointments.map((apt) => appointmentForViewer(req.user, apt)),
        recentMeasurements: measurements,
        recentEVARecords: evaRecords
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error al obtener perfil del paciente'
    });
  }
};

// @desc    Obtener estadísticas del dashboard (admin y profesional)
// @route   GET /api/users/stats/dashboard
// @access  Private/Admin, Professional
export const getDashboardStats = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // SEGURIDAD: el alcance lo decide el servidor según el rol, con la misma regla que
    // getAllUsers (pacientes) y getAppointments (citas). Antes un profesional recibía las
    // cifras de TODO el centro, y las próximas citas con nombre y teléfono de pacientes
    // de otros profesionales y los últimos pacientes registrados con su correo.
    const isProfessional = req.user.role === 'professional';
    const patientQuery = { role: 'patient' };
    const appointmentScope = {};
    if (isProfessional) {
      // Sus pacientes asignados + el "pool" sin profesional asignado
      patientQuery.$or = ownedPatientsOr(req.user._id);
      // Solo sus propias citas
      appointmentScope.professional = req.user._id;
    }

    const [
      totalPatients,
      activePatients,
      todayAppointments,
      upcomingAppointments,
      recentPatients
    ] = await Promise.all([
      User.countDocuments(patientQuery),
      User.countDocuments({ ...patientQuery, isActive: true }),
      Appointment.countDocuments({
        ...appointmentScope,
        date: {
          $gte: today,
          $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000)
        },
        status: 'scheduled'
      }),
      Appointment.find({
        ...appointmentScope,
        date: { $gte: today },
        status: 'scheduled'
      })
        .sort({ date: 1, startTime: 1 })
        .limit(10)
        .populate('patient', 'firstName lastName phone')
        .populate('professional', 'firstName lastName'),
      User.find(patientQuery)
        .sort({ createdAt: -1 })
        .limit(5)
        .select('firstName lastName email createdAt')
    ]);

    res.status(200).json({
      success: true,
      data: {
        totalPatients,
        activePatients,
        todayAppointments,
        upcomingAppointments,
        recentPatients
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error al obtener estadísticas'
    });
  }
};

// @desc    Traer desde Airtable los pacientes que aún no están en la app (incluye
//          los históricos). Nunca modifica a un paciente que ya existe.
// @route   POST /api/users/sync-airtable
// @access  Private/Admin
export const syncAirtableUsers = async (req, res) => {
  try {
    // dryRun: solo muestra qué se importaría, sin crear nada
    const dryRun = req.body?.dryRun === true;
    const result = await importNewPatients({ dryRun });
    res.status(200).json({
      success: true,
      message: dryRun ? 'Vista previa de la importación' : 'Importación desde Airtable completada',
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error al sincronizar con Airtable'
    });
  }
};

// @desc    Exportar pacientes a CSV (datos base + plan + sesiones — sin
//          medicalInfo, por minimización de datos sensibles: Ley 19.628/21.719)
// @route   GET /api/users/export?format=csv
// @access  Private/Admin
export const exportUsers = async (req, res) => {
  try {
    if (req.query.format && req.query.format !== 'csv') {
      return res.status(400).json({
        success: false,
        message: 'Formato no soportado. Usa format=csv'
      });
    }

    const patients = await User.find({ role: 'patient' })
      .select('firstName lastName email phone rut isActive assignedProfessionalId createdAt')
      .populate('assignedProfessionalId', 'firstName lastName')
      .sort({ lastName: 1, firstName: 1 });

    const activePlans = await ClientPlan.find({
      patient: { $in: patients.map((p) => p._id) },
      status: 'active'
    }).select('patient serviceType sessionsTotal unlimited sessionsUsed endDate openEnded');

    const planByPatient = new Map(activePlans.map((plan) => [plan.patient.toString(), plan]));

    const headers = [
      'Nombre', 'Apellido', 'Email', 'Telefono', 'RUT', 'Activo',
      'ProfesionalAsignado', 'TipoPlan', 'SesionesUsadas', 'SesionesTotal',
      'PlanVence', 'FechaRegistro'
    ];

    const rows = patients.map((patient) => {
      const plan = planByPatient.get(patient._id.toString());
      const professional = patient.assignedProfessionalId;

      return [
        patient.firstName,
        patient.lastName,
        patient.email,
        patient.phone || '',
        patient.rut || '',
        patient.isActive ? 'Sí' : 'No',
        professional ? `${professional.firstName} ${professional.lastName}` : '',
        plan ? SERVICE_TYPE_LABELS[plan.serviceType] : 'Sin plan activo',
        plan ? plan.sessionsUsed : '',
        plan ? (plan.unlimited ? 'Ilimitado' : plan.sessionsTotal) : '',
        plan ? (plan.openEnded ? 'Hasta completar sesiones' : plan.endDate.toISOString().split('T')[0]) : '',
        patient.createdAt.toISOString().split('T')[0]
      ];
    });

    const csv = toCSV(headers, rows);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="pacientes-${todayInSantiago()}.csv"`);
    res.status(200).send(csv);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error al exportar pacientes'
    });
  }
};
