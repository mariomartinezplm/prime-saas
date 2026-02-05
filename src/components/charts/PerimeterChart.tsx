import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { format, parseISO } from 'date-fns';
import type { Measurement } from '@/types';

interface PerimeterChartProps {
  measurements: Measurement[];
  perimeterKey: string;
  label: string;
}

const PerimeterChart = ({ measurements, perimeterKey, label }: PerimeterChartProps) => {
  const data = measurements
    .filter((m) => m.perimeters[perimeterKey as keyof typeof m.perimeters] !== undefined)
    .map((m) => ({
      date: format(parseISO(m.date), 'dd/MM'),
      value: m.perimeters[perimeterKey as keyof typeof m.perimeters] as number,
    }))
    .reverse();

  if (data.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
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
              <Line
                type="monotone"
                dataKey="value"
                stroke="hsl(194 45% 44%)"
                strokeWidth={2}
                dot={{ fill: 'hsl(194 45% 44%)', r: 4 }}
                name="cm"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};

export default PerimeterChart;
