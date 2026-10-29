import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronLeft, Clock, CloudOff, Dumbbell, Layers, Play, Plus, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import LoadErrorAlert from '@/components/shared/LoadErrorAlert';
import { CardsSkeleton, PageSkeleton } from '@/components/shared/Skeletons';
import RestBar from '@/components/workout/RestBar';
import { REST_DONE_TONES, playTones, unlockAudio } from '@/lib/sound';
import BlockBuilder from '@/components/workout/BlockBuilder';
import BlockCard from '@/components/workout/BlockCard';
import SetEditSheet from '@/components/workout/SetEditSheet';
import WorkoutFinished from '@/components/workout/WorkoutFinished';
import { BTN_FILL, EYEBROW_SOFT, HERO_SURFACE } from '@/components/dashboard/brand';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkout } from '@/hooks/useWorkout';
import { elapsedSec, formatClock, restDisplayState, spokenDuration } from '@/lib/workoutClock';
import { listPending } from '@/lib/pendingSets';
import { workoutService, type BlockKind, type Modality, type SavedSet, type WorkoutSummary } from '@/services/workoutService';
import type { Reference } from '@/lib/workoutDraft';
import { showApiError } from '@/lib/apiError';
import { notify } from '@/lib/notify';
import { cn } from '@/lib/utils';

