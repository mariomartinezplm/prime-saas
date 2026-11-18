import Appointment from '../models/Appointment.js';
import User from '../models/User.js';
import { parseISO, isValid, addDays, subDays } from 'date-fns';

const MAX_ROWS = 3000;

// Lo ÚNICO que un profesional ve de las citas de sus colegas: quién (nombre y apellido), cuándo, con quién y de qué tipo.
// Sin ids de pacientes, correos, teléfonos, notas, planes ni estado de pago: sirve para organizarse, no para entrar a su ficha.
const teamView = (a) => ({
  id: String(a._id),
  professional: { id: String(a.professional?._id ?? a.professional), firstName: a.professional?.firstName ?? '', lastName: a.professional?.lastName ?? '' },
  patientName: a.patient ? `${a.patient.firstName ?? ''} ${a.patient.lastName ?? ''}`.trim() : 'Paciente',
  date: a.date,
  startTime: a.startTime,
  endTime: a.endTime,
  type: a.type,
  status: a.status
});

/**
 * Agenda de los DEMÁS profesionales, de solo lectura, para organizarse (¿puedo derivar a alguien?, ¿quién está en esa hora?).
 * Solo el equipo (administrador y profesionales). No incluye las citas del propio usuario (ya las ve en su calendario) ni las canceladas.
 *
 * @route   GET /api/appointments/team?from=YYYY-MM-DD&to=YYYY-MM-DD
 * @access  Private/Staff
 */
export const getTeamAppointments = async (req, res) => {
  try {
    const from = req.query.from ? parseISO(String(req.query.from)) : subDays(new Date(), 7);
    const to = req.query.to ? parseISO(String(req.query.to)) : addDays(new Date(), 60);
    if (!isValid(from) || !isValid(to)) return res.status(400).json({ success: false, message: 'Fechas no válidas' });

    const [professionals, appointments] = await Promise.all([
      User.find({ role: { $in: ['professional', 'admin'] }, _id: { $ne: req.user._id }, isActive: { $ne: false } }).select('firstName lastName').sort({ firstName: 1 }).lean(),
      Appointment.find({ professional: { $ne: req.user._id }, status: { $ne: 'cancelled' }, date: { $gte: from, $lte: to } })
        .populate('patient', 'firstName lastName')
        .populate('professional', 'firstName lastName')
        .sort({ date: 1, startTime: 1 })
        .limit(MAX_ROWS)
        .lean()
    ]);

    res.status(200).json({
      success: true,
      data: {
        professionals: professionals.map((p) => ({ id: String(p._id), firstName: p.firstName, lastName: p.lastName })),
        appointments: appointments.map(teamView)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'No se pudo cargar la agenda del equipo' });
  }
};
