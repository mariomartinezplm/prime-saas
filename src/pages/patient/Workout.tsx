import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronLeft, Clock, CloudOff, Layers, Play, Plus, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import LoadErrorAlert from '@/components/shared/LoadErrorAlert';
import { CardsSkeleton, PageSkeleton } from '@/components/shared/Skeletons';
import RestBar from '@/components/workout/RestBar';
import ExercisePickSheet, { type PickedExercise } from '@/components/workout/ExercisePickSheet';
import PlanBlockCard from '@/components/workout/PlanBlockCard';
import SessionPlanner, { type PlanCounts } from '@/components/workout/SessionPlanner';
import WorkoutFinished from '@/components/workout/WorkoutFinished';
import { REST_DONE_TONES, playTones, unlockAudio } from '@/lib/sound';
import { BTN_FILL, EYEBROW_SOFT } from '@/components/dashboard/brand';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkout } from '@/hooks/useWorkout';
import { useWorkoutPlan } from '@/hooks/useWorkoutPlan';
import { elapsedSec, formatClock, restDisplayState, spokenDuration } from '@/lib/workoutClock';
import { listPending, batchSize } from '@/lib/pendingSets';
import { KIND_TITLE, blockSignature, hasUnsaved, newBlock, newGroup, planFromCounts, type DraftBlock, type DraftSlot } from '@/lib/workoutPlan';
import type { BlockKind, WorkoutSummary } from '@/services/workoutService';
import { showApiError } from '@/lib/apiError';
import { notify } from '@/lib/notify';
import { cn } from '@/lib/utils';

