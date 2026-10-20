import { useId, useMemo } from 'react';
import { Area, AreaChart, CartesianGrid, ReferenceDot, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { parseISO } from 'date-fns';
import { describeTrend, formatValue, longDate, shortDate, sortPoints, type TrendPoint } from '@/lib/trend';

interface TrendChartProps {
  points: TrendPoint[];
  unit: string;
  decimals?: number;
  label: string;
  height?: number;
}

// Gráfico de tendencia: eje horizontal por FECHA REAL (los registros espaciados se ven espaciados), puntos visibles, último punto
// destacado, descripción para lectores de pantalla y tabla oculta con todos los valores. Con un solo registro no se dibuja una línea.
const TrendChart = ({ points, unit, decimals = 1, label, height = 190 }: TrendChartProps) => {
  const gradientId = useId().replace(/:/g, '');
  const sorted = useMemo(() => sortPoints(points), [points]);
  const data = useMemo(() => sorted.map((p) => ({ t: parseISO(p.date).getTime(), value: p.value, date: p.date })), [sorted]);
  if (data.length === 0) return null;

  const values = data.map((d) => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = (max - min) * 0.35 || Math.max(Math.abs(max) * 0.02, 1);
  const domainY: [number, number] = [min - pad, max + pad];
  const first = data[0];
  const last = data[data.length - 1];
  const middle = data.length > 2 ? data[Math.floor(data.length / 2)] : undefined;
  const xTicks = [first.t, ...(middle ? [middle.t] : []), ...(last.t !== first.t ? [last.t] : [])];
  const suffix = unit ? ` ${unit}` : '';
  const crosses = parseISO(first.date).getFullYear() !== parseISO(last.date).getFullYear();

  return (
    <figure className="m-0">
      <div role="img" aria-label={describeTrend(label, points, unit, decimals)} style={{ height }} className="w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 12, right: 14, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#398ca2" stopOpacity={0.4} />
                <stop offset="100%" stopColor="#398ca2" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="rgba(255,248,228,0.08)" vertical={false} />
            <XAxis
              dataKey="t"
              type="number"
              scale="time"
              domain={first.t === last.t ? [first.t - 864e5, last.t + 864e5] : [first.t, last.t]}
              ticks={xTicks}
              tickFormatter={(t: number) => shortDate(new Date(t).toISOString(), crosses ? first.date : undefined)}
              tick={{ fontSize: 11, fill: 'rgba(255,248,228,0.62)' }}
              axisLine={false}
              tickLine={false}
              padding={{ left: 10, right: 10 }}
            />
            <YAxis
              domain={domainY}
              tickCount={3}
              width={38}
              tickFormatter={(v: number) => formatValue(v, 0)}
              tick={{ fontSize: 11, fill: 'rgba(255,248,228,0.62)' }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              cursor={{ stroke: 'rgba(255,248,228,0.25)' }}
              formatter={(v: number) => [`${formatValue(v, decimals)}${suffix}`, label]}
              labelFormatter={(t: number) => longDate(new Date(t).toISOString())}
              contentStyle={{ background: '#28262b', border: '1px solid rgba(255,248,228,0.16)', borderRadius: 12, fontSize: 12, color: '#fff8e4' }}
              itemStyle={{ color: '#fff8e4' }}
              labelStyle={{ color: 'rgba(255,248,228,0.7)' }}
            />
            {data.length > 1 && (
              <Area type="monotone" dataKey="value" stroke="#398ca2" strokeWidth={2.6} fill={`url(#${gradientId})`} dot={{ r: 4, fill: '#201e22', stroke: '#398ca2', strokeWidth: 2 }} activeDot={{ r: 6, fill: '#fff8e4', stroke: '#398ca2', strokeWidth: 3 }} isAnimationActive={false} />
            )}
            <ReferenceDot x={last.t} y={last.value} r={6} fill="#fff8e4" stroke="#398ca2" strokeWidth={3} ifOverflow="extendDomain" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <table className="sr-only">
        <caption>{`Valores de ${label}`}</caption>
        <thead>
          <tr><th scope="col">Fecha</th><th scope="col">{`Valor${unit ? ` (${unit})` : ''}`}</th></tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.date}><td>{longDate(d.date)}</td><td>{formatValue(d.value, decimals)}</td></tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
};

export default TrendChart;
