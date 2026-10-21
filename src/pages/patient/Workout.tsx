import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronLeft, Clock, FastForward, Pause, Play, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import LoadErrorAlert from '@/components/shared/LoadErrorAlert';
import { CardsSkeleton, PageSkeleton } from '@/components/shared/Skeletons';
import RestRing from '@/components/workout/RestRing';
import { CARD, EYEBROW_SOFT, BTN_FILL, HERO_SURFACE } from '@/components/dashboard/brand';
import { useWorkout } from '@/hooks/useWorkout';
import { elapsedSec, formatClock, restDisplayState, restFraction, restRemainingSec, spokenDuration } from '@/lib/workoutClock';
import { showApiError } from '@/lib/apiError';
import { notify } from '@/lib/notify';
import { cn } from '@/lib/utils';

const PRESETS = [30, 60, 90, 120];
const newClientId = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `w-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`);

// Entrenamiento en curso (Incremento 1): cronómetro de sesión sin límite y descanso con vencimiento persistido.
// Es un registro personal: no cambia tu cita, tu plan ni los cupos del centro.
const Workout = () => {
  const navigate = useNavigate();
  const w = useWorkout();
  const { session, startable, now, offsetMs } = w;
  const [confirming, setConfirming] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const [customValue, setCustomValue] = useState('');
  const [finished, setFinished] = useState<{ durationSec: number } | null>(null);
  const startKey = useRef(newClientId()); // el mismo inicio, si se reintenta, no crea otra sesión
  const announcedDone = useRef<string | null>(null);

  const elapsed = session ? elapsedSec(session.startedAt, now, offsetMs) : 0;
  const rest = session?.rest;
  const display = rest ? restDisplayState(rest, now, offsetMs) : 'idle';
  const remaining = rest ? restRemainingSec(rest, now, offsetMs) : 0;
  const fraction = rest ? (display === 'running' || display === 'paused' ? restFraction(rest, now, offsetMs) : display === 'done' ? 0 : 1) : 1;

  // Aviso discreto al terminar el descanso con la app abierta: vibración corta (donde exista) y el texto cambia a «Terminado»
  useEffect(() => {
    if (!session || !rest || display !== 'done') return;
    const key = `${session.id}:${rest.version}`;
    if (announcedDone.current === key) return;
    announcedDone.current = key;
    // Solo si la persona ya tocó la pantalla (los navegadores bloquean la vibración antes de eso)
    if (document.visibilityState === 'visible' && navigator.userActivation?.hasBeenActive) navigator.vibrate?.(180);
  }, [session, rest, display]);

  const act = async (action: Parameters<typeof w.rest>[1], seconds?: number) => {
    if (!session) return;
    try {
      await w.rest(session, action, seconds);
    } catch (err) {
      if ((err as Error)?.message === 'busy') return;
      showApiError(err, 'No se pudo actualizar el descanso');
    }
  };

  const doStart = async () => {
    if (!startable) return;
    try {
      await w.start(startable.appointmentId, startKey.current);
    } catch (err) {
      if ((err as Error)?.message === 'busy') return;
      showApiError(err, 'No se pudo iniciar tu entrenamiento');
    }
  };

  const doFinish = async () => {
    if (!session) return;
    try {
      const result = await w.finish(session);
      setConfirming(false);
      setFinished(result.summary ?? { durationSec: elapsed });
    } catch (err) {
      if ((err as Error)?.message === 'busy') return;
      showApiError(err, 'No se pudo finalizar tu entrenamiento');
    }
  };

  const custom = Number.parseInt(customValue, 10);
  const customValid = Number.isInteger(custom) && custom >= 5 && custom <= 1800;
  const spoken = useMemo(() => spokenDuration(elapsed), [elapsed]);

  if (finished) {
    return (
      <div className="mx-auto w-full max-w-md space-y-6">
        <div className="space-y-2 pt-6 text-center">
          <p className={EYEBROW_SOFT}>Entrenamiento finalizado</p>
          <h1 className="font-serif text-[2rem] font-medium leading-tight text-[#fff8e4]">Buen trabajo</h1>
          <p className="text-sm text-[#cdc6b6]">Tu sesión quedó guardada.</p>
        </div>
        <div className="text-center">
          <p className={EYEBROW_SOFT}>Duración real</p>
          <p className="mt-2 text-[3.5rem] font-extrabold leading-none tracking-[-0.04em] tabular-nums text-[#fff8e4]" aria-label={spokenDuration(finished.durationSec)}>
            {formatClock(finished.durationSec, { alwaysHours: true })}
          </p>
        </div>
        <p className="rounded-2xl border border-[#398ca2]/35 bg-[#398ca2]/10 px-4 py-3 text-[13px] text-[#cdc6b6]">Es tu registro personal. La asistencia y el descuento de tu sesión los gestiona el centro.</p>
        <Button className={cn('min-h-[52px] w-full rounded-2xl text-base font-bold', BTN_FILL)} onClick={() => navigate('/app/dashboard')}>
          Volver al inicio
        </Button>
      </div>
    );
  }

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
          <p className="text-[15px] text-[#cdc6b6]">
            {startable ? `Cita de ${startable.startTime} a ${startable.endTime}. Tu cronómetro empieza cuando tú lo inicias.` : 'Podrás iniciarlo desde media hora antes de tu próxima cita de entrenamiento.'}
          </p>
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

  const label = display === 'running' ? 'DESCANSO' : display === 'paused' ? 'EN PAUSA' : display === 'done' ? 'TERMINADO' : 'DESCANSO';
  const ringSeconds = display === 'idle' ? rest!.nextDurationSec : remaining;

  return (
    <div className="mx-auto w-full max-w-md space-y-4">
      <div className="flex items-center justify-between">
        <Button asChild variant="ghost" size="icon" className="h-11 w-11 rounded-2xl text-[#cdc6b6]" aria-label="Volver al inicio">
          <Link to="/app/dashboard">
            <ChevronLeft aria-hidden="true" />
          </Link>
        </Button>
        <p className="flex items-center gap-2 text-[15px] font-bold text-[#fff8e4]">
          <span className="h-2.5 w-2.5 rounded-full bg-[#62b8cf] shadow-[0_0_0_4px_rgba(98,184,207,0.2)]" aria-hidden="true" />
          Entrenamiento en curso
        </p>
        <span className="w-11" />
      </div>

      <section aria-label="Tiempo de sesión" className={cn('flex items-center gap-3 rounded-[20px] border px-4 py-3', HERO_SURFACE)}>
        <Clock className="h-5 w-5 shrink-0 text-[#8fd0e0]" aria-hidden="true" />
        <span className="text-[13px] text-[#cdc6b6]">Tiempo de sesión</span>
        <span className="ml-auto text-[1.75rem] font-extrabold tracking-[-0.02em] tabular-nums text-[#fff8e4]" role="timer" aria-label={`Tiempo de sesión: ${spoken}`}>
          {formatClock(elapsed, { alwaysHours: true })}
        </span>
      </section>
      <p className="-mt-2 text-center text-xs text-[#a8a295]">Sigue contando aunque salgas de la app. No se detiene a la hora de tu cita.</p>

      <section aria-label="Descanso" className={cn(CARD, 'space-y-4 p-4')}>
        <RestRing fraction={fraction} seconds={ringSeconds} label={label} done={display === 'done'} hint={display === 'idle' ? 'Elige cuánto y empieza' : display === 'done' ? 'Ya puedes seguir' : undefined} />
        <p className="sr-only" aria-live="polite">{display === 'done' ? 'Descanso terminado' : ''}</p>

        {(display === 'running' || display === 'paused') && (
          <div className="grid grid-cols-3 gap-2 text-center text-[13px] text-[#cdc6b6]">
            <button type="button" disabled={w.busy} onClick={() => act(display === 'running' ? 'pause' : 'resume')} className="flex min-h-[44px] flex-col items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#fff8e4]">
              <span className="flex h-[60px] w-[60px] items-center justify-center rounded-full border border-[#fff8e4]/20 bg-[#1f1c21] text-[#8fd0e0]">{display === 'running' ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}</span>
              {display === 'running' ? 'Pausar' : 'Reanudar'}
            </button>
            <button type="button" disabled={w.busy} onClick={() => act('add')} className="flex min-h-[44px] flex-col items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#fff8e4]">
              <span className="flex h-[60px] w-[60px] items-center justify-center rounded-full border border-[#fff8e4]/20 bg-[#1f1c21] font-extrabold text-[#8fd0e0]">+15</span>
              Sumar 15 s
            </button>
            <button type="button" disabled={w.busy} onClick={() => act('skip')} className="flex min-h-[44px] flex-col items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#fff8e4]">
              <span className="flex h-[60px] w-[60px] items-center justify-center rounded-full border border-[#fff8e4]/20 bg-[#1f1c21] text-[#8fd0e0]"><FastForward aria-hidden="true" /></span>
              Omitir descanso
            </button>
          </div>
        )}

        {(display === 'idle' || display === 'done') && (
          <Button disabled={w.busy} onClick={() => act('start')} className={cn('min-h-[52px] w-full rounded-2xl text-base font-bold', BTN_FILL)}>
            <Play aria-hidden="true" />
            Iniciar descanso de {formatClock(rest!.nextDurationSec)}
          </Button>
        )}

        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-[#fff8e4]">Próximo descanso</p>
            <button type="button" onClick={() => setCustomOpen(true)} className="min-h-[44px] text-xs text-[#8fd0e0] underline underline-offset-4">Otro tiempo</button>
          </div>
          <div role="group" aria-label="Duración del próximo descanso" className="flex overflow-hidden rounded-[14px] border border-[#fff8e4]/20 bg-[#1f1c21]">
            {PRESETS.map((s) => (
              <button key={s} type="button" disabled={w.busy} aria-pressed={rest!.nextDurationSec === s} onClick={() => act('set_next', s)} className={cn('min-h-[44px] min-w-[46px] px-3 text-[13.5px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#fff8e4]', rest!.nextDurationSec === s ? 'bg-[#398ca2] font-extrabold text-[#181619]' : 'text-[#cdc6b6]')}>
                {s}
              </button>
            ))}
          </div>
        </div>
        {(display === 'running' || display === 'paused') && <p className="text-xs text-[#a8a295]">Cambiar el próximo descanso no altera el que está corriendo.</p>}
      </section>

      <section className={cn(CARD, 'flex items-center gap-3 p-4')}>
        <Plus className="h-5 w-5 text-[#8fd0e0]" aria-hidden="true" />
        <p className="text-sm text-[#cdc6b6]">El registro de ejercicios y series llega en el siguiente incremento. Por ahora puedes usar el cronómetro y el descanso.</p>
      </section>

      <Button variant="outline" onClick={() => setConfirming(true)} className="min-h-[50px] w-full rounded-2xl border-[#fff8e4]/25 bg-transparent text-[#cdc6b6] hover:bg-[#fff8e4]/[0.06] hover:text-[#fff8e4]">
        Finalizar entrenamiento
      </Button>

      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent className="max-w-sm border-[#fff8e4]/15 bg-[#1f1c21] text-[#fff8e4]">
          <DialogHeader>
            <DialogTitle>¿Finalizar entrenamiento?</DialogTitle>
            <DialogDescription className="text-[#cdc6b6]">Llevas {formatClock(elapsed, { alwaysHours: true })}. Se detendrá el cronómetro y el descanso. Tu cita no cambia.</DialogDescription>
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
