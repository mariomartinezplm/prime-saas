import { formatClock } from '@/lib/workoutClock';

interface RestRingProps {
  fraction: number; // 0..1 lo que queda
  seconds: number;
  label: string; // DESCANSO · EN PAUSA · TERMINADO
  hint?: string;
  done?: boolean;
}

// Anillo del descanso: turquesa sobre pista oscura (nunca blanco). El número grande es el protagonista y el estado va en
// texto, no solo en color. Sin transición cuando el usuario pide menos movimiento.
const RestRing = ({ fraction, seconds, label, hint, done }: RestRingProps) => {
  const radius = 104;
  const circumference = 2 * Math.PI * radius;
  return (
    <div className="relative mx-auto h-[236px] w-[236px]" role="timer" aria-label={`${label}: ${formatClock(seconds)}`}>
      <svg viewBox="0 0 236 236" className="h-full w-full -rotate-90" aria-hidden="true">
        <circle cx="118" cy="118" r={radius} fill="none" stroke="rgba(255,248,228,0.08)" strokeWidth="12" />
        <circle
          cx="118"
          cy="118"
          r={radius}
          fill="none"
          stroke={done ? '#8fd0e0' : '#62b8cf'}
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - Math.max(0, Math.min(1, fraction)))}
          className="transition-[stroke-dashoffset] duration-500 motion-reduce:transition-none"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-[11.5px] font-bold uppercase tracking-[0.14em] text-[#8fd0e0]">{label}</span>
        <span className="text-[4rem] font-extrabold leading-[1.05] tracking-[-0.04em] tabular-nums text-[#fff8e4]">{formatClock(seconds)}</span>
        {hint && <span className="max-w-[150px] text-[13px] text-[#cdc6b6]">{hint}</span>}
      </div>
    </div>
  );
};

export default RestRing;
