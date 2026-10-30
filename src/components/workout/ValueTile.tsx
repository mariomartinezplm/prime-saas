import { useEffect, useId, useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ValueTileProps {
  label: string;
  unit?: string;
  value: number | null;
  onChange: (value: number | null) => void;
  step?: number;
  min?: number;
  max?: number;
  decimals?: boolean;
  invalid?: boolean;
}

const round = (n: number) => Math.round(n * 100) / 100;
const show = (v: number | null) => (v === null ? '' : String(v).replace('.', ','));

// Cuadro de un valor (series, repeticiones, kilos, segundos): número grande que se escribe con el teclado numérico del teléfono y,
// debajo, − y + para ajustar con el pulgar. Más compacto que NumberStepper para que quepan tres cuadros en una fila.
const ValueTile = ({ label, unit, value, onChange, step = 1, min = 0, max = 9999, decimals = false, invalid, }: ValueTileProps) => {
  const id = useId();
  const [text, setText] = useState(show(value));
  useEffect(() => setText(show(value)), [value]);

  const commit = (raw: string) => {
    const n = Number(raw.replace(',', '.'));
    if (raw.trim() === '' || !Number.isFinite(n)) return onChange(null);
    onChange(Math.min(max, Math.max(min, round(n))));
  };
  const bump = (dir: 1 | -1) => onChange(Math.min(max, Math.max(min, round((value ?? 0) + dir * step))));

  return (
    <div className={cn('min-w-0 rounded-[16px] border bg-[#1a171b] px-1 pb-1 pt-1.5 text-center transition-colors', invalid ? 'border-[#e8b4a0]/70' : 'border-[#fff8e4]/15 focus-within:border-[#62b8cf]')}>
      <label htmlFor={id} className="block truncate px-1 text-[11.5px] font-medium text-[#a8a295]">
        {label}{unit && <span> · {unit}</span>}
      </label>
      <input
        id={id}
        inputMode={decimals ? 'decimal' : 'numeric'}
        autoComplete="off"
        value={text}
        placeholder="—"
        aria-invalid={invalid || undefined}
        onChange={(e) => setText(e.target.value.replace(decimals ? /[^0-9.,]/g : /\D/g, '').slice(0, 6))}
        onBlur={() => commit(text)}
        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
        onFocus={(e) => e.currentTarget.select()}
        className="mt-0.5 h-10 w-full min-w-0 bg-transparent px-0 text-center text-[1.5rem] font-extrabold tabular-nums leading-none tracking-[-0.02em] text-[#fff8e4] placeholder:text-[#a8a295]/60 focus-visible:outline-none"
      />
      <div className="mt-0.5 grid grid-cols-2 gap-1">
        <button type="button" disabled={(value ?? 0) <= min} onClick={() => bump(-1)} aria-label={`Restar a ${label}`} className="flex h-10 items-center justify-center rounded-xl text-[#8fd0e0] transition-colors active:bg-[#62b8cf]/15 disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#fff8e4]">
          <Minus className="h-[18px] w-[18px]" aria-hidden="true" />
        </button>
        <button type="button" disabled={(value ?? 0) >= max} onClick={() => bump(1)} aria-label={`Sumar a ${label}`} className="flex h-10 items-center justify-center rounded-xl text-[#8fd0e0] transition-colors active:bg-[#62b8cf]/15 disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#fff8e4]">
          <Plus className="h-[18px] w-[18px]" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
};

export default ValueTile;
