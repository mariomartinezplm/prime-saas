import User from '../models/User.js';
import SlotClosure from '../models/SlotClosure.js';
import { countOverlappingAppointments } from '../services/bookingRulesService.js';
import { santiagoParts, santiagoToUtc } from '../utils/timezone.js';
import { SESSION_MINUTES } from '../services/slotClosureService.js';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):(00|30)$/;

const todayKey = () => {
  const p = santiagoParts(new Date());
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
};

// Vista de una hora cerrada: incluye cuántas personas hay en ella (para que el equipo vea que «las que ya están se mantienen»)
const view = async (c) => ({
  id: String(c._id),
  professional: String(c.professional),
  date: c.date,
  startTime: c.startTime,
  present: await countOverlappingAppointments(c.professional, c.date, c.startTime)
});

// @desc    Horas cerradas de un profesional desde hoy
// @route   GET /api/slot-closures/professional/:professionalId
// @access  Private/Staff (profesional: solo la suya; admin: cualquiera)
export const listClosures = async (req, res) => {
  try {
    const rows = await SlotClosure.find({ professional: req.params.professionalId, date: { $gte: todayKey() } }).sort({ date: 1, startTime: 1 }).limit(200).lean();
    res.status(200).json({ success: true, data: { closures: await Promise.all(rows.map(view)) } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'No se pudieron cargar los horarios cerrados' });
  }
};

// @desc    Cerrar una hora: no se suman más pacientes. Los que ya están se mantienen.
// @route   POST /api/slot-closures/professional/:professionalId   { date: 'YYYY-MM-DD', startTime: 'HH:MM' }
// @access  Private/Staff
export const closeSlot = async (req, res) => {
  try {
    const { date, startTime } = req.body ?? {};
    if (typeof date !== 'string' || !DATE_RE.test(date) || typeof startTime !== 'string' || !TIME_RE.test(startTime)) {
      return res.status(400).json({ success: false, message: 'Indica el día y una hora que empiece en punto o y media' });
    }
    const professional = await User.findById(req.params.professionalId).select('role');
    if (!professional || !['admin', 'professional'].includes(professional.role)) {
      return res.status(404).json({ success: false, message: 'Profesional no encontrado' });
    }
    // Una hora que ya terminó no tiene sentido cerrarla
    const [y, m, d] = date.split('-').map(Number);
    const [h, min] = startTime.split(':').map(Number);
    const endsAt = new Date(santiagoToUtc(y, m, d, h, min).getTime() + SESSION_MINUTES * 60000);
    if (endsAt.getTime() <= Date.now()) {
      return res.status(400).json({ success: false, message: 'Esa hora ya terminó' });
    }
    // Cerrar dos veces es lo mismo que cerrar una vez
    const closure = await SlotClosure.findOneAndUpdate(
      { professional: professional._id, date, startTime },
      { $setOnInsert: { createdBy: req.user._id } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();
    res.status(201).json({ success: true, data: { closure: await view(closure) } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'No se pudo cerrar el horario' });
  }
};

// @desc    Reabrir una hora cerrada
// @route   DELETE /api/slot-closures/:id
// @access  Private/Staff (profesional: solo las suyas; admin: cualquiera). 404 si no existe o no es suya.
export const reopenSlot = async (req, res) => {
  try {
    const closure = await SlotClosure.findById(req.params.id);
    if (!closure || (req.user.role !== 'admin' && String(closure.professional) !== String(req.user._id))) {
      return res.status(404).json({ success: false, message: 'Horario cerrado no encontrado' });
    }
    await closure.deleteOne();
    res.status(200).json({ success: true, data: {} });
  } catch (error) {
    res.status(500).json({ success: false, message: 'No se pudo reabrir el horario' });
  }
};
