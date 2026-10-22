import { useCallback, useEffect, useMemo, useState } from 'react';
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ArrowDownRight, ArrowUpRight, ChevronLeft, ChevronRight, Info, Users, Wallet } from 'lucide-react';
import { financeService, type FinanceSummary } from '@/services/financeService';
import LoadErrorAlert from '@/components/shared/LoadErrorAlert';
import { CardsSkeleton, PageSkeleton } from '@/components/shared/Skeletons';
import EmptyGuide from '@/components/premium/EmptyGuide';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
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
const planLabel = (service: string, sessions: number | null, unlimited: boolean) => `${service === 'kinesiologia' ? 'Kinesiología' : 'Entrenamiento'} · ${unlimited ? 'ilimitado' : `${sessions} ${sessions === 1 ? 'sesión' : 'sesiones'}`}`;

const Card = ({ children, className, label }: { children: React.ReactNode; className?: string; label?: string }) => (
  <section aria-label={label} className={cn('rounded-[22px] border border-[#fff8e4]/10 bg-[linear-gradient(180deg,#272329,#1f1c21)] p-4 shadow-[0_18px_40px_-26px_rgba(0,0,0,0.9)]', className)}>{children}</section>
);

// Panel de ingresos del profesional. Los montos salen de las tarifas definidas y de los planes con pago registrado; no se inventa nada.
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
    financeService
      .getSummary(month, professional)
      .then(setData)
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  }, [month, professional]);
  useEffect(load, [load]);

  const chart = useMemo(() => (data?.series ?? []).map((s) => ({ ...s, label: SHORT[Number(s.month.slice(5, 7)) - 1], pending: Math.max(0, s.projected - s.collected), current: s.month === data?.month })), [data]);

  if (loading && !data) {
    return (
      <PageSkeleton label="Calculando tus ingresos…">
        <CardsSkeleton count={2} bodyHeight="h-36" />
      </PageSkeleton>
    );
  }
  if (failed && !data) return <LoadErrorAlert message="No se pudieron cargar los ingresos." onRetry={load} />;
  if (!data) return null;

  const { current, variation } = data;
  const total = current.byService.entrenamiento + current.byService.kinesiologia;
  const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0);
  const ratio = current.projected > 0 ? current.collected / current.projected : 0;
  const thisMonth = data.month;
  const isAdmin = user?.role === 'admin';

  return (
    <div className={cn('mx-auto w-full max-w-4xl space-y-4 pb-8 transition-opacity', loading && 'opacity-60')}>
      <header className="space-y-1 pt-1">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#fff8e4]/60">{data.scope === 'center' ? 'Ingresos del centro' : data.scope === 'professional' ? 'Ingresos del profesional' : 'Mis ingresos'}</p>
        <h1 className="text-[1.75rem] font-extrabold leading-[1.1] tracking-tight text-[#fff8e4] sm:text-[2rem]">Panel de ingresos</h1>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div role="group" aria-label="Cambiar de mes" className="flex items-center gap-1 rounded-2xl border border-[#fff8e4]/15 bg-[#1f1c21] p-1">
          <button type="button" aria-label="Mes anterior" onClick={() => setMonth(shiftMonth(thisMonth, -1))} className="flex h-11 w-11 items-center justify-center rounded-xl text-[#8fd0e0] active:bg-[#62b8cf]/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#fff8e4]"><ChevronLeft className="h-5 w-5" aria-hidden="true" /></button>
          <span className="min-w-[10.5rem] px-2 text-center text-[15px] font-semibold text-[#fff8e4]" aria-live="polite">{monthName(thisMonth)}</span>
          <button type="button" aria-label="Mes siguiente" onClick={() => setMonth(shiftMonth(thisMonth, 1))} className="flex h-11 w-11 items-center justify-center rounded-xl text-[#8fd0e0] active:bg-[#62b8cf]/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#fff8e4]"><ChevronRight className="h-5 w-5" aria-hidden="true" /></button>
        </div>
        {isAdmin && data.professionals.length > 0 && (
          <label className="flex items-center gap-2 text-[13px] text-[#cdc6b6]">
            Ver
            <select value={professional ?? ''} onChange={(e) => setProfessional(e.target.value || null)} className="min-h-[44px] rounded-xl border border-[#fff8e4]/20 bg-[#1f1c21] px-3 text-[14px] font-semibold text-[#fff8e4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#fff8e4]">
              <option value="">Todo el centro</option>
              {data.professionals.map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
            </select>
          </label>
        )}
      </div>

      <section aria-label="Ingresos del mes" className="relative overflow-hidden rounded-[26px] border border-[#62b8cf]/35 bg-[linear-gradient(160deg,rgba(57,140,162,0.34),#1f1c21_62%)] p-5">
        <div aria-hidden="true" className="pointer-events-none absolute -right-12 -top-16 h-48 w-48 rounded-full bg-[#62b8cf]/25 blur-3xl" />
        <p className="relative flex items-center gap-2 text-[11.5px] font-bold uppercase tracking-[0.16em] text-[#8fd0e0]"><Wallet className="h-4 w-4" aria-hidden="true" /> Cobrado en {MONTHS[Number(thisMonth.slice(5, 7)) - 1]}</p>
        <p className="relative mt-2 text-[3.1rem] font-extrabold leading-none tracking-[-0.045em] tabular-nums text-[#fff8e4] sm:text-[3.75rem]">{clp(current.collected)}</p>
        <div className="relative mt-2.5 flex flex-wrap items-center gap-2">
          {variation && variation.amount === 0 ? (
            <span className="rounded-full border border-[#fff8e4]/20 px-2.5 py-1 text-[13px] font-bold text-[#fff8e4]">Sin cambios</span>
          ) : variation ? (
            <span className={cn('inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[13px] font-bold tabular-nums', variation.amount >= 0 ? 'border-[#8fd0e0]/50 bg-[#398ca2]/30 text-[#fff8e4]' : 'border-[#e8b4a0]/50 bg-[#e8b4a0]/10 text-[#fff8e4]')}>
              {variation.amount >= 0 ? <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" /> : <ArrowDownRight className="h-3.5 w-3.5" aria-hidden="true" />}
              {variation.amount >= 0 ? '+' : '−'}{String(Math.abs(variation.percent)).replace('.', ',')} %
            </span>
          ) : (
            <span className="rounded-full border border-[#fff8e4]/15 px-2.5 py-1 text-[12.5px] text-[#a8a295]">Sin mes anterior para comparar</span>
          )}
          {variation && <span className="text-[13px] text-[#cdc6b6]">frente a {MONTHS[Number(data.previousMonth.slice(5, 7)) - 1]} ({clp(data.previous.collected)})</span>}
        </div>
        <div className="relative mt-4">
          <div className="flex items-baseline justify-between text-[13px]"><span className="text-[#cdc6b6]">Proyectado del mes</span><span className="font-bold tabular-nums text-[#fff8e4]">{clp(current.projected)}</span></div>
          <div role="progressbar" aria-label="Cobrado frente a proyectado" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(ratio * 100)} className="mt-1.5 h-2 overflow-hidden rounded-full bg-[#fff8e4]/10"><div className="h-full rounded-full bg-[linear-gradient(90deg,#398ca2,#8fd0e0)]" style={{ width: `${ratio * 100}%` }} /></div>
          <p className="mt-1.5 text-[12.5px] text-[#a8a295]">{current.pending > 0 ? `${clp(current.pending)} pendiente de cobro (${current.pendingCount} ${current.pendingCount === 1 ? 'plan' : 'planes'})` : 'Todo lo del mes está cobrado'}</p>
        </div>
      </section>

      <div className="grid grid-cols-3 gap-2.5">
        {[
          { icon: <Users className="h-4 w-4" aria-hidden="true" />, label: 'Pacientes activos', value: data.activePatients },
          { icon: <Wallet className="h-4 w-4" aria-hidden="true" />, label: 'Planes cobrados', value: current.paidCount },
          { icon: <Info className="h-4 w-4" aria-hidden="true" />, label: 'Por cobrar', value: current.pendingCount },
        ].map((k) => (
          <Card key={k.label} className="p-3">
            <div className="flex items-center gap-1.5 text-[#8fd0e0]">{k.icon}<span className="text-[11.5px] leading-tight text-[#cdc6b6]">{k.label}</span></div>
            <p className="mt-2 text-[2rem] font-extrabold leading-none tracking-[-0.03em] tabular-nums text-[#fff8e4]">{k.value}</p>
          </Card>
        ))}
      </div>

      <Card label="Ingresos por mes">
        <div className="flex items-baseline justify-between"><h2 className="text-[15px] font-bold text-[#fff8e4]">Últimos 6 meses</h2><span className="flex items-center gap-3 text-[11.5px] text-[#a8a295]"><span className="flex items-center gap-1"><i className="inline-block h-2 w-2 rounded-sm bg-[#62b8cf]" />Cobrado</span><span className="flex items-center gap-1"><i className="inline-block h-2 w-2 rounded-sm border border-dashed border-[#62b8cf]" />Pendiente</span></span></div>
        <div role="img" aria-label={`Cobrado por mes: ${chart.map((c) => `${c.label} ${clp(c.collected)}`).join(', ')}`} className="mt-2 h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chart} margin={{ top: 14, right: 4, bottom: 0, left: 0 }}>
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#a8a295' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#a8a295' }} axisLine={false} tickLine={false} width={58} tickFormatter={(v: number) => compact(v)} domain={[0, (max: number) => Math.max(100000, Math.ceil((max * 1.1) / 100000) * 100000)]} />
              <Tooltip cursor={{ fill: 'rgba(98,184,207,0.08)' }} content={({ active, payload }) => {
                const p = active && payload?.[0]?.payload;
                if (!p) return null;
                return (<div className="rounded-xl border border-[#fff8e4]/15 bg-[#272329] px-3 py-2 text-[12.5px] text-[#fff8e4] shadow-lg"><p className="font-semibold text-[#a8a295]">{monthName(p.month)}</p><p className="text-[15px] font-extrabold tabular-nums">{clp(p.collected)}</p>{p.pending > 0 && <p className="text-[#a8a295]">+ {clp(p.pending)} pendiente</p>}</div>);
              }} />
              <Bar dataKey="collected" stackId="a" radius={[0, 0, 6, 6]} isAnimationActive={false}>
                {chart.map((c) => (<Cell key={c.month} fill={c.current ? '#62b8cf' : '#2b6f82'} />))}
              </Bar>
              <Bar dataKey="pending" stackId="a" radius={[6, 6, 0, 0]} isAnimationActive={false}>
                {chart.map((c) => (<Cell key={c.month} fill="rgba(98,184,207,0.08)" stroke="#62b8cf" strokeDasharray="3 3" strokeOpacity={0.7} />))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card label="Distribución por servicio">
        <h2 className="text-[15px] font-bold text-[#fff8e4]">Por tipo de servicio</h2>
        {total > 0 ? (
          <>
            <div className="mt-3 flex h-3 overflow-hidden rounded-full bg-[#fff8e4]/10" role="img" aria-label={`Entrenamiento ${pct(current.byService.entrenamiento)} %, kinesiología ${pct(current.byService.kinesiologia)} %`}>
              <div className="h-full bg-[#62b8cf]" style={{ width: `${pct(current.byService.entrenamiento)}%` }} />
              <div className="h-full bg-[#2b6f82]" style={{ width: `${pct(current.byService.kinesiologia)}%` }} />
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-3">
              {[['Entrenamiento', current.byService.entrenamiento, '#62b8cf'], ['Kinesiología', current.byService.kinesiologia, '#2b6f82']].map(([label, value, color]) => (
                <div key={label as string}><dt className="flex items-center gap-1.5 text-[12.5px] text-[#cdc6b6]"><i className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: color as string }} />{label as string} · {pct(value as number)} %</dt><dd className="mt-0.5 text-[1.375rem] font-extrabold tabular-nums text-[#fff8e4]">{clp(value as number)}</dd></div>
              ))}
            </dl>
          </>
        ) : <p className="mt-2 text-sm text-[#a8a295]">Todavía no hay planes cobrados este mes.</p>}
      </Card>

      <Card label="Planes del mes">
        <h2 className="text-[15px] font-bold text-[#fff8e4]">Por plan</h2>
        {current.byPlan.length === 0 ? <p className="mt-2 text-sm text-[#a8a295]">No hay planes que empiecen este mes.</p> : (
          <ul className="mt-1 divide-y divide-[#fff8e4]/10">
            {current.byPlan.map((r) => (
              <li key={`${r.serviceType}${r.sessions}${r.unlimited}`} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0"><p className="truncate text-[15px] font-semibold text-[#fff8e4]">{planLabel(r.serviceType, r.sessions, r.unlimited)}</p><p className="text-[12.5px] text-[#a8a295]">{r.count} {r.count === 1 ? 'ciclo' : 'ciclos'} · {r.price === null ? 'sin tarifa definida' : `${clp(r.price)} c/u`}</p></div>
                <div className="shrink-0 text-right"><p className="text-[1.125rem] font-extrabold tabular-nums text-[#fff8e4]">{r.price === null ? '—' : clp(r.collected)}</p>{r.pending > 0 && <p className="text-[12px] font-semibold tabular-nums text-[#e8b4a0]">+ {clp(r.pending)} por cobrar</p>}</div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card label="Pacientes del mes">
        <h2 className="text-[15px] font-bold text-[#fff8e4]">Pacientes con plan este mes</h2>
        {data.plans.length === 0 ? (
          <EmptyGuide icon={Users} title="Aún no hay planes este mes" description="Cuando se registre un plan de uno de tus pacientes aparecerá aquí." />
        ) : (
          <ul className="mt-1 divide-y divide-[#fff8e4]/10">
            {data.plans.map((p, i) => (
              <li key={`${p.patientId}${i}`} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0"><p className="truncate text-[15px] font-semibold text-[#fff8e4]">{p.patient}</p><p className="text-[12.5px] text-[#a8a295]">{planLabel(p.serviceType, p.sessions, p.unlimited)}</p></div>
                <div className="shrink-0 text-right"><p className="text-[15px] font-bold tabular-nums text-[#fff8e4]">{p.price === null ? 'Sin tarifa' : clp(p.price)}</p><span className={cn('mt-0.5 inline-block rounded-full border px-2 py-0.5 text-[11px] font-bold', p.paid ? 'border-[#8fd0e0]/50 bg-[#398ca2]/25 text-[#fff8e4]' : 'border-[#e8b4a0]/55 bg-[#e8b4a0]/10 text-[#fff8e4]')}>{p.paid ? 'Cobrado' : 'Por cobrar'}</span></div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <p className="flex items-start gap-2 px-1 text-[12px] leading-snug text-[#a8a295]"><Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />{data.notes.cycleRule}{data.notes.noTariff ? ` ${data.notes.noTariff}` : ''}</p>
    </div>
  );
};

export default Income;
