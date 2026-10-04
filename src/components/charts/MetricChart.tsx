import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { format, parseISO } from 'date-fns';
import { TrendingDown, TrendingUp, Minus } from 'lucide-react';
import type { MetricPoint } from './measurementMetrics';

interface MetricChartProps {
  title: string;
  unit: string;
  color: string;
  decimals?: number;
  // Cualquier orden: se ordena por fecha
  points: MetricPoint[];
}

const MetricChart = ({ title, unit, color, decimals = 1, points }: MetricChartProps) => {
  if (points.length === 0) return null;

  const sorted = [...points].sort((a, b) => parseISO(a.date).getTime() - parseISO(b.date).getTime());
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const change = last.value - first.value;
  const spansYears = parseISO(first.date).getFullYear() !== parseISO(last.date).getFullYear();

  const data = sorted.map((p) => ({
    label: format(parseISO(p.date), spansYears ? 'dd/MM/yy' : 'dd/MM'),
    value: p.value,
  }));

  const fmt = (n: number) => n.toFixed(decimals);
  const suffix = unit ? ` ${unit}` : '';
  const ChangeIcon = change > 0 ? TrendingUp : change < 0 ? TrendingDown : Minus;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-sm">{title}</CardTitle>
          <div className="text-right">
            <p className="text-lg font-bold leading-none" style={{ color }}>
              {fmt(last.value)}
              <span className="ml-1 text-xs font-normal text-muted-foreground">{unit}</span>
            </p>
            {sorted.length > 1 ? (
              <p className="mt-1 flex items-center justify-end gap-1 text-xs text-muted-foreground">
                <ChangeIcon className="h-3 w-3" />
                {change > 0 ? '+' : ''}{fmt(change)}{suffix} desde {format(parseISO(first.date), 'dd/MM')}
              </p>
            ) : (
              <p className="mt-1 text-xs text-muted-foreground">Primera medición</p>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-40">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
              <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} domain={['auto', 'auto']} />
              <Tooltip
                formatter={(value: number) => [`${fmt(value)}${suffix}`, title]}
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
              />
              <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2} dot={{ fill: color, r: 4 }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};

export default MetricChart;
