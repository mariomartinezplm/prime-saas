import { priceOf } from '../config/pricing.js';
import { santiagoParts } from '../utils/timezone.js';

/**
 * Panel de ingresos del profesional (lógica pura, sin base de datos).
 *
 * Cómo se cuenta (fiel al modelo actual, que NO guarda montos ni fecha de pago):
 *  - Cada CICLO mensual de plan es un registro. Un ciclo pertenece al MES en que EMPIEZA (hora de Chile).
 *  - «Cobrado» = ciclo cuyo pago ya está registrado (`paymentPending` falso) y que no está cancelado.
 *  - «Pendiente» = ciclo abierto sin pago registrado todavía (`paymentPending` verdadero). Suma al ingreso PROYECTADO, no al cobrado.
 *  - Los planes trimestral/anual se pagan de una vez, pero el sistema los guarda como ciclos mensuales: cada ciclo cuenta al precio del
 *    plan mensual en su mes (devengado mensual). No hay descuento por plazo en los datos, así que no se inventa ninguno.
 *  - Precio = config/pricing.js. Sin tarifa definida → «sin tarifa»: se cuenta, pero no suma pesos.
 */
export const monthKey = (date) => {
  const p = santiagoParts(new Date(date));
  return `${p.year}-${String(p.month).padStart(2, '0')}`;
};

export const shiftMonth = (key, delta) => {
  const [y, m] = key.split('-').map(Number);
  const index = y * 12 + (m - 1) + delta;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`;
};

const counts = (plan) => plan.status !== 'cancelled';

export function summarizeMonth(plans, month) {
  const inMonth = plans.filter((p) => counts(p) && monthKey(p.startDate) === month);
  let collected = 0;
  let pending = 0;
  let paidCount = 0;
  let pendingCount = 0;
  let untariffed = 0;
  const byService = { entrenamiento: 0, kinesiologia: 0 };
  const byPlan = new Map();

  for (const p of inMonth) {
    const price = priceOf(p);
    const paid = !p.paymentPending;
    const key = `${p.serviceType}|${p.unlimited ? 'ilimitado' : p.sessionsTotal}`;
    const row = byPlan.get(key) ?? { serviceType: p.serviceType, sessions: p.unlimited ? null : p.sessionsTotal, unlimited: !!p.unlimited, price, count: 0, collected: 0, pending: 0 };
    row.count += 1;
    if (paid) paidCount += 1;
    else pendingCount += 1;
    if (price === null) untariffed += 1;
    else if (paid) {
      collected += price;
      row.collected += price;
      byService[p.serviceType] = (byService[p.serviceType] ?? 0) + price;
    } else {
      pending += price;
      row.pending += price;
    }
    byPlan.set(key, row);
  }

  return {
    month,
    collected,
    pending,
    projected: collected + pending,
    paidCount,
    pendingCount,
    untariffed,
    byService,
    byPlan: [...byPlan.values()].sort((a, b) => b.collected + b.pending - (a.collected + a.pending) || b.count - a.count)
  };
}

// Variación del cobrado frente al mes anterior: null si el mes anterior no tiene datos con que comparar (no se inventa un %)
export function variation(current, previous) {
  if (!(previous > 0)) return null;
  return { amount: current - previous, percent: Math.round(((current - previous) / previous) * 1000) / 10 };
}

export function buildFinance({ plans, patients, month, now = new Date() }) {
  const names = new Map(patients.map((p) => [String(p._id), p]));
  const current = summarizeMonth(plans, month);
  const previousKey = shiftMonth(month, -1);
  const previous = summarizeMonth(plans, previousKey);
  const series = Array.from({ length: 6 }, (_, i) => shiftMonth(month, i - 5)).map((m) => {
    const s = summarizeMonth(plans, m);
    return { month: m, collected: s.collected, projected: s.projected };
  });

  // Pacientes con un plan vigente HOY (no depende del mes elegido)
  const t = new Date(now).getTime();
  const active = new Set(plans.filter((p) => counts(p) && p.status === 'active' && new Date(p.startDate).getTime() <= t && new Date(p.endDate).getTime() >= t).map((p) => String(p.patient)));

  const list = plans
    .filter((p) => counts(p) && monthKey(p.startDate) === month)
    .map((p) => {
      const patient = names.get(String(p.patient));
      return {
        patientId: String(p.patient),
        patient: patient ? `${patient.firstName} ${patient.lastName}` : 'Paciente',
        serviceType: p.serviceType,
        sessions: p.unlimited ? null : p.sessionsTotal,
        unlimited: !!p.unlimited,
        price: priceOf(p),
        paid: !p.paymentPending,
        startDate: p.startDate
      };
    })
    .sort((a, b) => Number(b.paid) - Number(a.paid) || String(a.patient).localeCompare(String(b.patient)));

  return {
    month,
    previousMonth: previousKey,
    current,
    previous: { collected: previous.collected, projected: previous.projected, paidCount: previous.paidCount },
    variation: variation(current.collected, previous.collected),
    activePatients: active.size,
    series,
    plans: list,
    notes: {
      cycleRule: 'Cada ciclo mensual cuenta en el mes en que empieza. Los planes trimestral y anual se cuentan por mes al precio del plan mensual.',
      noTariff: current.untariffed > 0 ? `${current.untariffed} ${current.untariffed === 1 ? 'ciclo' : 'ciclos'} sin tarifa definida (no suman al ingreso).` : null
    }
  };
}
