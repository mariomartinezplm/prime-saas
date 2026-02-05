import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { format, parseISO } from 'date-fns';
import type { Measurement } from '@/types';

interface WeightChartProps {
  measurements: Measurement[];
}

const WeightChart = ({ measurements }: WeightChartProps) => {
  const data = measurements
    .filter((m) => m.weight !== undefined)
    .map((m) => ({
      date: format(parseISO(m.date), 'dd/MM'),
      weight: m.weight,
    }))
    .reverse();

  if (data.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Evolución del Peso</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
              <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} domain={['auto', 'auto']} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
              />
              <Area
                type="monotone"
                dataKey="weight"
                stroke="hsl(194 45% 44%)"
                fill="hsl(194 45% 44% / 0.2)"
                strokeWidth={2}
                name="kg"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};

export default WeightChart;
