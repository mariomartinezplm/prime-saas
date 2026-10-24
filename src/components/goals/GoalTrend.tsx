import { useId } from 'react';
import type { IndicatorProgress } from '@/services/goalService';
import { dayLabel, formatValue } from '@/lib/goals';

// Gráfico compacto del avance: los registros reales (línea turquesa) y la meta (línea punteada). Con un solo registro solo se
// marca el punto: no se dibuja una tendencia que no existe. El valor y el cambio siempre van escritos aparte.
const GoalTrend = ({ progress }: { progress: IndicatorProgress }) => {
  const id = useId().replace(/:/g, '');
  const points = progress.points;
  if (points.length === 0) return null;
  const W = 300;
  const H = 76;
  const values = points.map((p) => p.value);
  const target = progress.target?.value;
  const all = target !== undefined ? [...values, target] : values;
  const min = Math.min(...all);
  const max = Math.max(...all);
  const span = max - min || 1;
  const y = (v: number) => H - 10 - ((v - min) / span) * (H - 22);
  const x = (i: number) => (points.length === 1 ? W / 2 : 8 + (i * (W - 16)) / (points.length - 1));
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(p.value).toFixed(1)}`).join(' ');
  const describe = `Evolución de ${progress.label}: ${points.length} ${points.length === 1 ? 'registro' : 'registros'}, de ${formatValue(points[0].value, progress.unit)} el ${dayLabel(points[0].day)} a ${formatValue(points[points.length - 1].value, progress.unit)} el ${dayLabel(points[points.length - 1].day)}`;
  return (
    <figure className="m-0">
      <svg role="img" aria-label={describe} viewBox={`0 0 ${W} ${H}`} className="h-[76px] w-full" preserveAspectRatio="none">
        <defs>
          <linearGradient id={`g${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#398ca2" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#398ca2" stopOpacity="0" />
          </linearGradient>
        </defs>
        {target !== undefined && <line x1="0" x2={W} y1={y(target)} y2={y(target)} stroke="#fff8e4" strokeOpacity="0.45" strokeWidth="1.2" strokeDasharray="4 5" vectorEffect="non-scaling-stroke" />}
        {points.length > 1 && <path d={`${path} L${x(points.length - 1).toFixed(1)} ${H} L${x(0).toFixed(1)} ${H} Z`} fill={`url(#g${id})`} />}
        {points.length > 1 && <path d={path} fill="none" stroke="#62b8cf" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />}
        {points.map((p, i) => <circle key={p.day} cx={x(i)} cy={y(p.value)} r={i === points.length - 1 ? 4.2 : 2.6} fill={i === points.length - 1 ? '#fff8e4' : '#1f1c21'} stroke="#62b8cf" strokeWidth="1.8" vectorEffect="non-scaling-stroke" />)}
      </svg>
      <figcaption className="sr-only">{describe}</figcaption>
    </figure>
  );
};

export default GoalTrend;
