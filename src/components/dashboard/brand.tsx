import { cn } from '@/lib/utils';

// Identidad de PRIME: negro #181619, turquesa #398ca2 y crema #fff8e4 (con transparencias). Los valores van exactos, no los
// aproximados del tema. Los estados nunca se distinguen solo por color: llevan texto, icono o forma.
export const SURFACE = 'rounded-2xl border border-[#fff8e4]/10 bg-[#fff8e4]/[0.04] p-5 sm:p-6';
export const EYEBROW = 'flex items-center justify-between gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#fff8e4]/60';
export const TEXT = 'text-[#fff8e4]';
export const TEXT_SOFT = 'text-[#fff8e4]/75';
// Botón de relleno (texto negro sobre turquesa: 4,66:1) y botón de borde (texto crema)
export const BTN_FILL = 'border-[#398ca2] bg-[#398ca2] text-[#181619] hover:bg-[#398ca2]/90 hover:text-[#181619]';
export const BTN_OUTLINE = 'border-[#398ca2] bg-transparent text-[#fff8e4] hover:bg-[#398ca2]/15 hover:text-[#fff8e4]';
// Etiqueta de estado: siempre con texto
export const PILL = 'inline-flex items-center gap-1 rounded-full border border-[#fff8e4]/40 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-[#fff8e4]';
export const PILL_SOLID = 'inline-flex items-center gap-1 rounded-full bg-[#fff8e4] px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-[#181619]';

interface MeterProps {
  ratio: number; // 0..1
  label: string; // para lectores de pantalla: «6 de 8 sesiones»
  className?: string;
}

// Barra de progreso de la marca. El valor siempre está también en texto al lado: la barra refuerza, no es la única fuente.
export const Meter = ({ ratio, label, className }: MeterProps) => {
  const pct = Math.round(Math.min(1, Math.max(0, ratio)) * 100);
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      className={cn('h-2 w-full overflow-hidden rounded-full bg-[#fff8e4]/[0.06] ring-1 ring-inset ring-[#fff8e4]/25', className)}
    >
      <div className="h-full rounded-full bg-[#398ca2] transition-[width] duration-500 motion-reduce:transition-none" style={{ width: `${pct}%` }} />
    </div>
  );
};

