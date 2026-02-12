import User from '../models/User.js';
import Appointment from '../models/Appointment.js';
import Measurement from '../models/Measurement.js';
import ExerciseProgress from '../models/Exercise.js';
import EVA from '../models/EVA.js';

// @desc    Obtener todos los usuarios (solo admin)
// @route   GET /api/users
// @access  Private/Admin
export const getAllUsers = async (req, res) => {
  try {
    // Seguridad: Si es paciente, solo puede ver profesionales
    if (req.user.role === 'patient') {
      req.query.role = 'professional';
    }

    const { role, isActive, search, limit = 50, page = 1 } = req.query;

    // Construir query
    const query = {};
    if (role) query.role = role;
    if (isActive !== undefined) query.isActive = isActive === 'true';
    if (search) {
      query.$or = [
        { firstName: new RegExp(search, 'i') },
        { lastName: new RegExp(search, 'i') },
        { email: new RegExp(search, 'i') },
        { rut: new RegExp(search, 'i') }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const users = await User.find(query)
      .select('-password')
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
    const {
      firstName,
      lastName,
      email,
      password,
      role,
      phone,
      dateOfBirth,
      rut,
      address,
      emergencyContact,
      medicalInfo
    } = req.body;

    // Verificar si el usuario ya existe
    const userExists = await User.findOne({ email: email.toLowerCase() });

    if (userExists) {
      return res.status(400).json({
        success: false,
        message: 'El email ya está registrado'
      });
    }

    // Crear usuario
    const user = await User.create({
      firstName,
      lastName,
      email: email.toLowerCase(),
      password,
      role: role || 'patient',
      phone,
      dateOfBirth,
      rut,
      address,
      emergencyContact,
      medicalInfo
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
      role,
      phone,
      dateOfBirth,
      rut,
      address,
      emergencyContact,
      medicalInfo,
      isActive,
      profileImage
    } = req.body;

    let user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    // Actualizar campos
    if (firstName) user.firstName = firstName;
    if (lastName) user.lastName = lastName;
    if (email) user.email = email.toLowerCase();
    if (role) user.role = role;
    if (phone !== undefined) user.phone = phone;
    if (dateOfBirth) user.dateOfBirth = dateOfBirth;
    if (rut !== undefined) user.rut = rut;
    if (address !== undefined) user.address = address;
    if (emergencyContact) user.emergencyContact = emergencyContact;
    if (medicalInfo) user.medicalInfo = medicalInfo;
    if (isActive !== undefined) user.isActive = isActive;
    if (profileImage !== undefined) user.profileImage = profileImage;

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

    // No permitir que el admin se elimine a sí mismo
    if (user._id.toString() === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: 'No puedes eliminar tu propia cuenta'
      });
    }

    await user.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Usuario eliminado exitosamente'
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
