import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Check, ChevronRight, Info, Pause, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FormField } from '@/components/forms/FormField';
import PageTitle from '@/components/premium/PageTitle';
import LoadErrorAlert from '@/components/shared/LoadErrorAlert';
import { CardsSkeleton, PageSkeleton } from '@/components/shared/Skeletons';
import { BTN_FILL, CARD, HERO_SURFACE } from '@/components/dashboard/brand';
import GoalIcon from '@/components/goals/GoalIcon';
import { measurementService } from '@/services/measurementService';
import { goalService, type CatalogCategory, type CatalogIndicator, type CreateGoalInput, type GoalCatalog, type GoalDirection, type GoalParamDef, type GoalSources, type GoalView } from '@/services/goalService';
import { INVALID_NUMBER, parseDecimal } from '@/lib/decimal';
import { exerciseKeyOf } from '@/lib/exerciseKey';
import { activeGoals, dayLabel, decimalText, directionText, formatValue, paramsText, safetyNote, startingPoint } from '@/lib/goals';
import { getWhatsAppUrl } from '@/config/contact';
import { notify } from '@/lib/notify';
import { showApiError } from '@/lib/apiError';
import { cn } from '@/lib/utils';

// Creación de un objetivo en TRES pasos: qué mejorar → cómo lo medimos → tu meta.
interface IndState {
  params: Record<string, string>;
  unit: string;
  direction: GoalDirection;
  target: string;
  tolerance: string;
  start: string; // valor de partida opcional que se escribe ahí mismo (autorreporte o medición); si queda vacío, se registra después
}

const OTHER = '__other__';
const NUMBER_ERROR = 'Escribe un número; para decimales usa coma o punto (ej. 32,5)';

const Chips = ({ label, options, value, onChange }: { label: string; options: { value: string; label: string }[]; value: string; onChange: (v: string) => void }) => (
  <div role="group" aria-label={label} className="flex flex-wrap gap-2">
    {options.map((o) => (
      <button key={o.value} type="button" aria-pressed={value === o.value} onClick={() => onChange(o.value)} className={cn('min-h-[44px] rounded-full border px-4 text-[14px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#fff8e4]', value === o.value ? 'border-[#398ca2] bg-[#398ca2] font-extrabold text-[#181619]' : 'border-[#fff8e4]/40 text-[#cdc6b6]')}>
        {o.label}
      </button>
    ))}
  </div>
);

const fieldInput = 'h-12 border-[#fff8e4]/40 bg-[#fff8e4]/[0.05] text-base text-[#fff8e4]';

