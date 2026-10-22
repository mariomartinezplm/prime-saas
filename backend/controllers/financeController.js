import User from '../models/User.js';
import ClientPlan from '../models/ClientPlan.js';
import { buildFinance, monthKey, shiftMonth } from '../services/financeService.js';

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

// @desc    Ingresos del mes del profesional (o de todo el centro, solo admin)
// @route   GET /api/finance/summary?month=AAAA-MM&professional=<id solo admin>
// @access  Private/Admin, Private/Professional
export const getFinanceSummary = async (req, res) => {
  try {
    const now = new Date();
    const month = req.query.month ?? monthKey(now);
    if (typeof month !== 'string' || !MONTH_RE.test(month) || month > shiftMonth(monthKey(now), 6) || month < shiftMonth(monthKey(now), -36)) {
      return res.status(400).json({ success: false, message: 'El mes debe tener el formato AAAA-MM (hasta 36 meses atrás o 6 adelante)' });
    }

    // ALCANCE: un profesional ve SOLO a sus pacientes asignados; el admin ve todo el centro o, si lo pide, a un profesional
    const isAdmin = req.user.role === 'admin';
    const scopeProfessional = isAdmin ? (typeof req.query.professional === 'string' && /^[a-f0-9]{24}$/i.test(req.query.professional) ? req.query.professional : null) : String(req.user._id);
    const filter = { role: 'patient', ...(scopeProfessional ? { assignedProfessionalId: scopeProfessional } : {}) };
    const patients = await User.find(filter).select('firstName lastName').lean();
    const ids = patients.map((p) => p._id);

    // Ventana de datos: 6 meses hacia atrás desde el mes pedido (para el gráfico) más el siguiente (por ciclos de fecha a fecha)
    const [y, m] = shiftMonth(month, -6).split('-').map(Number);
    const from = new Date(Date.UTC(y, m - 1, 1));
    const plans = ids.length
      ? await ClientPlan.find({ patient: { $in: ids }, status: { $ne: 'cancelled' }, startDate: { $gte: from } })
          .select('patient serviceType sessionsTotal unlimited status startDate endDate paymentPending')
          .lean()
      : [];

    const data = buildFinance({ plans, patients, month, now });
    const professionals = isAdmin ? await User.find({ role: 'professional' }).select('firstName lastName').lean() : [];
    res.status(200).json({
      success: true,
      data: { ...data, scope: isAdmin ? (scopeProfessional ? 'professional' : 'center') : 'own', professionals: professionals.map((p) => ({ id: String(p._id), name: `${p.firstName} ${p.lastName}` })), selectedProfessional: scopeProfessional }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'No se pudo calcular los ingresos' });
  }
};
