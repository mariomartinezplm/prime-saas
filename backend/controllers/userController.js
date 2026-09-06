import User from '../models/User.js';
import Appointment from '../models/Appointment.js';
import Measurement from '../models/Measurement.js';
import ExerciseProgress from '../models/Exercise.js';
import EVA from '../models/EVA.js';
import { syncAllPatients } from '../utils/airtableSync.js';
import { canAccessPatient } from '../middleware/auth.js';

// Debe coincidir con el minlength del modelo User (Paso 05 de BLUEPRINT.md)
const MIN_PASSWORD_LENGTH = 8;

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
        ownershipOr = [
          { assignedProfessionalId: req.user._id },
          { assignedProfessionalId: { $exists: false } },
          { assignedProfessionalId: null }
        ];
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
          { firstName: new RegExp(search, 'i') },
          { lastName: new RegExp(search, 'i') },
          { email: new RegExp(search, 'i') },
          { rut: new RegExp(search, 'i') }
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

    res.status(200).json({
      success: true,
      count: users.length,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
      data: { users }
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
      data: { user }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error al obtener usuario'
    });
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
    const {
      firstName,
      lastName,
      email,
      password,
      phone,
      dateOfBirth,
      rut,
      address,
      emergencyContact,
      medicalInfo
    } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'El email y la contraseña son obligatorios'
      });
    }

    // Se valida aquí, antes de Mongoose, para devolver un 400 claro
    if (password.length < MIN_PASSWORD_LENGTH) {
      return res.status(400).json({
        success: false,
        message: `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres`
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
      // El admin puede asignar el paciente a un profesional al crearlo
      if (role === 'patient' && req.body.assignedProfessionalId) {
        assignedProfessionalId = req.body.assignedProfessionalId;
      }
    } else {
      // Un profesional solo crea PACIENTES, y quedan asignados a él
      role = 'patient';
      assignedProfessionalId = req.user._id;
    }

    // Crear usuario
    const user = await User.create({
      firstName,
      lastName,
      email: email.toLowerCase(),
      password,
      role,
      phone,
      dateOfBirth,
      rut,
      address,
      emergencyContact,
      medicalInfo,
      assignedProfessionalId
    });

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
      profileImage
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

    // Campos que puede editar cualquiera con permiso sobre este usuario
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
    }

    await user.save();

    res.status(200).json({
      success: true,
      message: 'Usuario actualizado exitosamente',
      data: { user }
    });
  } catch (error) {
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
      Appointment.countDocuments({ patient: patientId }),
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

    res.status(200).json({
      success: true,
      data: {
        patient,
        stats: {
          totalAppointments: appointmentCount,
          totalMeasurements: measurements.length,
          totalExercises: exercises.length,
          totalEVARecords: evaRecords.length
        },
        upcomingAppointments,
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

// @desc    Obtener estadísticas del dashboard (admin)
// @route   GET /api/users/stats/dashboard
// @access  Private/Admin
export const getDashboardStats = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      totalPatients,
      activePatients,
      todayAppointments,
      upcomingAppointments,
      recentPatients
    ] = await Promise.all([
      User.countDocuments({ role: 'patient' }),
      User.countDocuments({ role: 'patient', isActive: true }),
      Appointment.countDocuments({
        date: {
          $gte: today,
          $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000)
        },
        status: 'scheduled'
      }),
      Appointment.find({
        date: { $gte: today },
        status: 'scheduled'
      })
        .sort({ date: 1, startTime: 1 })
        .limit(10)
        .populate('patient', 'firstName lastName phone')
        .populate('professional', 'firstName lastName'),
      User.find({ role: 'patient' })
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

// @desc    Sincronizar todos los pacientes manualmente desde Airtable
// @route   POST /api/users/sync-airtable
// @access  Private/Admin
export const syncAirtableUsers = async (req, res) => {
  try {
    const result = await syncAllPatients();
    res.status(200).json({
      success: true,
      message: 'Sincronización con Airtable completada',
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error al sincronizar con Airtable'
    });
  }
};
