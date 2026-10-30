import { useState } from 'react';
import { ChevronUp, FastForward, Pause, Play, Timer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import BottomSheet from '@/components/premium/BottomSheet';
import RestRing from './RestRing';
import { BTN_FILL } from '@/components/dashboard/brand';
import { formatClock, restDisplayState, restFraction, restRemainingSec, type RestState } from '@/lib/workoutClock';
import type { RestAction } from '@/services/workoutService';
import { cn } from '@/lib/utils';

const PRESETS = [30, 60, 90, 120, 150, 180];
// 30 → «30 s», 90 → «1:30», 150 → «2:30»
const presetLabel = (s: number) => (s < 60 ? `${s} s` : formatClock(s));

interface RestBarProps {
  rest: RestState;
  now: number;
  offsetMs: number;
  busy: boolean;
  onAction: (action: RestAction, seconds?: number) => void;
  onCustom: () => void;
}

const Round = ({ label, onClick, disabled, children, big }: { label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode; big?: boolean }) => (
  <button type="button" onClick={onClick} disabled={disabled} className="flex min-h-[44px] flex-col items-center gap-1.5 text-[13px] text-[#cdc6b6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#fff8e4] disabled:opacity-50">
    <span className={cn('flex items-center justify-center rounded-full border border-[#62b8cf]/35 bg-[#1f1c21] font-extrabold text-[#8fd0e0] shadow-[inset_0_1px_0_rgba(255,248,228,0.06)] transition-transform active:scale-95', big ? 'h-[66px] w-[66px]' : 'h-[60px] w-[60px]')}>{children}</span>
    {label}
  </button>
);

// Descanso en una barra compacta (para registrar series sin desplazarse). Al tocarla se abre el temporizador grande con todos los controles.
const RestBar = ({ rest, now, offsetMs, busy, onAction, onCustom }: RestBarProps) => {
  const [open, setOpen] = useState(false);
  const display = restDisplayState(rest, now, offsetMs);
  const remaining = restRemainingSec(rest, now, offsetMs);
  const running = display === 'running';
  const paused = display === 'paused';
  const done = display === 'done';
  const fraction = running || paused ? restFraction(rest, now, offsetMs) : done ? 0 : 1;
  const label = running ? 'DESCANSO' : paused ? 'EN PAUSA' : done ? 'TERMINADO' : 'DESCANSO';
  const seconds = display === 'idle' ? rest.nextDurationSec : remaining;

  return (
    <>
      <div className={cn('flex items-center gap-2 rounded-[22px] border p-1.5 pl-3 transition-colors', done ? 'border-[#8fd0e0]/70 bg-[#398ca2]/20' : running || paused ? 'border-[#62b8cf]/45 bg-[#398ca2]/12' : 'border-[#fff8e4]/12 bg-[#fff8e4]/[0.04]')}>
        <button type="button" onClick={() => setOpen(true)} aria-label={`${label}: ${formatClock(seconds)}. Abrir el temporizador`} className="flex min-h-[48px] min-w-0 flex-1 items-center gap-3 rounded-2xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#fff8e4]">
          <span className="relative flex h-9 w-9 shrink-0 items-center justify-center" aria-hidden="true">
            <svg viewBox="0 0 36 36" className="h-9 w-9 -rotate-90">
              <circle cx="18" cy="18" r="15" fill="none" stroke="rgba(255,248,228,0.1)" strokeWidth="3.5" />
              <circle cx="18" cy="18" r="15" fill="none" stroke="#62b8cf" strokeWidth="3.5" strokeLinecap="round" strokeDasharray={2 * Math.PI * 15} strokeDashoffset={2 * Math.PI * 15 * (1 - fraction)} className="transition-[stroke-dashoffset] duration-500 motion-reduce:transition-none" />
            </svg>
            <Timer className="absolute h-3.5 w-3.5 text-[#8fd0e0]" />
          </span>
          <span className="min-w-0">
            <span className="block text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#8fd0e0]">{label}</span>
            <span className="block text-[1.5rem] font-extrabold leading-none tracking-[-0.03em] tabular-nums text-[#fff8e4]">{formatClock(seconds)}</span>
          </span>
          <ChevronUp className="ml-auto h-4 w-4 shrink-0 text-[#a8a295]" aria-hidden="true" />
        </button>
        {(running || paused) && (
          <>
            <button type="button" disabled={busy} onClick={() => onAction(running ? 'pause' : 'resume')} aria-label={running ? 'Pausar descanso' : 'Reanudar descanso'} className="flex h-12 w-12 items-center justify-center rounded-full border border-[#62b8cf]/35 text-[#8fd0e0] active:bg-[#62b8cf]/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#fff8e4]">
              {running ? <Pause className="h-5 w-5" aria-hidden="true" /> : <Play className="h-5 w-5" aria-hidden="true" />}
            </button>
            <button type="button" disabled={busy} onClick={() => onAction('skip')} aria-label="Omitir descanso" className="mr-0.5 flex h-12 w-12 items-center justify-center rounded-full border border-[#62b8cf]/35 text-[#8fd0e0] active:bg-[#62b8cf]/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#fff8e4]">
              <FastForward className="h-5 w-5" aria-hidden="true" />
            </button>
          </>
        )}
        {(display === 'idle' || done) && (
          <Button disabled={busy} onClick={() => onAction('start')} className={cn('mr-0.5 h-12 rounded-full px-5 text-sm font-bold', BTN_FILL)}>
            <Play aria-hidden="true" />
            Descansar
          </Button>
        )}
      </div>
      <p className="sr-only" aria-live="polite">{done ? 'Descanso terminado' : ''}</p>

      <BottomSheet open={open} onOpenChange={setOpen} title="Descanso" description="Sigue contando aunque salgas de la app">
        <div className="space-y-5 pb-2 pt-2">
          <RestRing fraction={fraction} seconds={seconds} label={label} done={done} hint={display === 'idle' ? 'Elige cuánto y empieza' : done ? 'Ya puedes seguir' : undefined} />
          {(running || paused) && (
            <div className="grid grid-cols-3 gap-2 text-center">
              <Round label={running ? 'Pausar' : 'Reanudar'} disabled={busy} onClick={() => onAction(running ? 'pause' : 'resume')} big>
                {running ? <Pause className="h-6 w-6" aria-hidden="true" /> : <Play className="h-6 w-6" aria-hidden="true" />}
              </Round>
              <Round label="Sumar 15 s" disabled={busy} onClick={() => onAction('add')}>+15</Round>
              <Round label="Omitir descanso" disabled={busy} onClick={() => onAction('skip')}>
                <FastForward className="h-6 w-6" aria-hidden="true" />
              </Round>
            </div>
          )}
          {(display === 'idle' || done) && (
            <Button disabled={busy} onClick={() => onAction('start')} className={cn('min-h-[52px] w-full rounded-2xl text-base font-bold', BTN_FILL)}>
              <Play aria-hidden="true" />
              Iniciar descanso de {formatClock(rest.nextDurationSec)}
            </Button>
          )}
          <div className="rounded-2xl border border-[#fff8e4]/10 bg-[#181619]/60 p-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-bold text-[#fff8e4]">Próximo descanso</p>
              <button type="button" onClick={() => { setOpen(false); onCustom(); }} className="min-h-[44px] text-xs text-[#8fd0e0] underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#fff8e4]">Otro tiempo</button>
            </div>
            <div role="group" aria-label="Duración del próximo descanso" className="mt-1 grid grid-cols-3 overflow-hidden rounded-[14px] border border-[#fff8e4]/20 bg-[#1f1c21] min-[400px]:grid-cols-6">
              {PRESETS.map((s) => (
                <button key={s} type="button" disabled={busy} aria-pressed={rest.nextDurationSec === s} onClick={() => onAction('set_next', s)} className={cn('min-h-[44px] px-2 text-[13.5px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#fff8e4]', rest.nextDurationSec === s ? 'bg-[#398ca2] font-extrabold text-[#181619]' : 'text-[#cdc6b6]')}>
                  {presetLabel(s)}
                </button>
              ))}
            </div>
          </div>
          {(running || paused) && <p className="text-center text-xs text-[#a8a295]">Cambiar el próximo descanso no altera el que está corriendo.</p>}
        </div>
      </BottomSheet>
    </>
  );
};

export default RestBar;