const newId = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `w-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`);
const clock = (iso: string) => new Intl.DateTimeFormat('es-CL', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Santiago' }).format(new Date(iso));
const dateText = (iso: string) => new Intl.DateTimeFormat('es-CL', { day: 'numeric', month: 'short' }).format(new Date(iso));

// Entrenamiento en curso: cronómetro sin límite, descanso persistente y registro de ejercicios (individual, superserie, triserie).
// Es un registro personal: no cambia tu cita, tu plan ni los cupos del centro.
const Workout = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const w = useWorkout();
  const { session, startable, now, offsetMs } = w;
  const plan = useWorkoutPlan(user?.id ?? '', session);
  const [confirming, setConfirming] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const [customValue, setCustomValue] = useState('');
  const [finished, setFinished] = useState<WorkoutSummary | null>(null);
  const [counts, setCounts] = useState<PlanCounts>({ single: 1, super: 0, tri: 0 });
  const [picking, setPicking] = useState<{ blockId: string; slotIndex: number } | null>(null);
  const [hints, setHints] = useState<Record<string, string | undefined>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [removing, setRemoving] = useState<DraftBlock | null>(null);
  const [adding, setAdding] = useState(false);
  const startKey = useRef(newId()); // el mismo inicio, si se reintenta, no crea otra sesión
  const announcedDone = useRef<string | null>(null);

  const elapsed = session ? elapsedSec(session.startedAt, now, offsetMs) : 0;
  const rest = session?.rest;
  const display = rest ? restDisplayState(rest, now, offsetMs) : 'idle';

  // Para que el cronómetro se quede arriba al bajar, el contenedor de la página no puede ser un área con su propio desplazamiento
  // (con `overflow: auto` el `sticky` se pega a ese contenedor, que no se mueve, y el cronómetro se iría con la página)
  useEffect(() => {
    const main = document.getElementById('contenido');
    if (!main) return undefined;
    const previous = main.style.overflow;
    main.style.overflow = 'visible';
    return () => {
      main.style.overflow = previous;
    };
  }, []);

  // El teléfono solo deja sonar el audio después de un toque: cada toque en la pantalla lo deja listo
  useEffect(() => {
    const unlock = () => unlockAudio();
    window.addEventListener('pointerdown', unlock, { passive: true });
    return () => window.removeEventListener('pointerdown', unlock);
  }, []);

  // Al terminar el descanso con la app abierta: tres pitidos y vibración. Solo suena si se VIO correr el descanso hasta el final
  // (abrir la app con un descanso que ya había terminado no hace ruido).
  const prevDisplay = useRef(display);
  useEffect(() => {
    const was = prevDisplay.current;
    prevDisplay.current = display;
    if (!session || !rest || display !== 'done' || was !== 'running') return;
    const key = `${session.id}:${rest.version}`;
    if (announcedDone.current === key) return;
    announcedDone.current = key;
    if (document.visibilityState === 'visible') playTones(REST_DONE_TONES, { vibrate: !!navigator.userActivation?.hasBeenActive });
  }, [session, rest, display]);

  const guard = async (fn: () => Promise<unknown>, fallback: string) => {
    try {
      return await fn();
    } catch (err) {
      if ((err as Error)?.message === 'busy') return undefined;
      showApiError(err, fallback);
      return undefined;
    }
  };
  const act = (action: Parameters<typeof w.rest>[1], seconds?: number) => session && guard(() => w.rest(session, action, seconds), 'No se pudo actualizar el descanso');

  const doStart = () => startable && guard(() => w.start(startable.appointmentId, startKey.current), 'No se pudo iniciar tu entrenamiento');

  const serverBlockIds = useMemo(() => new Set((session?.blocks ?? []).map((b) => b.blockId)), [session?.blocks]);
  const pendingIds = useMemo(() => new Set(w.pending.filter((b) => b.replace).map((b) => b.blockId)), [w.pending]);
  const unsaved = plan.blocks.filter(hasUnsaved);

  const createPlan = () => {
    plan.setBlocks((prev) => [...prev, ...planFromCounts(counts)]);
  };
  const addOne = (kind: BlockKind) => {
    plan.setBlocks((prev) => [...prev, newBlock(kind)]);
    setAdding(false);
  };

  const onPicked = (picked: PickedExercise) => {
    if (!picking) return;
    const { blockId, slotIndex } = picking;
    plan.updateBlock(blockId, (b) => ({
      ...b,
      slots: b.slots.map((sl, i): DraftSlot => (i === slotIndex ? { name: picked.name, modality: picked.modality, groups: [newGroup(picked.modality, picked.reference)] } : sl)),
    }));
    const ref = picked.reference;
    if (ref) {
      const parts = [ref.reps ? `${ref.reps} rep` : null, ref.durationSec ? `${ref.durationSec} s` : null, ref.weight ? `${String(ref.weight).replace('.', ',')} ${ref.weightUnit ?? 'kg'}` : null].filter(Boolean);
      setHints((prev) => ({ ...prev, [picked.name]: `Última vez (${dateText(ref.date)})${parts.length ? ` · ${parts.join(' · ')}` : ''}` }));
    } else {
      setHints((prev) => ({ ...prev, [picked.name]: picked.existing ? undefined : 'Ejercicio nuevo' }));
    }
    setPicking(null);
  };

  const saveBlock = async (block: DraftBlock) => {
    if (!session) return;
    setSavingId(block.blockId);
    setErrors((prev) => ({ ...prev, [block.blockId]: undefined }));
    const signature = blockSignature(block);
    try {
      const result = await w.saveBlock(session, block);
      plan.updateBlock(block.blockId, (b) => ({ ...b, savedSig: signature }));
      if (result === 'saved') notify.success('Bloque guardado');
    } catch (err) {
      if ((err as Error)?.message === 'busy') return;
      setErrors((prev) => ({ ...prev, [block.blockId]: (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'No se pudo guardar. Revisa los datos e inténtalo de nuevo.' }));
    } finally {
      setSavingId(null);
    }
  };

  const removeBlock = async (block: DraftBlock) => {
    if (!session) return;
    if (serverBlockIds.has(block.blockId)) {
      const done = await guard(() => w.removeBlock(session, block.blockId), 'No se pudo quitar el bloque');
      if (!done) return;
    }
    plan.setBlocks((prev) => prev.filter((b) => b.blockId !== block.blockId));
    setRemoving(null);
  };

  const doFinish = async () => {
    if (!session) return;
    // Lo pendiente de envío se intenta una última vez: finalizar no debe perder series
    if (w.pending.length > 0) {
      await w.flushPending();
      if ((await listPending(session.id, user?.id)).length > 0) {
        notify.error('Todavía hay series sin enviar. Reconéctate para no perderlas.');
        setConfirming(false);
        return;
      }
    }
    const result = await guard(() => w.finish(session), 'No se pudo finalizar tu entrenamiento');
    if (result && (result as { summary?: WorkoutSummary }).summary) {
      plan.clear();
      setConfirming(false);
      setFinished((result as { summary: WorkoutSummary }).summary);
    }
  };

  const custom = Number.parseInt(customValue, 10);
  const customValid = Number.isInteger(custom) && custom >= 5 && custom <= 1800;
  const spoken = useMemo(() => spokenDuration(elapsed), [elapsed]);
  const totalSets = session?.sets.length ?? 0;
  const pendingSets = w.pending.reduce((n, b) => n + batchSize(b), 0);

  if (finished) return <WorkoutFinished summary={finished} firstName={user?.firstName} onHome={() => navigate('/app/dashboard')} />;

  if (w.status === 'loading') {
    return (
      <PageSkeleton label="Cargando tu entrenamiento…">
        <CardsSkeleton count={1} bodyHeight="h-28" />
      </PageSkeleton>
    );
  }
  if (w.status === 'error') return <LoadErrorAlert message="No se pudo cargar tu entrenamiento." onRetry={w.reload} />;

  // Sin sesión: se puede iniciar (si corresponde) o se vuelve al inicio
  if (!session) {
    return (
      <div className="mx-auto w-full max-w-md space-y-5">
        {w.closedStale && <p className="rounded-2xl border border-[#398ca2]/35 bg-[#398ca2]/10 px-4 py-3 text-sm text-[#cdc6b6]">Tu entrenamiento anterior se cerró solo porque pasaron varias horas sin actividad.</p>}
        <header className="space-y-1.5 pt-2">
          <p className={EYEBROW_SOFT}>Entrenamiento</p>
          <h1 className="text-[1.75rem] font-extrabold leading-[1.1] tracking-tight text-[#fff8e4]">{startable ? (startable.phase === 'soon' ? 'Tu sesión está por comenzar' : 'Tu sesión está en curso') : 'No hay un entrenamiento para iniciar'}</h1>
          <p className="text-[15px] text-[#cdc6b6]">{startable ? `Cita de ${startable.startTime} a ${startable.endTime}. Tu cronómetro empieza cuando tú lo inicias.` : 'Podrás iniciarlo desde media hora antes de tu próxima cita de entrenamiento.'}</p>
        </header>
        {startable && (
          <Button disabled={w.busy} onClick={doStart} className={cn('min-h-[56px] w-full rounded-2xl text-base font-bold', BTN_FILL)}>
            <Play aria-hidden="true" />
            Iniciar entrenamiento
          </Button>
        )}
        <Button asChild variant="outline" className="min-h-[48px] w-full rounded-2xl border-[#398ca2] bg-transparent text-[#fff8e4] hover:bg-[#398ca2]/15 hover:text-[#fff8e4]">
          <Link to="/app/dashboard">Volver al inicio</Link>
        </Button>
      </div>
    );
  }

  const pickingBlock = picking ? plan.blocks.find((b) => b.blockId === picking.blockId) : null;
  const takenNames = pickingBlock ? pickingBlock.slots.filter((_, i) => i !== picking?.slotIndex).map((s) => s.name).filter((n): n is string => !!n) : [];

  return (
    <div className="mx-auto w-full max-w-md space-y-3.5 pb-6">
      <div className="flex items-center justify-between gap-2">
        <Button asChild variant="ghost" size="icon" className="h-11 w-11 rounded-2xl text-[#cdc6b6]" aria-label="Volver al inicio">
          <Link to="/app/dashboard"><ChevronLeft aria-hidden="true" /></Link>
        </Button>
        <p className="flex min-w-0 items-center gap-2 whitespace-nowrap text-[14px] font-bold text-[#fff8e4] min-[380px]:text-[15px]">
          <span className="h-2.5 w-2.5 rounded-full bg-[#62b8cf] shadow-[0_0_0_4px_rgba(98,184,207,0.2)] motion-safe:animate-pulse" aria-hidden="true" />
          Entrenamiento en curso
        </p>
        <button type="button" onClick={() => setConfirming(true)} className="min-h-[44px] shrink-0 rounded-xl px-2.5 text-[14px] font-semibold text-[#cdc6b6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#fff8e4]">Finalizar</button>
      </div>

      {/* Cronómetro y descanso: se quedan arriba mientras se baja y se sube por los bloques */}
      <div data-testid="workout-sticky" className="sticky top-0 z-30 -mx-3 space-y-1.5 bg-background/95 px-3 pb-2 pt-1.5 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <section aria-label="Tiempo de sesión" className="flex items-center justify-between gap-3 rounded-[18px] border border-[#62b8cf]/30 bg-[linear-gradient(165deg,rgba(57,140,162,0.22),#1f1c21_60%)] px-3.5 py-2">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 whitespace-nowrap text-[10.5px] font-bold uppercase tracking-[0.16em] text-[#8fd0e0]"><Clock className="h-3.5 w-3.5" aria-hidden="true" /> Tiempo de sesión</p>
            <p className="text-[11.5px] text-[#a8a295]">Desde las <span className="font-bold tabular-nums text-[#cdc6b6]">{clock(session.startedAt)}</span></p>
          </div>
          <p className="text-[2rem] font-extrabold leading-none tracking-[-0.04em] tabular-nums text-[#fff8e4]" role="timer" aria-label={`Tiempo de sesión: ${spoken}`}>{formatClock(elapsed, { alwaysHours: true })}</p>
        </section>
        {rest && <RestBar rest={rest} now={now} offsetMs={offsetMs} busy={w.busy} onAction={act} onCustom={() => setCustomOpen(true)} />}
      </div>

      {w.pending.length > 0 && (
        <div role="status" className="flex items-center gap-3 rounded-2xl border border-[#e8b4a0]/55 bg-[#e8b4a0]/10 p-3">
          <CloudOff className="h-5 w-5 shrink-0 text-[#e8b4a0]" aria-hidden="true" />
          <p className="min-w-0 flex-1 text-[13px] text-[#fff8e4]"><span className="font-bold">Guardado pendiente.</span> {pendingSets} {pendingSets === 1 ? 'serie está' : 'series están'} a salvo en este dispositivo y se enviarán al volver la conexión.</p>
          <button type="button" onClick={() => w.flushPending()} className="flex min-h-[44px] items-center gap-1.5 rounded-xl px-2 text-[13px] font-bold text-[#8fd0e0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#fff8e4]"><RefreshCw className="h-4 w-4" aria-hidden="true" /> Reintentar</button>
        </div>
      )}

      {plan.blocks.length === 0 ? (
        <SessionPlanner counts={counts} busy={w.busy} onChange={setCounts} onCreate={createPlan} />
      ) : (
        <>
          <div className="space-y-3.5">
            {plan.blocks.map((block, i) => (
              <PlanBlockCard
                key={block.blockId}
                block={block}
                index={i + 1}
                pending={pendingIds.has(block.blockId)}
                saving={savingId === block.blockId}
                disabled={w.busy && savingId !== block.blockId}
                error={errors[block.blockId] ?? null}
                restSec={session.rest.nextDurationSec}
                hints={hints}
                onServer={serverBlockIds.has(block.blockId)}
                onChange={(next) => plan.updateBlock(block.blockId, () => next)}
                onPick={(slotIndex) => setPicking({ blockId: block.blockId, slotIndex })}
                onSave={() => saveBlock(block)}
                onRest={() => act('start')}
                onRemove={() => (serverBlockIds.has(block.blockId) ? setRemoving(block) : removeBlock(block))}
              />
            ))}
          </div>

          <div>
            {adding ? (
              <div role="group" aria-label="Agregar bloque" className="grid grid-cols-3 gap-2">
                {(['single', 'super', 'tri'] as const).map((kind) => (
                  <button key={kind} type="button" onClick={() => addOne(kind)} className="flex min-h-[56px] flex-col items-center justify-center rounded-2xl border border-[#62b8cf]/50 bg-[#398ca2]/12 px-1 text-[13px] font-bold text-[#fff8e4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#fff8e4]">
                    <span className="text-[#8fd0e0]">+ {KIND_TITLE[kind]}</span>
                  </button>
                ))}
              </div>
            ) : (
              <button type="button" onClick={() => setAdding(true)} className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-[#62b8cf]/60 text-[14.5px] font-semibold text-[#8fd0e0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#fff8e4]">
                <Plus className="h-4 w-4" aria-hidden="true" />
                Agregar otro bloque
              </button>
            )}
          </div>
        </>
      )}

      <section aria-label="Sesión de hoy" className="flex items-center gap-3 rounded-[18px] border border-[#fff8e4]/10 bg-[#fff8e4]/[0.03] px-4 py-3">
        <Layers className="h-5 w-5 shrink-0 text-[#8fd0e0]" aria-hidden="true" />
        <p className="text-[13.5px] text-[#cdc6b6]">
          <span className="font-bold text-[#fff8e4]">Sesión de hoy</span> · {plan.blocks.length} {plan.blocks.length === 1 ? 'bloque' : 'bloques'} · {totalSets} {totalSets === 1 ? 'serie guardada' : 'series guardadas'}
        </p>
      </section>

      <ExercisePickSheet
        open={!!picking}
        onOpenChange={(open) => !open && setPicking(null)}
        title={picking && pickingBlock ? `Elegir ejercicio · ${KIND_TITLE[pickingBlock.kind]} ${plan.blocks.indexOf(pickingBlock) + 1}${pickingBlock.kind !== 'single' ? `.${picking.slotIndex + 1}` : ''}` : 'Elegir ejercicio'}
        taken={takenNames}
        onPick={onPicked}
      />

      <Dialog open={!!removing} onOpenChange={(open) => !open && setRemoving(null)}>
        <DialogContent className="max-w-sm border-[#fff8e4]/15 bg-[#1f1c21] text-[#fff8e4]">
          <DialogHeader>
            <DialogTitle>¿Quitar este bloque?</DialogTitle>
            <DialogDescription className="text-[#cdc6b6]">Se borran también las series que ya guardaste en él. Esto no se puede deshacer.</DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:flex-col sm:space-x-0">
            <Button disabled={w.busy} onClick={() => removing && removeBlock(removing)} className="min-h-[48px] w-full rounded-2xl bg-[#e8b4a0] font-bold text-[#181619] hover:bg-[#e8b4a0]/90">Quitar bloque</Button>
            <Button variant="outline" onClick={() => setRemoving(null)} className="min-h-[48px] w-full rounded-2xl border-[#398ca2] bg-transparent text-[#fff8e4] hover:bg-[#398ca2]/15 hover:text-[#fff8e4]">Conservarlo</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent className="max-w-sm border-[#fff8e4]/15 bg-[#1f1c21] text-[#fff8e4]">
          <DialogHeader>
            <DialogTitle>¿Finalizar entrenamiento?</DialogTitle>
            <DialogDescription className="text-[#cdc6b6]">
              Llevas {formatClock(elapsed, { alwaysHours: true })} y {totalSets} {totalSets === 1 ? 'serie guardada' : 'series guardadas'}. Se detendrá el cronómetro y el descanso. Tu cita no cambia.
              {w.pending.length > 0 && ' Tienes series sin enviar: intentaremos enviarlas antes de cerrar.'}
            </DialogDescription>
          </DialogHeader>
          {unsaved.length > 0 && (
            <p role="alert" className="rounded-xl border border-[#e8b4a0]/55 bg-[#e8b4a0]/10 p-3 text-[13.5px] text-[#fff8e4]">
              <span className="font-bold">Tienes {unsaved.length} {unsaved.length === 1 ? 'bloque' : 'bloques'} sin guardar</span> (no quedarán en tu historial): {unsaved.map((b) => `${KIND_TITLE[b.kind]} ${plan.blocks.indexOf(b) + 1}`).join(', ')}.
            </p>
          )}
          <DialogFooter className="flex-col gap-2 sm:flex-col sm:space-x-0">
            <Button disabled={w.busy} onClick={doFinish} className={cn('min-h-[48px] w-full rounded-2xl font-bold', BTN_FILL)}>{unsaved.length > 0 ? 'Finalizar igual' : 'Finalizar'}</Button>
            <Button variant="outline" onClick={() => setConfirming(false)} className="min-h-[48px] w-full rounded-2xl border-[#398ca2] bg-transparent text-[#fff8e4] hover:bg-[#398ca2]/15 hover:text-[#fff8e4]">Seguir entrenando</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={customOpen} onOpenChange={setCustomOpen}>
        <DialogContent className="max-w-sm border-[#fff8e4]/15 bg-[#1f1c21] text-[#fff8e4]">
          <DialogHeader>
            <DialogTitle>Otro tiempo de descanso</DialogTitle>
            <DialogDescription className="text-[#cdc6b6]">Entre 5 y 1800 segundos. Se usará en el próximo descanso.</DialogDescription>
          </DialogHeader>
          <label className="block text-sm text-[#cdc6b6]">
            Segundos
            <input inputMode="numeric" pattern="[0-9]*" value={customValue} onChange={(e) => setCustomValue(e.target.value.replace(/\D/g, '').slice(0, 4))} className="mt-1 h-12 w-full rounded-xl border border-[#62b8cf] bg-[#181619] px-3 text-lg font-bold text-[#fff8e4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#fff8e4]" />
          </label>
          <DialogFooter>
            <Button
              disabled={!customValid || w.busy}
              onClick={async () => {
                await act('set_next', custom);
                setCustomOpen(false);
                setCustomValue('');
                notify.success('Próximo descanso guardado');
              }}
              className={cn('min-h-[48px] w-full rounded-2xl font-bold', BTN_FILL)}
            >
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Workout;