type Ref = Reference & { weightUnit: 'kg' | 'lbs'; lastDate: string };
const newId = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `w-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`);
const clock = (iso: string) => new Intl.DateTimeFormat('es-CL', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Santiago' }).format(new Date(iso));

const FORMATS: { kind: BlockKind; title: string; hint: string; n: number }[] = [
  { kind: 'single', title: 'Ejercicio individual', hint: 'Un ejercicio, varias series', n: 1 },
  { kind: 'super', title: 'Superserie', hint: 'Dos ejercicios seguidos, luego descanso', n: 2 },
  { kind: 'tri', title: 'Triserie', hint: 'Tres ejercicios seguidos, luego descanso', n: 3 },
];

// Entrenamiento en curso: cronómetro sin límite, descanso persistente y registro de ejercicios (individual, superserie, triserie).
// Es un registro personal: no cambia tu cita, tu plan ni los cupos del centro.
const Workout = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const w = useWorkout();
  const { session, startable, now, offsetMs } = w;
  const [confirming, setConfirming] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const [customValue, setCustomValue] = useState('');
  const [builder, setBuilder] = useState<{ open: boolean; kind: BlockKind | null }>({ open: false, kind: null });
  const [editing, setEditing] = useState<SavedSet | null>(null);
  const [finished, setFinished] = useState<WorkoutSummary | null>(null);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [refs, setRefs] = useState<Record<string, Ref | undefined>>({});
  const asked = useRef(new Set<string>());
  const startKey = useRef(newId()); // el mismo inicio, si se reintenta, no crea otra sesión
  const announcedDone = useRef<string | null>(null);

  const elapsed = session ? elapsedSec(session.startedAt, now, offsetMs) : 0;
  const rest = session?.rest;
  const display = rest ? restDisplayState(rest, now, offsetMs) : 'idle';

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

  const blocks = session?.blocks ?? [];
  const current = blocks.find((b) => b.blockId === currentId) ?? blocks[blocks.length - 1] ?? null;

  // Referencia «última sesión» de cada ejercicio del bloque abierto (del propio historial; no incluye lo de hoy)
  const loadRefs = useCallback(async (names: string[]) => {
    for (const name of names) {
      if (asked.current.has(name)) continue;
      asked.current.add(name);
      try {
        const result = await workoutService.searchExercises(name);
        const hit = result.matches.find((m) => m.name.toLowerCase() === name.toLowerCase());
        setRefs((prev) => ({ ...prev, [name]: hit?.refDate ? { reps: hit.last.reps, weight: hit.last.weight, durationSec: hit.last.durationSec, weightUnit: hit.last.weightUnit, lastDate: hit.refDate } : undefined }));
      } catch {
        asked.current.delete(name); // sin conexión: se vuelve a intentar al reabrir el bloque
      }
    }
  }, []);
  useEffect(() => {
    if (current) loadRefs(current.slots.map((s) => s.exerciseName));
  }, [current, loadRefs]);

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

  const createBlock = async (kind: BlockKind, slots: { exerciseName: string; modality: Modality }[]) => {
    if (!session) return;
    const blockId = newId();
    const done = await guard(() => w.addBlock(session, { blockId, kind, slots }), 'No se pudo agregar el bloque');
    if (done) {
      setCurrentId(blockId);
      setBuilder({ open: false, kind: null });
    }
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
      setConfirming(false);
      setFinished((result as { summary: WorkoutSummary }).summary);
    }
  };

  const custom = Number.parseInt(customValue, 10);
  const customValid = Number.isInteger(custom) && custom >= 5 && custom <= 1800;
  const spoken = useMemo(() => spokenDuration(elapsed), [elapsed]);
  const totalSets = session?.sets.length ?? 0;
  const exerciseCount = new Set((session?.sets ?? []).map((s) => s.exerciseName.toLowerCase())).size;

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

  const nextLabel = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[blocks.length] ?? 'Z';
  const pendingFor = (blockId: string) => w.pending.filter((b) => b.blockId === blockId).flatMap((b) => b.display);

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

      <section aria-label="Tiempo de sesión" className={cn('relative overflow-hidden rounded-[24px] border px-4 py-3.5', HERO_SURFACE)}>
        <div className="flex items-center justify-between gap-3">
          <p className="flex items-center gap-1.5 whitespace-nowrap text-[11.5px] font-bold uppercase tracking-[0.16em] text-[#8fd0e0]"><Clock className="h-3.5 w-3.5" aria-hidden="true" /> Tiempo de sesión</p>
          <p className="text-[12px] text-[#cdc6b6]">Empezaste a las <span className="font-bold tabular-nums text-[#fff8e4]">{clock(session.startedAt)}</span></p>
        </div>
        <p className="mt-1.5 text-[3rem] font-extrabold leading-none tracking-[-0.045em] tabular-nums text-[#fff8e4]" role="timer" aria-label={`Tiempo de sesión: ${spoken}`}>{formatClock(elapsed, { alwaysHours: true })}</p>
        <p className="mt-1.5 text-[12px] text-[#a8a295]">Sigue contando aunque salgas de la app. No se detiene a la hora de tu cita.</p>
      </section>

      {rest && <RestBar rest={rest} now={now} offsetMs={offsetMs} busy={w.busy} onAction={act} onCustom={() => setCustomOpen(true)} />}

      {w.pending.length > 0 && (
        <div role="status" className="flex items-center gap-3 rounded-2xl border border-[#e8b4a0]/55 bg-[#e8b4a0]/10 p-3">
          <CloudOff className="h-5 w-5 shrink-0 text-[#e8b4a0]" aria-hidden="true" />
          <p className="min-w-0 flex-1 text-[13px] text-[#fff8e4]"><span className="font-bold">Guardado pendiente.</span> {w.pending.reduce((n, b) => n + b.sets.length, 0)} {w.pending.reduce((n, b) => n + b.sets.length, 0) === 1 ? 'serie está' : 'series están'} a salvo en este dispositivo y se enviarán al volver la conexión.</p>
          <button type="button" onClick={() => w.flushPending()} className="flex min-h-[44px] items-center gap-1.5 rounded-xl px-2 text-[13px] font-bold text-[#8fd0e0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#fff8e4]"><RefreshCw className="h-4 w-4" aria-hidden="true" /> Reintentar</button>
        </div>
      )}

      {blocks.length === 0 ? (
        <section aria-labelledby="vacio-titulo" className="rounded-[24px] border border-[#fff8e4]/10 bg-[linear-gradient(180deg,#272329,#1f1c21)] p-4">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#62b8cf]/35 bg-[#398ca2]/15 text-[#8fd0e0]"><Dumbbell className="h-5 w-5" aria-hidden="true" /></span>
            <div>
              <h2 id="vacio-titulo" className="text-lg font-extrabold tracking-tight text-[#fff8e4]">¿Con qué empiezas?</h2>
              <p className="text-[13px] text-[#a8a295]">Elige el formato que te indique tu profesional.</p>
            </div>
          </div>
          <div className="mt-3 grid gap-2">
            {FORMATS.map((f) => (
              <button key={f.kind} type="button" onClick={() => setBuilder({ open: true, kind: f.kind })} className="flex min-h-[64px] items-center gap-3.5 rounded-[18px] border border-[#fff8e4]/15 bg-[#181619]/60 p-3 text-left transition-colors active:border-[#62b8cf] active:bg-[#398ca2]/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#fff8e4]">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] border border-[#62b8cf]/35 bg-[#398ca2]/15 text-lg font-extrabold text-[#8fd0e0]">{f.n}</span>
                <span>
                  <span className="block text-[15.5px] font-bold text-[#fff8e4]">{f.title}</span>
                  <span className="block text-[12.5px] text-[#a8a295]">{f.hint}</span>
                </span>
              </button>
            ))}
          </div>
          <p className="mt-3 text-center text-[12px] text-[#a8a295]">No hay rutinas precargadas: los ejercicios los eliges tú, de tu historial o nuevos.</p>
        </section>
      ) : (
        <>
          <div className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
            <div role="tablist" aria-label="Bloques de la sesión" className="flex gap-2">
            {blocks.map((b) => {
              const active = current?.blockId === b.blockId;
              const count = session.sets.filter((s) => s.blockId === b.blockId).length;
              return (
                <button key={b.blockId} role="tab" aria-selected={active} type="button" onClick={() => setCurrentId(b.blockId)} className={cn('flex min-h-[44px] shrink-0 items-center gap-2 rounded-full border px-3.5 text-[13.5px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#fff8e4]', active ? 'border-[#62b8cf] bg-[#398ca2] text-[#181619]' : 'border-[#fff8e4]/20 bg-[#1f1c21] text-[#cdc6b6]')}>
                  <span className="font-extrabold">{b.label}</span>
                  <span className="max-w-[9rem] truncate">{b.kind === 'single' ? b.slots[0].exerciseName : b.kind === 'super' ? 'Superserie' : 'Triserie'}</span>
                  {count > 0 && <span className={cn('rounded-full px-1.5 text-[11px] font-bold tabular-nums', active ? 'bg-[#181619]/25' : 'bg-[#62b8cf]/20 text-[#8fd0e0]')}>{count}</span>}
                </button>
              );
            })}
            </div>
            <button type="button" onClick={() => setBuilder({ open: true, kind: null })} aria-label="Agregar bloque" className="flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-full border border-dashed border-[#62b8cf]/60 px-3.5 text-[13.5px] font-semibold text-[#8fd0e0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#fff8e4]">
              <Plus className="h-4 w-4" aria-hidden="true" />
              Bloque
            </button>
          </div>
          {current && (
            <BlockCard
              key={current.blockId}
              block={current}
              sets={session.sets.filter((s) => s.blockId === current.blockId)}
              pending={pendingFor(current.blockId)}
              references={refs}
              nextRestSec={session.rest.nextDurationSec}
              onSave={async (blockId, sets, display) => {
                const result = await w.saveBatch(session, blockId, sets, display).catch((err) => {
                  if ((err as Error)?.message !== 'busy') showApiError(err, 'No se pudo guardar la serie');
                  throw err;
                });
                return result;
              }}
              onEdit={setEditing}
              onRest={() => act('start')}
            />
          )}
        </>
      )}

      <section aria-label="Sesión de hoy" className="flex items-center gap-3 rounded-[18px] border border-[#fff8e4]/10 bg-[#fff8e4]/[0.03] px-4 py-3">
        <Layers className="h-5 w-5 shrink-0 text-[#8fd0e0]" aria-hidden="true" />
        <p className="text-[13.5px] text-[#cdc6b6]">
          <span className="font-bold text-[#fff8e4]">Sesión de hoy</span> · {exerciseCount} {exerciseCount === 1 ? 'ejercicio' : 'ejercicios'} · {totalSets} {totalSets === 1 ? 'serie guardada' : 'series guardadas'}
        </p>
      </section>

      <BlockBuilder open={builder.open} onOpenChange={(open) => setBuilder((b) => ({ ...b, open }))} nextLabel={nextLabel} initialKind={builder.kind} busy={w.busy} onCreate={createBlock} />
      <SetEditSheet
        set={editing}
        busy={w.busy}
        onClose={() => setEditing(null)}
        onSave={async (set, values) => {
          const done = await guard(() => w.updateSet(set.id, values), 'No se pudo corregir la serie');
          if (done) {
            notify.success('Serie corregida');
            setEditing(null);
          }
        }}
        onDelete={async (set) => {
          const done = await guard(() => w.deleteSet(set.id), 'No se pudo eliminar la serie');
          if (done) {
            notify.success('Serie eliminada');
            setEditing(null);
          }
        }}
      />

      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent className="max-w-sm border-[#fff8e4]/15 bg-[#1f1c21] text-[#fff8e4]">
          <DialogHeader>
            <DialogTitle>¿Finalizar entrenamiento?</DialogTitle>
            <DialogDescription className="text-[#cdc6b6]">
              Llevas {formatClock(elapsed, { alwaysHours: true })} y {totalSets} {totalSets === 1 ? 'serie guardada' : 'series guardadas'}. Se detendrá el cronómetro y el descanso. Tu cita no cambia.
              {w.pending.length > 0 && ' Tienes series sin enviar: intentaremos enviarlas antes de cerrar.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:flex-col sm:space-x-0">
            <Button disabled={w.busy} onClick={doFinish} className={cn('min-h-[48px] w-full rounded-2xl font-bold', BTN_FILL)}>Finalizar</Button>
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
