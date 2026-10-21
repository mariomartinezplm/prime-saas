import { useEffect, useId, useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NumberStepperProps {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
  step?: number;
  min?: number;
  max?: number;
  unit?: string;
  decimals?: boolean; // permite coma/punto decimal (carga)
  invalid?: boolean;
  disabled?: boolean;
  className?: string;
}

const round = (n: number) => Math.round(n * 100) / 100;
const show = (v: number | null) => (v === null ? '' : String(v).replace('.', ','));

// Campo numérico táctil: − y + de 44 px, número grande y teclado numérico del teléfono. También se puede escribir.
const NumberStepper = ({ label, value, onChange, step = 1, min = 0, max = 9999, unit, decimals = false, invalid, disabled, className }: NumberStepperProps) => {
  const id = useId();
  const [text, setText] = useState(show(value));
  // Si el valor cambia desde fuera (repetir serie, cargar referencia) se actualiza el texto
  useEffect(() => setText(show(value)), [value]);

  const commit = (raw: string) => {
    const n = Number(raw.replace(',', '.'));
    if (raw.trim() === '' || !Number.isFinite(n)) return onChange(null);
    onChange(Math.min(max, Math.max(min, round(n))));
  };
  const bump = (dir: 1 | -1) => onChange(Math.min(max, Math.max(min, round((value ?? 0) + dir * step))));

  return (
    <div className={cn('min-w-0 rounded-[16px] border bg-[#181619]/70 px-1.5 pb-1.5 pt-2 text-center transition-colors', invalid ? 'border-[#e8b4a0]/70' : 'border-[#fff8e4]/15 focus-within:border-[#62b8cf]', className)}>
      <label htmlFor={id} className="block text-[11.5px] font-medium text-[#a8a295]">
        {label}
        {unit && <span className="text-[#a8a295]"> · {unit}</span>}
      </label>
      <div className="mt-0.5 flex items-center justify-between">
        <button type="button" disabled={disabled || (value ?? 0) <= min} onClick={() => bump(-1)} aria-label={`Restar a ${label}`} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-[#8fd0e0] transition-colors active:bg-[#62b8cf]/15 disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#fff8e4]">
          <Minus className="h-5 w-5" aria-hidden="true" />
        </button>
        <input
          id={id}
          inputMode={decimals ? 'decimal' : 'numeric'}
          autoComplete="off"
          disabled={disabled}
          value={text}
          placeholder="—"
          onChange={(e) => {
            const cleaned = e.target.value.replace(decimals ? /[^0-9.,]/g : /\D/g, '').slice(0, 7);
            setText(cleaned);
          }}
          onBlur={() => commit(text)}
          onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget.blur())}
          onFocus={(e) => e.currentTarget.select()}
          className="w-full min-w-0 bg-transparent text-center text-[1.5rem] font-extrabold tabular-nums leading-none text-[#fff8e4] placeholder:text-[#a8a295]/60 focus-visible:outline-none"
        />
        <button type="button" disabled={disabled || (value ?? 0) >= max} onClick={() => bump(1)} aria-label={`Sumar a ${label}`} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-[#8fd0e0] transition-colors active:bg-[#62b8cf]/15 disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#fff8e4]">
          <Plus className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
};

export default NumberStepper;
