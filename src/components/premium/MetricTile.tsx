import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { CARD, CARD_LINK } from '@/components/dashboard/brand';
import Sparkline from './Sparkline';

interface MetricTileProps {
  label: string;
  value: string; // ya formateado: «81»
  unit?: string; // «cm»
  caption?: ReactNode; // «−7 cm desde el 10 jul»
  values?: number[]; // para la mini-tendencia
  onClick?: () => void;
  ariaLabel?: string;
}

// Tarjeta de una medida: valor grande (crema), unidad, cambio escrito y mini-tendencia. Si tiene onClick es un botón completo (≥ 44 px).
const MetricTile = ({ label, value, unit, caption, values, onClick, ariaLabel }: MetricTileProps) => {
  const body = (
    <>
      <p className="text-[13px] text-[#fff8e4]/70">{label}</p>
      <p className="mt-1.5 text-[1.75rem] font-extrabold leading-none tracking-tight tabular-nums text-[#fff8e4]">
        {value}
        {unit && <span className="ml-1 text-sm font-semibold text-[#fff8e4]/65">{unit}</span>}
      </p>
      {values && values.length > 0 && <div className="mt-2.5"><Sparkline values={values} /></div>}
      {caption && <p className="mt-2 text-[12.5px] leading-snug text-[#fff8e4]/70">{caption}</p>}
    </>
  );
  const base = cn(CARD, 'block w-full min-w-0 p-3.5 text-left');
  return onClick ? (
    <button type="button" onClick={onClick} aria-label={ariaLabel} className={cn(base, CARD_LINK)}>
      {body}
    </button>
  ) : (
    <div className={base}>{body}</div>
  );
};

export default MetricTile;
