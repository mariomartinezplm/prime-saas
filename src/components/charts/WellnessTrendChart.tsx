import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { format, parseISO } from 'date-fns';
import type { WellnessCheckin } from '@/types';

interface WellnessTrendChartProps {
  checkins: WellnessCheckin[];
}

const METRICS: Array<{ key: keyof WellnessCheckin; label: string; color: string }> = [
  { key: 'sleep', label: 'Sueño', color: 'hsl(194 45% 44%)' },
  { key: 'energy', label: 'Energía', color: 'hsl(38 92% 50%)' },
  { key: 'stress', label: 'Tranquilidad', color: 'hsl(280 60% 55%)' },
  { key: 'soreness', label: 'Cuerpo', color: 'hsl(340 75% 55%)' },
  { key: 'mood', label: 'Ánimo', color: 'hsl(142 71% 40%)' },
];

const WellnessTrendChart = ({ checkins }: WellnessTrendChartProps) => {
  const data = [...checkins]
    .reverse() // checkins llega más reciente primero; el gráfico va de más viejo a más nuevo
    .map((c) => ({
      date: format(parseISO(c.date), 'dd/MM'),
      sleep: c.sleep,
      energy: c.energy,
      stress: c.stress,
      soreness: c.soreness,
      mood: c.mood,
    }));

  if (data.length === 0) return null;

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
          <YAxis domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '8px',
              fontSize: '12px',
            }}
          />
          <Legend wrapperStyle={{ fontSize: '11px' }} />
          {METRICS.map(({ key, label, color }) => (
            <Line
              key={key}
              type="monotone"
              dataKey={key}
              name={label}
              stroke={color}
              strokeWidth={2}
              dot={{ r: 3 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default WellnessTrendChart;
