import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useWorkout } from '@/hooks/useWorkout';
import { BTN_FILL, HERO_SURFACE, PILL_SOLID } from '@/components/dashboard/brand';
import { elapsedSec, formatClock } from '@/lib/workoutClock';
import { showApiError } from '@/lib/apiError';
import { cn } from '@/lib/utils';

const newClientId = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `w-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`);

// Entrada al entrenamiento en curso desde Inicio. Solo aparece si hay una sesión activa o una cita de entrenamiento dentro de
// la ventana permitida (desde 30 min antes). Estar dentro del horario NO inicia nada: el entrenamiento empieza al pulsar el botón.
const WorkoutEntryCard = () => {
  const w = useWorkout();
  const navigate = useNavigate();
  const [key] = useState(newClientId);

  if (w.status !== 'ready') return null;

  if (w.session) {
    return (
      <section aria-labelledby="entreno-titulo" className={cn('space-y-3 rounded-[22px] border p-4', HERO_SURFACE)}>
        <p className="flex items-center gap-2">
          <span className={PILL_SOLID}>En curso</span>
        </p>
        <h2 id="entreno-titulo" className="text-xl font-bold tracking-tight text-[#fff8e4]">Tu entrenamiento está en curso</h2>
        <p className="text-[2rem] font-extrabold leading-none tracking-[-0.03em] tabular-nums text-[#fff8e4]" aria-label="Tiempo de entrenamiento">{formatClock(elapsedSec(w.session.startedAt, w.now, w.offsetMs), { alwaysHours: true })}</p>
        <Button asChild className={cn('min-h-[52px] w-full rounded-2xl text-base font-bold', BTN_FILL)}>
          <Link to="/app/entrenamiento">Volver a mi entrenamiento</Link>
        </Button>
      </section>
    );
  }

  if (!w.startable) return null;
  const soon = w.startable.phase === 'soon';
  return (
    <section aria-labelledby="entreno-titulo" className="space-y-3 rounded-[22px] border border-[#fff8e4]/10 bg-[#fff8e4]/[0.04] p-4">
      <h2 id="entreno-titulo" className="text-xl font-bold tracking-tight text-[#fff8e4]">{soon ? 'Tu sesión está por comenzar' : 'Tu sesión está en curso'}</h2>
      <p className="text-sm text-[#cdc6b6]">Tu cronómetro empieza cuando tú lo inicias.</p>
      <Button
        disabled={w.busy}
        onClick={async () => {
          try {
            await w.start(w.startable!.appointmentId, key);
            navigate('/app/entrenamiento');
          } catch (err) {
            if ((err as Error)?.message !== 'busy') showApiError(err, 'No se pudo iniciar tu entrenamiento');
          }
        }}
        className={cn('min-h-[52px] w-full rounded-2xl text-base font-bold', BTN_FILL)}
      >
        <Play aria-hidden="true" />
        Iniciar entrenamiento
      </Button>
    </section>
  );
};

export default WorkoutEntryCard;
