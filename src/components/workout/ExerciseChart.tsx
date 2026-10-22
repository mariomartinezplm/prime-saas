import { useId, useMemo } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { parseISO } from 'date-fns';
import { formatNumber, type Metric, type ProgressPoint, metricLabel } from '@/lib/exerciseProgress';
import { longDate, shortDate } from '@/lib/trend';

interface ExerciseChartProps {
  points: ProgressPoint[];
  metric: Metric;
  name: string;
  height?: number;
}

// Gráfico de UN ejercicio: una línea turquesa por fecha real, puntos con valor exacto, eje que PARTE DE CERO (no exagera cambios)
// y tooltip con la fecha, el valor y las repeticiones. Con un solo registro no se dibuja una línea ni una tendencia.
const ExerciseChart = ({ points, metric, name, height = 220 }: ExerciseChartProps) => {
  const id = useId().replace(/:/g, '');
  const data = useMemo(() => points.map((p) => ({ ...p, t: parseISO(p.date).getTime() })), [points]);
  if (data.length === 0) return null;
  const { unit, axis } = metricLabel[metric];
  const max = Math.max(...data.map((d) => d.value));
  // Eje que parte de cero con 4 tramos iguales y números redondos (no exagera los cambios)
  const niceStep = [1, 2, 5, 10, 20, 25, 50, 100, 200].find((st) => st * 4 >= max * 1.08) ?? Math.ceil((max * 1.08) / 4);
  const top = niceStep * 4;
  const yTicks = [0, 1, 2, 3, 4].map((i) => i * niceStep);
  const single = data.length === 1;
  const first = data[0];
  const last = data[data.length - 1];
  const ticks = single ? [first.t] : [first.t, ...(data.length > 2 ? [data[Math.floor(data.length / 2)].t] : []), last.t];
  const describe = `${name}: ${data.length} ${data.length === 1 ? 'registro' : 'registros'}, de ${formatNumber(first.value)} a ${formatNumber(last.value)} ${unit} entre el ${longDate(first.date)} y el ${longDate(last.date)}`;

  return (
    <figure className="m-0">
      <div role="img" aria-label={describe} style={{ height }} className="w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 14, right: 16, bottom: 0, left: 0 }}>
            <defs>
              <filter id={`glow${id}`} x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="2.5" result="b" />
                <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
            </defs>
            <CartesianGrid stroke="rgba(255,248,228,0.08)" vertical={false} />
            <XAxis dataKey="t" type="number" scale="time" domain={single ? [first.t - 86400000 * 3, first.t + 86400000 * 3] : ['dataMin', 'dataMax']} ticks={ticks} tickFormatter={(t: number) => shortDate(new Date(t).toISOString().slice(0, 10))} tick={{ fontSize: 11, fill: '#a8a295' }} axisLine={false} tickLine={false} padding={{ left: 8, right: 8 }} />
            <YAxis domain={[0, top]} ticks={yTicks} tick={{ fontSize: 11, fill: '#a8a295' }} axisLine={false} tickLine={false} width={34} tickFormatter={(v: number) => String(v)} />
            <Tooltip
              cursor={{ stroke: 'rgba(98,184,207,0.4)' }}
              content={({ active, payload }) => {
                const p = active && payload?.[0]?.payload as (ProgressPoint & { t: number }) | undefined;
                if (!p) return null;
                return (
                  <div className="rounded-xl border border-[#fff8e4]/15 bg-[#272329] px-3 py-2 text-[12.5px] text-[#fff8e4] shadow-lg">
                    <p className="text-[#a8a295]">{longDate(p.date)}</p>
                    <p className="mt-0.5 text-[15px] font-extrabold tabular-nums">{formatNumber(p.value)} {unit}{p.reps ? <span className="ml-1 text-[12.5px] font-semibold text-[#cdc6b6]">× {p.reps} rep</span> : null}</p>
                    <p className="text-[#a8a295]">{p.sets} {p.sets === 1 ? 'serie' : 'series'} ese día</p>
                  </div>
                );
              }}
            />
            <Line type="monotone" dataKey="value" stroke="#62b8cf" strokeWidth={single ? 0 : 3} dot={{ r: 5, fill: '#1f1c21', stroke: '#62b8cf', strokeWidth: 2.5 }} activeDot={{ r: 7, fill: '#fff8e4', stroke: '#62b8cf', strokeWidth: 3 }} isAnimationActive={false} style={{ filter: `url(#glow${id})` }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="sr-only">
      <table>
        <caption>{describe}</caption>
        <thead><tr><th>Fecha</th><th>{axis}</th><th>Repeticiones</th></tr></thead>
        <tbody>{data.map((d) => <tr key={d.date}><td>{longDate(d.date)}</td><td>{formatNumber(d.value)}</td><td>{d.reps ?? '—'}</td></tr>)}</tbody>
      </table>
      </div>
    </figure>
  );
};

export default ExerciseChart;
