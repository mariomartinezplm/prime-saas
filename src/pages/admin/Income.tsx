import { useCallback, useEffect, useMemo, useState } from 'react';
import { Area, CartesianGrid, ComposedChart, Line, Pie, PieChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ArrowDownRight, ArrowUpRight, BarChart3, CalendarDays, ChevronLeft, ChevronRight, Info, TrendingUp, Users, WalletCards } from 'lucide-react';
import { financeService, type FinanceSummary, type PlanLine } from '@/services/financeService';
import LoadErrorAlert from '@/components/shared/LoadErrorAlert';
import { CardsSkeleton, PageSkeleton } from '@/components/shared/Skeletons';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const TERM = { mensual: 'Mensual', trimestral: 'Trimestral', semestral: 'Semestral', anual: 'Anual' } as const;
const clp = (n: number) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n);
const compact = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1).replace('.', ',')} M` : n >= 1000 ? `${Math.round(n / 1000)} mil` : String(n));
const monthName = (m: string) => {
  const n = MONTHS[Number(m.slice(5, 7)) - 1];
  return `${n.charAt(0).toUpperCase()}${n.slice(1)} de ${m.slice(0, 4)}`;
};
const shiftMonth = (m: string, d: number) => {
  const i = Number(m.slice(0, 4)) * 12 + (Number(m.slice(5, 7)) - 1) + d;
  return `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}`;
};
const sessionsText = (service: string, sessions: number | null, unlimited: boolean) => {
  if (unlimited) return 'Ilimitado';
  if (service === 'entrenamiento' && sessions === 8) return '2 veces por semana';
  if (service === 'entrenamiento' && sessions === 12) return '3 veces por semana';
  return `${sessions} ${sessions === 1 ? 'sesión' : 'sesiones'}`;
};
const planName = (p: Pick<PlanLine, 'serviceType' | 'sessions' | 'unlimited'>) => `${p.serviceType === 'kinesiologia' ? 'Kinesiología' : 'Entrenamiento'} · ${sessionsText(p.serviceType, p.sessions, p.unlimited)}`;

const Panel = ({ children, className, label }: { children: React.ReactNode; className?: string; label?: string }) => (
  <section aria-label={label} className={cn('rounded-[22px] border border-[#fff8e4]/10 bg-[linear-gradient(180deg,#272329,#1f1c21)] p-4 shadow-[0_18px_40px_-26px_rgba(0,0,0,0.9)] sm:p-5', className)}>{children}</section>
);

const Kpi = ({ icon, label, value, foot, accent }: { icon: React.ReactNode; label: string; value: React.ReactNode; foot?: React.ReactNode; accent?: boolean }) => (
  <section aria-label={label} className={cn('relative overflow-hidden rounded-[22px] border p-4 shadow-[0_18px_40px_-26px_rgba(0,0,0,0.9)]', accent ? 'border-[#62b8cf]/40 bg-[linear-gradient(160deg,rgba(57,140,162,0.34),#1f1c21_68%)]' : 'border-[#fff8e4]/10 bg-[linear-gradient(180deg,#272329,#1f1c21)]')}>
    {accent && <div aria-hidden="true" className="pointer-events-none absolute -right-10 -top-14 h-36 w-36 rounded-full bg-[#62b8cf]/25 blur-3xl" />}
    <div className="relative flex items-center gap-2.5">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#62b8cf]/35 bg-[#398ca2]/20 text-[#8fd0e0]">{icon}</span>
      <p className="text-[13px] leading-tight text-[#cdc6b6]">{label}</p>
    </div>
    <p className="relative mt-3 text-[2rem] font-extrabold leading-none tracking-[-0.04em] tabular-nums text-[#fff8e4] sm:text-[2.15rem]">{value}</p>
    {foot && <div className="relative mt-2 text-[12.5px] leading-snug text-[#a8a295]">{foot}</div>}
  </section>
);

// Ingresos ESTIMADOS (según los planes registrados). El sistema no guarda montos pagados ni fechas de pago, así que nada de esto
// se presenta como dinero recibido.
const Income = () => {
  const { user } = useAuth();
  const [month, setMonth] = useState<string | undefined>();
  const [professional, setProfessional] = useState<string | null>(null);
  const [data, setData] = useState<FinanceSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setFailed(false);
    financeService.getSummary(month, professional).then(setData).catch(() => setFailed(true)).finally(() => setLoading(false));
  }, [month, professional]);
  useEffect(load, [load]);

  const chart = useMemo(() => {
    if (!data) return [];
    const rows: { month: string; label: string; value: number | null; projection: number | null }[] = data.series.map((s) => ({ month: s.month, label: SHORT[Number(s.month.slice(5, 7)) - 1], value: s.estimated, projection: null }));
    if (data.projection) {
      rows[rows.length - 1].projection = rows[rows.length - 1].value; // la línea punteada parte del último valor real
      rows.push({ month: data.projection.month, label: SHORT[Number(data.projection.month.slice(5, 7)) - 1], value: null, projection: data.projection.value });
    }
    return rows;
  }, [data]);

  if (loading && !data) {
    return (
      <PageSkeleton label="Calculando…">
        <CardsSkeleton count={2} bodyHeight="h-36" />
      </PageSkeleton>
    );
  }
  if (failed && !data) return <LoadErrorAlert message="No se pudo cargar la estimación de ingresos." onRetry={load} />;
  if (!data) return null;

  const { current, variation, projection, basis } = data;
  const isAdmin = user?.role === 'admin';
  const professionalName = data.professionals.find((p) => p.id === data.selectedProfessional)?.name;
  const scopeText = data.scope === 'own' ? 'mis pacientes' : data.scope === 'center' ? 'el centro' : professionalName ?? 'el profesional';
  const total = current.byService.entrenamiento + current.byService.kinesiologia;
  const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : 0);
  const donut = [{ name: 'Entrenamiento', value: current.byService.entrenamiento, color: '#62b8cf' }, { name: 'Kinesiología', value: current.byService.kinesiologia, color: '#2b6f82' }].filter((d) => d.value > 0);
  const monthLabel = MONTHS[Number(data.month.slice(5, 7)) - 1];
  const prevLabel = MONTHS[Number(data.previousMonth.slice(5, 7)) - 1];
  const hasData = current.contracts > 0;

  return (
    <div className={cn('mx-auto w-full max-w-7xl space-y-4 pb-8 transition-opacity', loading && 'opacity-60')}>
      <header className="flex flex-wrap items-end justify-between gap-3 pt-1">
        <div className="max-w-2xl space-y-1">
          <h1 className="font-serif text-[2rem] font-medium leading-[1.1] text-[#fff8e4] sm:text-[2.5rem]">Ingresos estimados</h1>
          <p className="text-[14px] leading-snug text-[#cdc6b6]">Valor de los planes de <b className="font-semibold text-[#fff8e4]">{scopeText}</b>, calculado con las tarifas vigentes. Todavía no incluye montos pagados ni fechas de pago.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isAdmin && data.professionals.length > 0 && (
            <label className="flex items-center gap-2 text-[13px] text-[#cdc6b6]">
              <span className="sr-only sm:not-sr-only">Ver</span>
              <select value={professional ?? ''} onChange={(e) => setProfessional(e.target.value || null)} className="min-h-[44px] rounded-xl border border-[#fff8e4]/20 bg-[#1f1c21] px-3 text-[14px] font-semibold text-[#fff8e4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#fff8e4]">
                <option value="">Todo el centro</option>
                {data.professionals.map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
              </select>
            </label>
          )}
          <div role="group" aria-label="Cambiar de mes" className="flex items-center gap-1 rounded-2xl border border-[#fff8e4]/15 bg-[#1f1c21] p-1">
            <button type="button" aria-label="Mes anterior" onClick={() => setMonth(shiftMonth(data.month, -1))} className="flex h-11 w-11 items-center justify-center rounded-xl text-[#8fd0e0] active:bg-[#62b8cf]/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#fff8e4]"><ChevronLeft className="h-5 w-5" aria-hidden="true" /></button>
            <span className="flex min-w-[10.5rem] items-center justify-center gap-2 px-1 text-[15px] font-semibold text-[#fff8e4]" aria-live="polite"><CalendarDays className="h-4 w-4 text-[#8fd0e0]" aria-hidden="true" />{monthName(data.month)}</span>
            <button type="button" aria-label="Mes siguiente" onClick={() => setMonth(shiftMonth(data.month, 1))} className="flex h-11 w-11 items-center justify-center rounded-xl text-[#8fd0e0] active:bg-[#62b8cf]/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#fff8e4]"><ChevronRight className="h-5 w-5" aria-hidden="true" /></button>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi accent icon={<BarChart3 className="h-[18px] w-[18px]" aria-hidden="true" />} label={`Valor estimado de planes · ${monthLabel}`} value={clp(current.estimated)} foot={<>
          {variation === null ? <span>Sin {prevLabel} con valor para comparar</span> : variation.amount === 0 ? <span>Igual que {prevLabel}</span> : (
            <span className="flex flex-wrap items-center gap-1"><span className={cn('inline-flex items-center gap-0.5 font-bold', variation.amount > 0 ? 'text-[#8fd0e0]' : 'text-[#e8b4a0]')}>{variation.amount > 0 ? <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" /> : <ArrowDownRight className="h-3.5 w-3.5" aria-hidden="true" />}{variation.amount > 0 ? '+' : '−'}{String(Math.abs(variation.percent)).replace('.', ',')} %</span> vs. {prevLabel} (estimado)</span>
          )}
          {data.monthly.total !== current.estimated && <span className="mt-1 block text-[#8fd0e0]">A tarifa mensual: {clp(data.monthly.total)} (ver desglose)</span>}
        </>} />
        <Kpi icon={<TrendingUp className="h-[18px] w-[18px]" aria-hidden="true" />} label={projection ? `Proyección estimada · ${MONTHS[Number(projection.month.slice(5, 7)) - 1]}` : 'Pendiente de pago (estimado)'} value={projection ? clp(projection.value) : clp(current.pendingValue)} foot={projection ? <span>Supuesto: se renuevan los {projection.count} {projection.count === 1 ? 'plan vigente' : 'planes vigentes'} que terminan este mes. No es dinero recibido.</span> : <span>{current.pendingCount} {current.pendingCount === 1 ? 'plan' : 'planes'} con pago pendiente</span>} />
        <Kpi icon={<Users className="h-[18px] w-[18px]" aria-hidden="true" />} label="Pacientes activos" value={data.activePatients} foot={<span>Con un plan vigente hoy</span>} />
        <Kpi icon={<WalletCards className="h-[18px] w-[18px]" aria-hidden="true" />} label="Planes con pago registrado" value={current.paidCount} foot={<span>{current.pendingCount} {current.pendingCount === 1 ? 'pendiente' : 'pendientes'} de {current.contracts}</span>} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel label="Evolución del valor estimado" className="lg:col-span-2">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div><h2 className="text-[16px] font-bold text-[#fff8e4]">Evolución del valor estimado</h2><p className="text-[12.5px] text-[#a8a295]">Últimos 6 meses, por mes de inicio del plan</p></div>
            <span className="flex items-center gap-3 text-[11.5px] text-[#a8a295]"><span className="flex items-center gap-1"><i className="inline-block h-0.5 w-4 bg-[#62b8cf]" />Estimado</span>{projection && <span className="flex items-center gap-1"><i className="inline-block h-0.5 w-4 border-t-2 border-dashed border-[#8fd0e0]" />Proyección</span>}</span>
          </div>
          <div role="img" aria-label={`Valor estimado por mes: ${chart.map((c) => `${c.label} ${clp((c.value ?? c.projection) ?? 0)}${c.value === null ? ' (proyección)' : ''}`).join(', ')}`} className="mt-2 h-[230px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chart} margin={{ top: 14, right: 12, bottom: 0, left: 0 }}>
                <defs><linearGradient id="inc-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#62b8cf" stopOpacity={0.34} /><stop offset="100%" stopColor="#62b8cf" stopOpacity={0} /></linearGradient></defs>
                <CartesianGrid stroke="rgba(255,248,228,0.07)" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#a8a295' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#a8a295' }} axisLine={false} tickLine={false} width={58} tickFormatter={(v: number) => compact(v)} domain={[0, (max: number) => Math.max(100000, Math.ceil((max * 1.15) / 100000) * 100000)]} />
                <Tooltip cursor={{ stroke: 'rgba(98,184,207,0.4)' }} content={({ active, payload }) => {
                  const p = active && payload?.[0]?.payload;
                  if (!p) return null;
                  const isProj = p.value === null;
                  return (<div className="rounded-xl border border-[#fff8e4]/15 bg-[#272329] px-3 py-2 text-[12.5px] text-[#fff8e4] shadow-lg"><p className="font-semibold text-[#a8a295]">{monthName(p.month)}</p><p className="text-[15px] font-extrabold tabular-nums">{clp((p.value ?? p.projection) as number)}</p><p className="text-[#a8a295]">{isProj ? 'Proyección estimada (no es dinero recibido)' : 'Valor estimado de planes'}</p></div>);
                }} />
                <Area type="monotone" dataKey="value" stroke="none" fill="url(#inc-fill)" isAnimationActive={false} connectNulls={false} />
                <Line type="monotone" dataKey="value" stroke="#62b8cf" strokeWidth={3} dot={{ r: 4.5, fill: '#1f1c21', stroke: '#62b8cf', strokeWidth: 2.5 }} activeDot={{ r: 6.5, fill: '#fff8e4', stroke: '#62b8cf', strokeWidth: 3 }} isAnimationActive={false} connectNulls={false} />
                {projection && <Line type="monotone" dataKey="projection" stroke="#8fd0e0" strokeWidth={2.5} strokeDasharray="6 6" dot={{ r: 4.5, fill: '#181619', stroke: '#8fd0e0', strokeWidth: 2, strokeDasharray: '0' }} isAnimationActive={false} connectNulls />}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel label="Distribución por servicio">
          <h2 className="text-[16px] font-bold text-[#fff8e4]">Distribución por servicio</h2>
          <p className="text-[12.5px] text-[#a8a295]">Del valor estimado de {monthLabel}</p>
          {total > 0 ? (
            <div className="mt-3 flex flex-col items-center gap-4 sm:flex-row lg:flex-col xl:flex-row">
              <div role="img" aria-label={`Entrenamiento ${pct(current.byService.entrenamiento, total)} %, kinesiología ${pct(current.byService.kinesiologia, total)} %`} className="relative h-[170px] w-[170px] shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart><Pie data={donut} dataKey="value" innerRadius={58} outerRadius={80} paddingAngle={2} stroke="none" isAnimationActive={false}>{donut.map((d) => (<Cell key={d.name} fill={d.color} />))}</Pie></PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center"><span className="text-[1.15rem] font-extrabold tabular-nums text-[#fff8e4]">{clp(total)}</span><span className="text-[11px] text-[#a8a295]">estimado</span></div>
              </div>
              <dl className="grid w-full gap-3">
                {([['Entrenamiento', current.byService.entrenamiento, '#62b8cf'], ['Kinesiología', current.byService.kinesiologia, '#2b6f82']] as const).map(([label, value, color]) => (
                  <div key={label}><dt className="flex items-center gap-1.5 text-[13px] text-[#cdc6b6]"><i className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: color }} />{label}</dt><dd className="flex items-baseline gap-2"><span className="text-[1.3rem] font-extrabold tabular-nums text-[#fff8e4]">{pct(value, total)} %</span><span className="text-[13px] tabular-nums text-[#a8a295]">{clp(value)}</span></dd></div>
                ))}
              </dl>
            </div>
          ) : <p className="mt-6 rounded-2xl border border-dashed border-[#fff8e4]/20 p-4 text-center text-sm text-[#a8a295]">Todavía no hay planes con tarifa en {monthLabel}.</p>}
        </Panel>
      </div>


      <Panel label="Desglose mensual">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-[16px] font-bold text-[#fff8e4]">Desglose mensual · {monthLabel}</h2>
            <p className="text-[12.5px] text-[#a8a295]">Cada mes a su tarifa mensual base, sin descuento, aunque el plan largo se haya pagado de una vez</p>
          </div>
          <p className="text-[1.5rem] font-extrabold tabular-nums leading-none text-[#fff8e4]">{clp(data.monthly.total)}</p>
        </div>
        {data.monthly.rows.length === 0 ? <p className="mt-4 rounded-2xl border border-dashed border-[#fff8e4]/20 p-5 text-center text-sm text-[#a8a295]">No hay meses de plan con tarifa en {monthLabel}.</p> : (
          <ul className="mt-3 grid grid-cols-[minmax(0,1fr)] gap-x-8 divide-y divide-[#fff8e4]/10 md:grid-cols-[repeat(2,minmax(0,1fr))] md:divide-y-0">
            {data.monthly.rows.map((r, i) => (
              <li key={`${r.patientId}${i}`} className="flex items-center justify-between gap-3 border-[#fff8e4]/10 py-2.5 md:border-b">
                <div className="min-w-0">
                  <p className="truncate text-[14.5px] font-semibold text-[#fff8e4]">{r.patient}</p>
                  <p className="truncate text-[12.5px] text-[#a8a295]">{planName({ serviceType: r.serviceType, sessions: r.sessions, unlimited: false })}{r.cyclesTotal > 1 ? ` · ${TERM[r.term]} · mes ${r.cycleNumber} de ${r.cyclesTotal}` : ''}</p>
                  {r.contractValue !== null && <p className="truncate text-[11.5px] text-[#8fd0e0]">Contrato {clp(r.contractValue)}{r.discount ? ` (−${Math.round(r.discount * 100)} %)` : ''}</p>}
                </div>
                <p className="shrink-0 text-[14.5px] font-bold tabular-nums text-[#fff8e4]">{clp(r.monthly)}</p>
              </li>
            ))}
          </ul>
        )}
        {data.monthly.untariffed > 0 && <p className="mt-2 text-[12px] text-[#a8a295]">{data.monthly.untariffed} {data.monthly.untariffed === 1 ? 'plan sin tarifa definida no suma' : 'planes sin tarifa definida no suman'}.</p>}
      </Panel>

      <div className="grid gap-4 lg:grid-cols-5">
        <Panel label="Estado de pago de los planes" className="lg:col-span-3">
          <h2 className="text-[16px] font-bold text-[#fff8e4]">Estado de pago de los planes</h2>
          <p className="text-[12.5px] text-[#a8a295]">Según el registro de pago de cada plan; no son montos recibidos</p>
          <div className="mt-4 space-y-4">
            {([['Con pago registrado', current.paidValue, current.paidCount, 'bg-[linear-gradient(90deg,#398ca2,#8fd0e0)]'], ['Pendientes de pago', current.pendingValue, current.pendingCount, 'bg-[#e8b4a0]/70']] as const).map(([label, value, count, bar]) => (
              <div key={label}>
                <div className="flex items-baseline justify-between gap-3 text-[13.5px]"><span className="text-[#cdc6b6]">{label} <span className="text-[#a8a295]">· {count} {count === 1 ? 'plan' : 'planes'}</span></span><span className="font-extrabold tabular-nums text-[#fff8e4]">{clp(value)} <span className="ml-1 text-[12.5px] font-semibold text-[#a8a295]">{pct(value, current.paidValue + current.pendingValue)} %</span></span></div>
                <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-[#fff8e4]/10" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct(value, current.paidValue + current.pendingValue)}><div className={cn('h-full rounded-full', bar)} style={{ width: `${pct(value, current.paidValue + current.pendingValue)}%` }} /></div>
              </div>
            ))}
          </div>
        </Panel>
        <Panel label="Pacientes con plan" className="lg:col-span-2">
          <h2 className="text-[16px] font-bold text-[#fff8e4]">Pacientes con plan</h2>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {data.activePatientInitials.map((ini, i) => (<span key={i} className="flex h-10 w-10 items-center justify-center rounded-full border border-[#62b8cf]/40 bg-[#398ca2]/20 text-[13px] font-bold text-[#fff8e4]">{ini}</span>))}
            {data.activePatients > data.activePatientInitials.length && <span className="flex h-10 min-w-10 items-center justify-center rounded-full border border-[#fff8e4]/20 px-2 text-[12.5px] font-bold text-[#cdc6b6]">+{data.activePatients - data.activePatientInitials.length}</span>}
          </div>
          <p className="mt-3 text-[13.5px] text-[#cdc6b6]"><b className="text-[#fff8e4]">{data.activePatients}</b> {data.activePatients === 1 ? 'paciente activo' : 'pacientes activos'} con un plan vigente hoy.</p>
        </Panel>
      </div>

      <Panel label="Detalle por plan">
        <h2 className="text-[16px] font-bold text-[#fff8e4]">Detalle por plan</h2>
        <p className="text-[12.5px] text-[#a8a295]">Contratos que empiezan en {monthLabel}. Un plan trimestral, semestral o anual cuenta una sola vez, con su descuento.</p>
        {!hasData ? <p className="mt-4 rounded-2xl border border-dashed border-[#fff8e4]/20 p-5 text-center text-sm text-[#a8a295]">No hay planes que empiecen en {monthLabel}.</p> : (
          <>
            <div className="mt-3 hidden overflow-x-auto md:block">
              <table className="w-full min-w-[640px] text-left text-[14px]">
                <thead className="text-[11.5px] uppercase tracking-[0.1em] text-[#a8a295]"><tr><th scope="col" className="py-2 pr-3 font-semibold">Plan</th><th scope="col" className="px-3 font-semibold">Plazo</th><th scope="col" className="px-3 text-right font-semibold">Tarifa base</th><th scope="col" className="px-3 text-right font-semibold">Planes</th><th scope="col" className="pl-3 text-right font-semibold">Valor estimado</th></tr></thead>
                <tbody className="divide-y divide-[#fff8e4]/10">
                  {current.byPlan.map((r) => (
                    <tr key={`${r.serviceType}${r.sessions}${r.unlimited}${r.term}`}>
                      <td className="py-3 pr-3 font-semibold text-[#fff8e4]">{planName(r)}</td>
                      <td className="px-3 text-[#cdc6b6]">{TERM[r.term]}{r.discount ? <span className="ml-1.5 rounded-full border border-[#62b8cf]/40 bg-[#398ca2]/20 px-1.5 py-0.5 text-[11px] font-bold text-[#fff8e4]">−{Math.round(r.discount * 100)} %</span> : null}</td>
                      <td className="px-3 text-right tabular-nums text-[#cdc6b6]">{r.unitPrice === null ? 'Sin tarifa' : clp(r.unitPrice)}</td>
                      <td className="px-3 text-right tabular-nums text-[#fff8e4]">{r.count}</td>
                      <td className="pl-3 text-right font-extrabold tabular-nums text-[#fff8e4]">{r.untariffed === r.count ? '—' : clp(r.value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="mt-2 divide-y divide-[#fff8e4]/10 md:hidden">
              {current.byPlan.map((r) => (
                <li key={`${r.serviceType}${r.sessions}${r.unlimited}${r.term}`} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0"><p className="text-[15px] font-semibold text-[#fff8e4]">{planName(r)}</p><p className="text-[12.5px] text-[#a8a295]">{TERM[r.term]}{r.discount ? ` · −${Math.round(r.discount * 100)} %` : ''} · {r.count} {r.count === 1 ? 'plan' : 'planes'} · {r.unitPrice === null ? 'sin tarifa definida' : `${clp(r.unitPrice)} base`}</p></div>
                  <p className="shrink-0 text-[1.125rem] font-extrabold tabular-nums text-[#fff8e4]">{r.untariffed === r.count ? '—' : clp(r.value)}</p>
                </li>
              ))}
            </ul>
            <ul className="mt-4 grid grid-cols-[minmax(0,1fr)] gap-x-8 divide-y divide-[#fff8e4]/10 border-t border-[#fff8e4]/10 md:grid-cols-[repeat(2,minmax(0,1fr))] md:divide-y-0">
              {data.plans.map((p, i) => (
                <li key={`${p.patientId}${i}`} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0"><p className="truncate text-[14.5px] font-semibold text-[#fff8e4]">{p.patient}</p><p className="truncate text-[12.5px] text-[#a8a295]">{planName(p)} · {TERM[p.term as keyof typeof TERM] ?? p.term}</p></div>
                  <div className="shrink-0 text-right"><p className="text-[14.5px] font-bold tabular-nums text-[#fff8e4]">{p.value === null ? 'Sin tarifa' : clp(p.value)}</p><span className={cn('mt-0.5 inline-block rounded-full border px-2 py-0.5 text-[11px] font-bold', p.paid ? 'border-[#8fd0e0]/50 bg-[#398ca2]/25 text-[#fff8e4]' : 'border-[#e8b4a0]/55 bg-[#e8b4a0]/10 text-[#fff8e4]')}>{p.paid ? 'Pago registrado' : 'Pago pendiente'}</span></div>
                </li>
              ))}
            </ul>
          </>
        )}
      </Panel>

      <section aria-label="Cómo se calcula" className="rounded-[18px] border border-[#fff8e4]/10 bg-[#fff8e4]/[0.03] p-4">
        <h2 className="flex items-center gap-2 text-[13px] font-bold uppercase tracking-[0.12em] text-[#8fd0e0]"><Info className="h-4 w-4" aria-hidden="true" /> Cómo se calcula</h2>
        <ul className="mt-2 space-y-1.5 text-[12.5px] leading-snug text-[#a8a295]">
          {basis.notes.map((n) => (<li key={n}>{n}</li>))}
          {basis.untariffed > 0 && <li>{basis.untariffed} {basis.untariffed === 1 ? 'plan' : 'planes'} sin tarifa definida: se cuentan, pero no suman valor.</li>}
          <li>Para mostrar dinero realmente cobrado, falta registrar el monto y la fecha de cada pago.</li>
        </ul>
      </section>
    </div>
  );
};

export default Income;
