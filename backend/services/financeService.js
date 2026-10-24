import { contractValue, discountOf, priceOf } from '../config/pricing.js';
import { santiagoParts } from '../utils/timezone.js';

/**
 * Valor ESTIMADO de planes (lógica pura, sin base de datos). NO es dinero cobrado.
 *
 * PRIME F&H hoy NO guarda el monto pagado ni la fecha de cada pago: solo si un ciclo tiene el pago pendiente o registrado. Por eso:
 *  - Un CONTRATO es lo que se paga de una vez: un plan mensual (1 ciclo) o un trimestral/anual (varios ciclos enlazados por `termId`).
 *    Se cuenta UNA vez, en el mes en que EMPIEZA, con su valor completo y su descuento (nunca se reparte en cobros mensuales inventados).
 *  - «Valor estimado» = tarifa base × ciclos × (1 − descuento). Es una estimación contractual, no una recaudación.
 *  - «Pago registrado» / «pendiente»: el estado real del plan (ciclo con `paymentPending`). Sin montos ni fechas reales detrás.
 *  - «Proyección»: SOLO estima la renovación del mes siguiente si se renuevan los planes vigentes que terminan este mes (supuesto explícito).
 *  - No hay cobros por semana ni por día porque no existe fecha de pago.
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

const live = (p) => p.status !== 'cancelled';

// Agrupa ciclos en contratos: un trimestral/anual son varios ciclos con el mismo `termId`; un plan suelto es su propio contrato
export function toContracts(plans) {
  const groups = new Map();
  for (const p of plans.filter(live)) {
    const key = p.termId ? `t:${p.termId}` : `p:${p._id ?? `${p.patient}|${p.startDate}|${p.serviceType}`}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(p);
  }
  const contracts = [];
  for (const cycles of groups.values()) {
    const sorted = [...cycles].sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
    const first = sorted[0];
    const scholarship = !!first.scholarship;
    // Pago mensual (sin renovar a mano): el plan largo queda cargado, pero cada mes es su propio cobro a la tarifa mensual base, sin descuento
    if (first.paymentMode === 'monthly' && sorted.length > 1) {
      for (const c of sorted) {
        contracts.push({
          patient: c.patient,
          serviceType: c.serviceType,
          sessions: c.unlimited ? null : c.sessionsTotal,
          unlimited: !!c.unlimited,
          term: c.term ?? 'mensual',
          cycles: 1,
          startDate: c.startDate,
          month: monthKey(c.startDate),
          unitPrice: priceOf(c),
          discount: 0,
          value: scholarship ? 0 : priceOf(c),
          pending: !!c.paymentPending,
          monthlyPay: true,
          scholarship
        });
      }
      continue;
    }
    contracts.push({
      patient: first.patient,
      serviceType: first.serviceType,
      sessions: first.unlimited ? null : first.sessionsTotal,
      unlimited: !!first.unlimited,
      term: first.term ?? 'mensual',
      cycles: Math.max(cycles.length, first.cyclesTotal ?? 1),
      startDate: first.startDate,
      month: monthKey(first.startDate),
      unitPrice: priceOf(first),
      discount: scholarship ? 0 : discountOf(first),
      value: scholarship ? 0 : contractValue({ ...first, cyclesTotal: Math.max(cycles.length, first.cyclesTotal ?? 1) }),
      // Pago pendiente si algún ciclo del contrato sigue sin pago registrado
      pending: cycles.some((c) => c.paymentPending),
      monthlyPay: false,
      scholarship
    });
  }
  return contracts;
}

export function summarizeMonth(contracts, month) {
  const list = contracts.filter((c) => c.month === month);
  let estimated = 0;
  let paidValue = 0;
  let pendingValue = 0;
  let paidCount = 0;
  let pendingCount = 0;
  let untariffed = 0;
  let scholarships = 0;
  const byService = { entrenamiento: 0, kinesiologia: 0 };
  const byPlan = new Map();

  for (const c of list) {
    const key = `${c.serviceType}|${c.unlimited ? 'ilimitado' : c.sessions}|${c.term}|${c.monthlyPay ? 'mensual' : 'junto'}|${c.scholarship ? 'beca' : ''}`;
    const row = byPlan.get(key) ?? { serviceType: c.serviceType, sessions: c.sessions, unlimited: c.unlimited, term: c.term, unitPrice: c.unitPrice, discount: c.discount, monthlyPay: !!c.monthlyPay, scholarship: !!c.scholarship, count: 0, value: 0, paidCount: 0, pendingCount: 0, untariffed: 0 };
    row.count += 1;
    if (c.scholarship) {
      // Una beca no es un plan «con pago» ni «pendiente»: se cuenta aparte y vale $0
      scholarships += 1;
    } else if (c.pending) {
      pendingCount += 1;
      row.pendingCount += 1;
    } else {
      paidCount += 1;
      row.paidCount += 1;
    }
    if (c.value === null) {
      untariffed += 1;
      row.untariffed += 1;
    } else {
      estimated += c.value;
      row.value += c.value;
      byService[c.serviceType] = (byService[c.serviceType] ?? 0) + c.value;
      if (c.pending) pendingValue += c.value;
      else paidValue += c.value;
    }
    byPlan.set(key, row);
  }

  return { month, estimated, paidValue, pendingValue, paidCount, pendingCount, untariffed, scholarships, contracts: list.length, byService, byPlan: [...byPlan.values()].sort((a, b) => b.value - a.value || b.count - a.count) };
}

// Variación del valor estimado frente al mes anterior: null si el mes anterior no tiene valor con que comparar (no se inventa un %)
export function variation(current, previous) {
  if (!(previous > 0)) return null;
  return { amount: current - previous, percent: Math.round(((current - previous) / previous) * 1000) / 10 };
}

// Proyección ESTIMADA del mes siguiente: si los planes que terminan este mes y se renuevan, se renuevan como plan mensual al precio base.
// Es un supuesto, no dinero: solo existe para el mes en curso y se identifica como tal.
export function projectNextMonth(plans, month) {
  const target = shiftMonth(month, 1);
  const ending = plans.filter((p) => live(p) && !p.paymentPending && p.status === 'active' && p.renews !== false && monthKey(p.endDate) === month && (p.cycleNumber ?? 1) >= (p.cyclesTotal ?? 1));
  // ya renovados (existe un ciclo del mes siguiente del mismo paciente y servicio) no se cuentan dos veces
  const already = new Set(plans.filter((p) => live(p) && monthKey(p.startDate) === target).map((p) => `${p.patient}|${p.serviceType}`));
  let value = 0;
  let count = 0;
  for (const p of ending) {
    if (already.has(`${p.patient}|${p.serviceType}`)) continue;
    const unit = priceOf(p);
    if (unit === null) continue;
    value += unit;
    count += 1;
  }
  return { month: target, value, count };
}


// Desglose MENSUAL a tarifa base (sin descuento): cada ciclo mensual de un plan de entrenamiento vale su tarifa mensual, aunque el contrato
// (trimestral, semestral o anual) se haya pagado de una vez. Kinesiología es un paquete: vale su tarifa en el mes en que empieza.
// Es una vista de "cuánto vale cada mes", no de lo que el paciente pagó (el descuento del contrato se informa aparte).
export function summarizeMonthly(plans, month, names = new Map()) {
  const rows = [];
  let total = 0;
  let untariffed = 0;
  for (const p of plans.filter((x) => live(x) && monthKey(x.startDate) === month)) {
    const base = priceOf(p);
    if (base === null && !p.scholarship) {
      untariffed += 1;
      continue;
    }
    const monthly = p.scholarship ? 0 : base;
    total += monthly;
    const patient = names.get(String(p.patient));
    const cyclesTotal = Math.max(1, p.cyclesTotal ?? 1);
    rows.push({
      patientId: String(p.patient),
      patient: patient ? `${patient.firstName} ${patient.lastName}` : 'Paciente',
      serviceType: p.serviceType,
      sessions: p.unlimited ? null : p.sessionsTotal,
      term: p.term ?? 'mensual',
      cycleNumber: p.cycleNumber ?? 1,
      cyclesTotal,
      monthly,
      discount: discountOf(p),
      contractValue: cyclesTotal > 1 && !p.scholarship && p.paymentMode !== 'monthly' ? contractValue({ ...p, cyclesTotal }) : null,
      monthlyPay: p.paymentMode === 'monthly',
      scholarship: !!p.scholarship
    });
  }
  rows.sort((a, b) => b.cyclesTotal - a.cyclesTotal || String(a.patient).localeCompare(String(b.patient)));
  return { month, total, rows, untariffed };
}

export function buildFinance({ plans, patients, month, now = new Date() }) {
  const names = new Map(patients.map((p) => [String(p._id), p]));
  const contracts = toContracts(plans);
  const current = summarizeMonth(contracts, month);
  const previousKey = shiftMonth(month, -1);
  const previous = summarizeMonth(contracts, previousKey);
  const series = Array.from({ length: 6 }, (_, i) => shiftMonth(month, i - 5)).map((m) => {
    const s = summarizeMonth(contracts, m);
    return { month: m, estimated: s.estimated, pendingValue: s.pendingValue, contracts: s.contracts, monthlyBase: summarizeMonthly(plans, m).total };
  });

  // Pacientes con un plan vigente HOY (no depende del mes elegido)
  const t = new Date(now).getTime();
  const activeIds = [...new Set(plans.filter((p) => live(p) && p.status === 'active' && new Date(p.startDate).getTime() <= t && new Date(p.endDate).getTime() >= t).map((p) => String(p.patient)))];
  const initials = (id) => {
    const p = names.get(id);
    return p ? `${(p.firstName ?? '').charAt(0)}${(p.lastName ?? '').charAt(0)}`.toUpperCase() || '·' : '·';
  };

  const list = contracts
    .filter((c) => c.month === month)
    .map((c) => {
      const patient = names.get(String(c.patient));
      return { patientId: String(c.patient), patient: patient ? `${patient.firstName} ${patient.lastName}` : 'Paciente', serviceType: c.serviceType, sessions: c.sessions, unlimited: c.unlimited, term: c.term, cycles: c.cycles, value: c.value, paid: !c.pending, startDate: c.startDate, monthlyPay: !!c.monthlyPay, scholarship: !!c.scholarship };
    })
    .sort((a, b) => Number(b.paid) - Number(a.paid) || String(a.patient).localeCompare(String(b.patient)));

  const isCurrentMonth = month === monthKey(now);
  return {
    month,
    previousMonth: previousKey,
    current,
    previous: { estimated: previous.estimated, contracts: previous.contracts },
    variation: variation(current.estimated, previous.estimated),
    activePatients: activeIds.length,
    activePatientInitials: activeIds.slice(0, 6).map(initials),
    series,
    projection: isCurrentMonth ? projectNextMonth(plans, month) : null,
    plans: list,
    monthly: summarizeMonthly(plans, month, names),
    basis: {
      kind: 'estimate',
      tracksPayments: false,
      notes: [
        'Es una estimación según los planes registrados: PRIME F&H todavía no guarda el monto pagado ni la fecha de cada pago.',
        'Cada contrato cuenta una sola vez, en el mes en que empieza, con su valor completo (un plan trimestral o anual no se reparte en cobros mensuales).',
        'Desglose mensual: cada mes de un plan largo se muestra a la tarifa mensual base ($90.000 por 2 veces por semana, $130.000 por 3), sin descuento; por eso la suma de los meses es mayor que lo que pagó el paciente.',
        'Pago mensual: un plan largo marcado «pago mensual» cuenta cada mes a la tarifa mensual base, sin descuento. Una beca vale $0.',
        'Descuentos en entrenamiento: trimestral 10 %, semestral 15 %, anual 20 %.'
      ],
      untariffed: current.untariffed
    }
  };
}
