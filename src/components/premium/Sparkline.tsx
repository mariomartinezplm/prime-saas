import { cn } from '@/lib/utils';

interface SparklineProps {
  values: number[];
  className?: string;
}

// Mini-tendencia decorativa (el valor y el cambio siempre van escritos al lado). Línea punteada si no hay variación.
const Sparkline = ({ values, className }: SparklineProps) => {
  const W = 96;
  const H = 30;
  if (values.length === 0) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const flat = max === min || values.length < 2;
  const pts = values.map((v, i) => [values.length === 1 ? W / 2 : 4 + (i * (W - 8)) / (values.length - 1), flat ? H / 2 : H - 5 - ((v - min) / (max - min)) * (H - 10)]);
  const d = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  const [lx, ly] = pts[pts.length - 1];
  return (
    <svg aria-hidden="true" viewBox={`0 0 ${W} ${H}`} className={cn('h-[30px] w-full', className)} preserveAspectRatio="none">
      {pts.length > 1 && <path d={d} fill="none" stroke="#398ca2" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" strokeDasharray={flat ? '3 4' : undefined} opacity={flat ? 0.7 : 1} vectorEffect="non-scaling-stroke" />}
      <circle cx={lx} cy={ly} r="3.2" fill="#fff8e4" />
    </svg>
  );
};

export default Sparkline;