const GoalNew = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  // Con un id en la ruta es el profesional proponiendo un objetivo a SU paciente; sin id, la persona crea el suyo
  const { id: routePatientId } = useParams<{ id: string }>();
  const staff = !!routePatientId;
  const patientId = routePatientId ?? user?.id;
  const homePath = staff ? `/app/admin/pacientes/${patientId}?tab=goals` : '/app/objetivos';
  const [catalog, setCatalog] = useState<GoalCatalog | null>(null);
  const [sources, setSources] = useState<GoalSources | null>(null);
  const [existing, setExisting] = useState<GoalView[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const [step, setStep] = useState(1);
  const [categoryId, setCategoryId] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [ind, setInd] = useState<Record<string, IndState>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [priority, setPriority] = useState<'primary' | 'secondary'>('primary');
  const [pauseId, setPauseId] = useState('');
  const [targetDay, setTargetDay] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState<GoalView | null>(null); // objetivo recién creado: pantalla de «¿agregar otro?»

  const load = () => {
    if (!patientId) return;
    setLoading(true);
    setFailed(false);
    Promise.all([goalService.getCatalog(), goalService.list(patientId)])
      .then(([c, g]) => {
        setCatalog(c);
        setExisting(g);
        goalService.sources(patientId).then(setSources).catch(() => setSources(null));
      })
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  };
  useEffect(load, [patientId]);

  const active = useMemo(() => activeGoals(existing), [existing]);
  const primaryTaken = active.some((g) => g.slot === 1);
  const freeSecondary = [2, 3].some((s) => !active.some((g) => g.slot === s));
  useEffect(() => {
    setPriority(primaryTaken ? 'secondary' : 'primary');
  }, [primaryTaken]);

  const category: CatalogCategory | undefined = catalog?.categories.find((c) => c.id === categoryId);
  const def = (id: string): CatalogIndicator | undefined => category?.indicators.find((i) => i.id === id);

  const pickCategory = (c: CatalogCategory) => {
    setCategoryId(c.id);
    setErrors({});
    // Con un solo indicador posible ya está elegido
    setSelected(c.indicators.length === 1 ? [c.indicators[0].id] : []);
    setInd({});
  };

  const stateOf = (d: CatalogIndicator): IndState =>
    ind[d.id] ?? { params: {}, unit: d.unit ?? d.unitOptions?.[0] ?? '', direction: d.defaultDirection, target: '', tolerance: '', start: '' };
  const patchInd = (d: CatalogIndicator, patch: Partial<IndState>) => setInd((cur) => ({ ...cur, [d.id]: { ...stateOf(d), ...patch } }));
  const setParam = (d: CatalogIndicator, key: string, value: string) => patchInd(d, { params: { ...stateOf(d).params, [key]: value } });

  const toggleIndicator = (c: CatalogCategory, id: string) => {
    if (!c.multiIndicator) return setSelected([id]);
    setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : cur.length < (catalog?.maxIndicatorsPerGoal ?? 5) ? [...cur, id] : cur));
  };

  // ── Paso 2: lo elegido está completo ──
  const validateStep2 = (): boolean => {
    const next: Record<string, string> = {};
    if (selected.length === 0) next.indicators = 'Elige cómo quieres medir tu avance';
    for (const id of selected) {
      const d = def(id);
      if (!d) continue;
      const s = stateOf(d);
      for (const p of d.params) {
        const v = s.params[p.key] ?? '';
        if (p.required && !v.trim()) next[`${id}.${p.key}`] = `Falta: ${p.label.toLowerCase()}`;
        else if (v && p.type === 'number') {
          const n = parseDecimal(v);
          if (n === INVALID_NUMBER || n === null || n < (p.min ?? 0) || n > (p.max ?? Infinity)) next[`${id}.${p.key}`] = `${p.label}: entre ${p.min} y ${p.max}`;
        }
      }
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const paramsOf = (d: CatalogIndicator): Record<string, string | number> => {
    const s = stateOf(d);
    const out: Record<string, string | number> = {};
    for (const p of d.params) {
      const v = (s.params[p.key] ?? '').trim();
      if (!v) continue;
      out[p.key] = p.type === 'number' ? (parseDecimal(v) as number) : p.type === 'exercise' ? exerciseKeyOf(v) : v;
    }
    return out;
  };

  // ── Paso 3: metas ──
  // El punto de partida se puede escribir ahí mismo cuando el valor lo anota la persona (autorreporte) o es una medición
  // corporal; el de ejercicios, dolor y saltos sale de sus propios registros y se hace después.
  const canEnterStart = (d: CatalogIndicator) => !d.professionalEntryOnly && (d.source === 'checkin' || d.source === 'measurement_field' || d.source === 'measurement_perimeter');
  const baselineOf = (d: CatalogIndicator): number | null => {
    const known = startingPoint(d, paramsOf(d), sources);
    if (known) return known.value;
    if (canEnterStart(d)) {
      const n = parseDecimal(stateOf(d).start);
      return n !== null && n !== INVALID_NUMBER ? n : null;
    }
    return null;
  };

  const validateStep3 = (): boolean => {
    const next: Record<string, string> = {};
    for (const id of selected) {
      const d = def(id);
      if (!d) continue;
      const s = stateOf(d);
      const t = parseDecimal(s.target);
      if (t === INVALID_NUMBER) next[`${id}.target`] = NUMBER_ERROR;
      else if (t === null) {
        // Sin meta todavía es válido: el objetivo queda «por definir» y se completa después desde su tarjeta
      } else if (t < d.range.min || t > d.range.max) next[`${id}.target`] = `La meta debe estar entre ${decimalText(d.range.min)} y ${decimalText(d.range.max)}`;
      else {
        const base = baselineOf(d);
        if (base !== null && ((s.direction === 'increase' && t <= base) || (s.direction === 'decrease' && t >= base))) {
          next[`${id}.target`] = `Tu meta debe estar ${s.direction === 'increase' ? 'por encima' : 'por debajo'} de tu punto de partida (${formatValue(base, s.unit || d.unit || '')})`;
        }
      }
      if (s.direction === 'maintain' && t !== null && t !== INVALID_NUMBER) {
        const tol = parseDecimal(s.tolerance);
        if (tol === null || tol === INVALID_NUMBER || tol <= 0) next[`${id}.tolerance`] = 'Indica cuánto margen aceptas (mayor que 0)';
      }
      if (s.start.trim()) {
        const st = parseDecimal(s.start);
        if (st === INVALID_NUMBER) next[`${id}.start`] = NUMBER_ERROR;
        else if (st !== null && (st < d.range.min || st > d.range.max)) next[`${id}.start`] = `El valor debe estar entre ${decimalText(d.range.min)} y ${decimalText(d.range.max)}`;
      }
    }
    const needPause = (priority === 'primary' && primaryTaken) || (priority === 'secondary' && !freeSecondary);
    if (needPause && !pauseId) next.pause = 'Elige qué objetivo pausar para dejar lugar a este';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const needsPro = !!category && (category.supervision === 'required' || selected.some((id) => def(id)?.clinical));
  const pendingForPro = needsPro && user?.role !== 'professional'; // el profesional lo deja validado; el paciente y administración, pendiente

  const submit = async () => {
    if (!patientId || !category || saving || !validateStep3()) return;
    setSaving(true);
    try {
      // Valores de partida de mediciones corporales escritos ahí mismo: se guardan como una medición real (de hoy) ANTES de crear
      // el objetivo, así el punto de partida queda fijado con un registro con fecha. Si no se pudo guardar, el objetivo se crea igual.
      const fields: Record<string, number> = {};
      const perimeters: Record<string, number> = {};
      for (const id of selected) {
        const d = def(id);
        if (!d || (d.source !== 'measurement_field' && d.source !== 'measurement_perimeter') || startingPoint(d, paramsOf(d), sources)) continue;
        const v = parseDecimal(stateOf(d).start);
        if (v === null || v === INVALID_NUMBER) continue;
        if (d.source === 'measurement_field' && d.field) fields[d.field] = v;
        else {
          const key = d.field ?? String(paramsOf(d).field ?? '');
          if (key) perimeters[key] = v;
        }
      }
      if (Object.keys(fields).length > 0 || Object.keys(perimeters).length > 0) {
        try {
          await measurementService.create({ patient: patientId, date: new Date().toISOString(), perimeters, ...fields });
        } catch (err) {
          showApiError(err, 'No se pudo guardar tu valor de hoy. Puedes registrarlo después en Mediciones');
        }
      }
      const input: CreateGoalInput = {
        categoryId: category.id,
        priority,
        targetDay: targetDay || undefined,
        pauseGoalId: pauseId || undefined,
        indicators: selected.map((id) => {
          const d = def(id)!;
          const s = stateOf(d);
          const t = parseDecimal(s.target);
          const tol = parseDecimal(s.tolerance);
          return {
            indicatorId: id,
            params: paramsOf(d),
            ...(d.unitOptions ? { unit: s.unit } : {}),
            direction: s.direction,
            ...(t !== null && t !== INVALID_NUMBER ? { target: { value: t, ...(s.direction === 'maintain' && tol !== null && tol !== INVALID_NUMBER ? { tolerance: tol } : {}) } } : {}),
          };
        }),
      };
      const goal = await goalService.create(patientId, input);
      // Valores de partida declarados en indicadores manuales: se guardan como autorreporte
      for (const view of goal.progress.indicators) {
        const d = def(view.indicatorId);
        const start = d ? parseDecimal(stateOf(d).start) : null;
        if (view.manual && start !== null && start !== INVALID_NUMBER && !view.professionalEntryOnly && goal.status === 'active') {
          await goalService.checkin(goal.id, { seriesKey: view.seriesKey, value: start }).catch(() => undefined);
        }
      }
      notify.success(goal.status === 'pending_validation' ? (staff ? 'Objetivo creado: queda por validar por un profesional' : 'Objetivo enviado a tu kinesiólogo para validarlo') : 'Objetivo creado');
      setDone(goal);
      goalService.list(patientId).then(setExisting).catch(() => undefined); // refresca los cupos para decidir si se puede agregar otro
    } catch (err) {
      showApiError(err, 'No se pudo crear el objetivo');
      load();
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <PageSkeleton label="Cargando…"><CardsSkeleton count={3} bodyHeight="h-16" /></PageSkeleton>;
  if (failed || !catalog) return <LoadErrorAlert message="No se pudo cargar el catálogo de objetivos." onRetry={load} />;

  const back = () => (step === 1 ? navigate(homePath) : setStep(step - 1));

  const addAnother = () => {
    setDone(null);
    setStep(1);
    setCategoryId('');
    setSelected([]);
    setInd({});
    setErrors({});
    setPauseId('');
    setTargetDay('');
    window.scrollTo?.({ top: 0 });
  };

  if (done) {
    const maxActive = catalog.maxActiveGoals;
    const used = active.length;
    const left = Math.max(0, maxActive - used);
    const pending = done.status === 'pending_validation';
    const missing = done.progress.indicators.some((i) => i.state === 'needs_target')
      ? (staff ? 'Falta definir la meta: se puede completar desde la tarjeta del objetivo.' : 'Aún falta tu meta: puedes definirla cuando quieras desde Mis objetivos.')
      : done.progress.indicators.some((i) => i.state === 'needs_baseline')
        ? (staff ? 'Falta un primer registro para fijar el punto de partida.' : 'Aún falta tu punto de partida: apenas lo registres quedará fijado.')
        : null;
    return (
      <div className="mx-auto w-full max-w-3xl space-y-5 pb-10">
        <PageTitle eyebrow={done.categoryName} title={pending ? (staff ? 'Objetivo creado' : 'Enviado a tu kinesiólogo') : '¡Objetivo creado!'} description={pending ? (staff ? 'Queda por validar por un profesional antes de activarse.' : 'Tu kinesiólogo lo revisará y validará la meta antes de activarlo.') : 'Ya lo estamos siguiendo con tus registros.'} serif />
        {missing && <p className={cn(CARD, 'p-4 text-[14px] text-[#cdc6b6]')}>{missing}</p>}
        <p className={cn(CARD, 'p-4 text-[14px] text-[#cdc6b6]')}>
          {left > 0
            ? <>Llevas <b className="text-[#fff8e4]">{used} de {maxActive}</b> objetivos. {staff ? 'Se puede agregar otro.' : 'Puedes agregar otro ahora o cuando quieras.'}</>
            : <>{staff ? 'Ya tiene' : 'Ya tienes'} sus <b className="text-[#fff8e4]">{maxActive} objetivos</b>. Para agregar otro, hay que pausar uno: su progreso se conserva.</>}
        </p>
        {left > 0 && (
          <Button type="button" onClick={addAnother} className={cn('min-h-[52px] w-full rounded-2xl text-base font-bold', BTN_FILL)}>Agregar otro objetivo<ChevronRight aria-hidden="true" /></Button>
        )}
        <Button type="button" variant="outline" onClick={() => navigate(homePath)} className="min-h-[52px] w-full rounded-2xl border-[#398ca2] bg-transparent text-base font-bold text-[#fff8e4] hover:bg-[#398ca2]/15 hover:text-[#fff8e4]">{staff ? 'Volver a los objetivos del paciente' : 'Ver mis objetivos'}</Button>
      </div>
    );
  }

  const renderParam = (d: CatalogIndicator, p: GoalParamDef) => {
    const s = stateOf(d);
    const value = s.params[p.key] ?? '';
    const error = errors[`${d.id}.${p.key}`];
    if (p.type === 'enum' && p.options) {
      return (
        <FormField key={p.key} label={p.label} required={p.required} error={error}>
          {() => (p.options!.length <= 6
            ? <Chips label={p.label} options={p.options!} value={value} onChange={(v) => setParam(d, p.key, v)} />
            : (
              <Select value={value} onValueChange={(v) => setParam(d, p.key, v)}>
                <SelectTrigger className={fieldInput} aria-label={p.label}><SelectValue placeholder="Elegir…" /></SelectTrigger>
                <SelectContent>{p.options!.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
              </Select>
            ))}
        </FormField>
      );
    }
    if (p.type === 'exercise') {
      const list = sources?.exercises ?? [];
      const typed = value !== '' && !list.some((e) => e.key === value);
      return (
        <FormField key={p.key} label={p.label} required error={error}>
          {(c) => (
            <div className="space-y-2">
              {list.length > 0 && (
                <Select value={typed ? OTHER : value} onValueChange={(v) => setParam(d, p.key, v === OTHER ? ' ' : v)}>
                  <SelectTrigger className={fieldInput} aria-label="Ejercicio de tu historial"><SelectValue placeholder="Elegir de tu historial…" /></SelectTrigger>
                  <SelectContent>
                    {list.map((e) => <SelectItem key={e.key} value={e.key}>{e.name} · {e.sessions} {e.sessions === 1 ? 'sesión' : 'sesiones'}</SelectItem>)}
                    <SelectItem value={OTHER}>Otro ejercicio…</SelectItem>
                  </SelectContent>
                </Select>
              )}
              {(list.length === 0 || typed) && (
                <>
                  <Input {...c} className={fieldInput} placeholder="Ej. Press banca" value={value.trim() === '' ? '' : value} onChange={(e) => setParam(d, p.key, e.target.value)} />
                  {list.length === 0 && <p className="text-[12.5px] text-[#a8a295]">{staff ? 'El paciente aún no tiene ejercicios registrados. Puedes escribir el ejercicio; su primera marca será el punto de partida.' : <>Aún no tienes ejercicios registrados. Puedes escribir el ejercicio y registrar tu primera marca en <Link to="/app/entrenamiento" className="font-semibold text-[#8fd0e0] underline">Entrenamiento</Link>.</>}</p>}
                </>
              )}
            </div>
          )}
        </FormField>
      );
    }
    return (
      <FormField key={p.key} label={p.label} required={p.required} error={error}>
        {(c) => <Input {...c} className={fieldInput} type="text" inputMode={p.type === 'number' ? 'decimal' : 'text'} maxLength={p.max && p.type === 'text' ? p.max : undefined} value={value} onChange={(e) => setParam(d, p.key, e.target.value)} />}
      </FormField>
    );
  };

  const hint = (d: CatalogIndicator) => {
    const known = startingPoint(d, paramsOf(d), sources);
    if (known) return <p className="flex items-start gap-1.5 text-[13px] text-[#8fd0e0]"><Check aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />Ya tienes un registro: {formatValue(known.value, d.unit ?? '')} ({dayLabel(known.day)}). Lo usaremos como tu punto de partida.</p>;
    if (d.source === 'checkin') return <p className="text-[13px] text-[#cdc6b6]">{d.professionalEntryOnly ? 'Tu kinesiólogo registrará los valores de este indicador.' : 'Este valor lo registras tú. Tu primer registro será tu punto de partida.'}</p>;
    if (d.source === 'exercise_reps') return <p className="text-[13px] text-[#cdc6b6]">Contaremos tus series hechas con esa carga.</p>;
    return <p className="text-[13px] text-[#cdc6b6]">Aún no tienes este dato: primero necesitamos registrar tu punto de partida{d.source === 'eva' ? ' en Dolor (EVA)' : d.source.startsWith('exercise') ? ' en Entrenamiento' : ' en Mediciones'}.</p>;
  };

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5 pb-10">
      <div className="space-y-3">
        <button type="button" onClick={back} className="inline-flex min-h-[44px] items-center gap-1 rounded-xl text-[15px] font-semibold text-[#8fd0e0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#fff8e4]"><ArrowLeft className="h-5 w-5" aria-hidden="true" />{step === 1 ? (staff ? 'Objetivos del paciente' : 'Mis objetivos') : 'Atrás'}</button>
        <div role="progressbar" aria-label={`Paso ${step} de 3`} aria-valuemin={1} aria-valuemax={3} aria-valuenow={step} className="flex gap-1.5">
          {[1, 2, 3].map((n) => <span key={n} className={cn('h-1.5 flex-1 rounded-full', n <= step ? 'bg-[#398ca2]' : 'bg-[#fff8e4]/15')} />)}
        </div>
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#fff8e4]/60">Paso {step} de 3</p>
      </div>

      {step === 1 && (
        <>
          <PageTitle title={staff ? '¿Qué quiere mejorar el paciente?' : '¿Qué te gustaría mejorar?'} description={staff ? `Elige la categoría. Puede tener hasta ${catalog.maxActiveGoals} objetivos a la vez (hoy tiene ${active.length}).` : `Elige una opción. Puedes tener hasta ${catalog.maxActiveGoals} objetivos a la vez (hoy tienes ${active.length}): agrega uno ahora y los otros cuando quieras.`} serif />
          <ul className="space-y-2">
            {catalog.categories.map((c) => (
              <li key={c.id}>
                <button type="button" aria-pressed={categoryId === c.id} onClick={() => pickCategory(c)} className={cn(CARD, 'border-[#fff8e4]/35 flex min-h-[64px] w-full items-center gap-3 p-3.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#fff8e4]', categoryId === c.id ? 'border-[#62b8cf] bg-[#398ca2]/20' : 'hover:bg-[#fff8e4]/[0.07]')}>
                  <span aria-hidden="true" className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border', categoryId === c.id ? 'border-[#62b8cf] bg-[#398ca2]/30 text-[#fff8e4]' : 'border-[#398ca2]/40 bg-[#398ca2]/12 text-[#8fd0e0]')}><GoalIcon name={c.icon} className="h-5 w-5" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15.5px] font-bold text-[#fff8e4]">{c.name}</span>
                    <span className="block text-[13px] leading-snug text-[#a8a295]">{c.description}</span>
                  </span>
                  {categoryId === c.id && <Check aria-hidden="true" className="h-5 w-5 shrink-0 text-[#8fd0e0]" />}
                </button>
              </li>
            ))}
          </ul>
          <Button type="button" disabled={!categoryId} onClick={() => setStep(2)} className={cn('min-h-[52px] w-full rounded-2xl text-base font-bold', BTN_FILL)}>Siguiente<ChevronRight aria-hidden="true" /></Button>
        </>
      )}

      {step === 2 && category && (
        <>
          <PageTitle eyebrow={category.name} title={staff ? '¿Cómo mediremos su avance?' : '¿Cómo mediremos tu avance?'} description={category.multiIndicator ? 'Puedes elegir varios indicadores dentro de este mismo objetivo.' : staff ? 'Se usan los registros que el paciente ya tiene en PRIME.' : 'Usamos los registros que ya tienes en PRIME.'} serif />
          {category.supervision === 'required' && (
            <p className={cn(CARD, 'flex items-start gap-2 p-3.5 text-[13.5px] text-[#cdc6b6]')}><ShieldCheck aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-[#8fd0e0]" />{staff ? 'Este tipo de objetivo requiere validación profesional.' : 'Este tipo de objetivo lo revisa y valida tu kinesiólogo antes de activarse.'}</p>
          )}
          {!staff && safetyNote(category.id) && (
            <p className={cn(CARD, 'space-y-2 p-3.5 text-[13.5px] text-[#cdc6b6]')}>
              {safetyNote(category.id)}{' '}
              <a href={getWhatsAppUrl('Hola, quiero consultar por un objetivo en PRIME F&H')} target="_blank" rel="noopener noreferrer" className="font-semibold text-[#8fd0e0] underline">Escribir al equipo<span className="sr-only"> (se abre en otra pestaña)</span></a>
            </p>
          )}
          {errors.indicators && <p role="alert" className="text-[13px] font-medium text-[#ffb4a8]">{errors.indicators}</p>}
          <ul className="space-y-3">
            {category.indicators.map((d) => {
              const on = selected.includes(d.id);
              const s = stateOf(d);
              return (
                <li key={d.id} className={cn(CARD, 'border-[#fff8e4]/35', on && 'border-[#62b8cf]')}>
                  {category.indicators.length > 1 ? (
                    <button type="button" aria-pressed={on} onClick={() => toggleIndicator(category, d.id)} className="flex min-h-[56px] w-full items-center justify-between gap-3 rounded-[22px] p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#fff8e4]">
                      <span className="text-[15px] font-bold text-[#fff8e4]">{d.label}</span>
                      <span aria-hidden="true" className={cn('flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2', on ? 'border-[#398ca2] bg-[#398ca2] text-[#181619]' : 'border-[#fff8e4]/30')}>{on && <Check className="h-4 w-4" />}</span>
                    </button>
                  ) : (
                    <p className="p-4 pb-0 text-[15px] font-bold text-[#fff8e4]">{d.label}</p>
                  )}
                  {on && (
                    <div className="space-y-4 px-4 pb-4 pt-3">
                      {d.params.map((p) => renderParam(d, p))}
                      {d.unitOptions && (
                        <FormField label="Unidad" required>
                          {() => <Chips label="Unidad" options={d.unitOptions!.map((u) => ({ value: u, label: u }))} value={s.unit} onChange={(v) => patchInd(d, { unit: v })} />}
                        </FormField>
                      )}
                      {d.directions.length > 1 && (
                        <FormField label="¿Qué quieres lograr?" required>
                          {() => <Chips label="Dirección" options={d.directions.map((x) => ({ value: x, label: directionText(x) }))} value={s.direction} onChange={(v) => patchInd(d, { direction: v as GoalDirection })} />}
                        </FormField>
                      )}
                      {hint(d)}
                      {d.note && <p className="flex items-start gap-1.5 text-[12.5px] text-[#a8a295]"><Info aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0" />{d.note}</p>}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          <Button type="button" onClick={() => validateStep2() && setStep(3)} className={cn('min-h-[52px] w-full rounded-2xl text-base font-bold', BTN_FILL)}>Siguiente<ChevronRight aria-hidden="true" /></Button>
        </>
      )}

      {step === 3 && category && (
        <>
          <PageTitle eyebrow={category.name} title={staff ? 'Define la meta' : 'Define tu meta'} description={staff ? 'Dónde está hoy el paciente y hasta dónde quiere llegar.' : 'Dónde estás hoy y hasta dónde quieres llegar.'} serif />
          {needsPro && (
            <p className={cn('flex items-start gap-2 rounded-[22px] border p-3.5 text-[13.5px] text-[#cdc6b6]', HERO_SURFACE)}><ShieldCheck aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-[#8fd0e0]" />{staff ? (pendingForPro ? 'Un profesional deberá validar este objetivo antes de activarlo.' : 'Al crearlo como profesional, queda validado y activo.') : 'Tu kinesiólogo revisará este objetivo y definirá o validará la meta antes de activarlo. Puedes proponer la tuya.'}</p>
          )}
          <div className="space-y-4">
            {selected.map((id) => {
              const d = def(id);
              if (!d) return null;
              const s = stateOf(d);
              const unit = s.unit || d.unit || '';
              const known = startingPoint(d, paramsOf(d), sources);
              return (
                <section key={id} aria-label={d.label} className={cn(CARD, 'space-y-3 p-4')}>
                  <div>
                    <h2 className="text-[15.5px] font-bold text-[#fff8e4]">{paramsText({ indicatorId: id, params: paramsOf(d) }, category, sources) || d.label}</h2>
                    <p className="text-[12.5px] text-[#a8a295]">{d.label} · {directionText(s.direction)}</p>
                  </div>
                  <div className="rounded-xl border border-[#fff8e4]/10 bg-[#fff8e4]/[0.03] p-3">
                    <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#a8a295]">{staff ? 'Punto de partida' : 'Tu punto de partida'}</p>
                    {known ? (
                      <p className="mt-0.5 text-[1.3rem] font-extrabold tabular-nums text-[#fff8e4]">{formatValue(known.value, unit)} <span className="text-[13px] font-medium text-[#a8a295]">· {dayLabel(known.day)}</span></p>
                    ) : canEnterStart(d) ? (
                      <div className="mt-1 space-y-1">
                        <p className="text-[13px] text-[#cdc6b6]">{d.source === 'checkin' ? 'Si quieres, escribe tu valor de hoy (queda como autorreporte).' : 'Si quieres, escribe tu valor de hoy (se guarda como una medición).'} Si lo dejas en blanco, lo registras después y ese será tu punto de partida.</p>
                        <FormField label={`Valor de hoy (${unit})`} error={errors[`${id}.start`]}>
                          {(c) => <Input {...c} className={fieldInput} type="text" inputMode="decimal" value={s.start} onChange={(e) => patchInd(d, { start: e.target.value })} />}
                        </FormField>
                      </div>
                    ) : (
                      <p className="mt-0.5 text-[14px] text-[#cdc6b6]">Aún no hay un registro. Puedes seguir y registrarlo después{d.source === 'eva' ? ' en Dolor (EVA)' : d.source.startsWith('exercise') ? ' en Entrenamiento' : ' en Mediciones'}: ese será tu punto de partida.</p>
                    )}
                  </div>
                  <FormField label={`${staff ? 'Meta' : 'Tu meta'} (${unit}) · opcional`} error={errors[`${id}.target`]}>
                    {(c) => <Input {...c} className={fieldInput} type="text" inputMode="decimal" placeholder={d.professionalTarget && !staff ? 'Opcional: la define tu kinesiólogo' : 'Puedes dejarla para después'} value={s.target} onChange={(e) => patchInd(d, { target: e.target.value })} />}
                  </FormField>
                  {s.direction === 'maintain' && s.target.trim() !== '' && (
                    <FormField label={`Margen que aceptas (± ${unit})`} required error={errors[`${id}.tolerance`]}>
                      {(c) => <Input {...c} className={fieldInput} type="text" inputMode="decimal" value={s.tolerance} onChange={(e) => patchInd(d, { tolerance: e.target.value })} />}
                    </FormField>
                  )}
                </section>
              );
            })}
          </div>

          <section aria-label="Prioridad" className={cn(CARD, 'space-y-3 p-4')}>
            <h2 className="text-[15.5px] font-bold text-[#fff8e4]">¿Qué prioridad tiene?</h2>
            <Chips label="Prioridad" value={priority} onChange={(v) => { setPriority(v as 'primary' | 'secondary'); setPauseId(''); }} options={[{ value: 'primary', label: 'Principal' }, { value: 'secondary', label: 'Secundario' }]} />
            {((priority === 'primary' && primaryTaken) || (priority === 'secondary' && !freeSecondary)) && (
              <div className="space-y-2 rounded-xl border border-[#fff8e4]/15 p-3">
                <p className="flex items-start gap-1.5 text-[13.5px] text-[#cdc6b6]"><Pause aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />{priority === 'primary' ? 'Ya tienes un objetivo principal. Para poner este como principal, pausa el actual (su progreso se conserva).' : 'Ya tienes 3 objetivos activos. Para agregar este, pausa uno (su progreso se conserva).'}</p>
                <Chips label="Objetivo a pausar" value={pauseId} onChange={setPauseId} options={active.filter((g) => priority === 'secondary' || g.slot === 1).map((g) => ({ value: g.id, label: g.categoryName }))} />
                {errors.pause && <p role="alert" className="text-[13px] font-medium text-[#ffb4a8]">{errors.pause}</p>}
              </div>
            )}
            <FormField label="Fecha que te gustaría cumplirlo (opcional)">
              {(c) => <Input {...c} className={fieldInput} type="date" value={targetDay} min={new Date().toISOString().slice(0, 10)} onChange={(e) => setTargetDay(e.target.value)} />}
            </FormField>
          </section>

          <Button type="button" onClick={submit} disabled={saving} className={cn('min-h-[52px] w-full rounded-2xl text-base font-bold', BTN_FILL)}>{saving ? 'Guardando…' : needsPro && !staff ? 'Enviar a mi kinesiólogo' : 'Crear objetivo'}</Button>
        </>
      )}
    </div>
  );
};

export default GoalNew;
