import { cn } from '@/lib/utils';
import { ringDash } from './meterMath';
import { useMeterAnimation } from './brand';

const SIZE = 88;
const STROKE = 8;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

interface ProgressRingProps {
  // 0..1. Sin valor (undefined) = no hay meta real: se dibuja solo el contorno, sin porcentaje ni valor accesible
  ratio?: number;
  // Texto completo para lectores de pantalla: «4 de 12 sesiones usadas»
  label: string;
  // Cifra grande del centro y su texto corto (ambos son los valores REALES, nunca se animan como conteo)
  value: string | number;
  caption?: string;
  tone?: 'brand' | 'cream';
  animateKey?: string;
  className?: string;
}

// Anillo de progreso (SVG, sin librerías). El número del centro es verdadero desde el primer instante; solo el trazo se «descubre»
// una vez (ver useMeterAnimation) y con «reducir movimiento» aparece ya dibujado. El valor nunca depende solo del color: lleva cifra.
const ProgressRing = ({ ratio, label, value, caption, tone = 'brand', animateKey, className }: ProgressRingProps) => {
  const hasRatio = ratio !== undefined;
  const { animate, covered } = useMeterAnimation(hasRatio ? ratio : Number.NaN, animateKey);
  const { valid, pct, dashOffset } = ringDash(hasRatio ? ratio : Number.NaN, CIRCUMFERENCE);

  return (
    <div
      role={valid ? 'progressbar' : 'img'}
      aria-label={label}
      aria-valuemin={valid ? 0 : undefined}
      aria-valuemax={valid ? 100 : undefined}
      aria-valuenow={valid ? pct : undefined}
      className={cn('relative grid shrink-0 place-items-center', className)}
      style={{ width: SIZE, height: SIZE }}
    >
      <svg aria-hidden="true" viewBox={`0 0 ${SIZE} ${SIZE}`} className="absolute inset-0 -rotate-90">
        <circle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} fill="none" stroke="#fff8e4" strokeOpacity="0.12" strokeWidth={STROKE} />
        {valid && pct > 0 && (
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            stroke={tone === 'brand' ? '#398ca2' : '#fff8e4'}
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={dashOffset}
            style={{ ['--ring-c' as string]: CIRCUMFERENCE }}
            className={cn(animate && 'animate-ring-fill motion-reduce:animate-none', animate && covered && '[animation-play-state:paused]')}
          />
        )}
      </svg>
      <div aria-hidden="true" className="text-center leading-none text-[#fff8e4]">
        <div className="text-[26px] font-semibold tabular-nums tracking-tight">{value}</div>
        {caption && <div className="mt-1 text-[11px] text-[#fff8e4]/65">{caption}</div>}
      </div>
    </div>
  );
};

export default ProgressRing;
