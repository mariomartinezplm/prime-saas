import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { format, parseISO } from 'date-fns';
import type { EVARecord } from '@/types';

interface PainEvolutionChartProps {
  records: EVARecord[];
  bodyArea?: string;
}

const PainEvolutionChart = ({ records, bodyArea }: PainEvolutionChartProps) => {
  const filtered = bodyArea
    ? records.filter((r) => r.bodyArea === bodyArea)
    : records;

  const data = filtered
    .map((r) => ({
      date: format(parseISO(r.date), 'dd/MM'),
      pain: r.painLevel,
      area: r.bodyArea.replace(/-/g, ' '),
    }))
    .reverse();

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">
            Evolución del Dolor {bodyArea ? `- ${bodyArea.replace(/-/g, ' ')}` : ''}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm text-center py-6">
            Sin registros de dolor
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">
          Evolución del Dolor {bodyArea ? `- ${bodyArea.replace(/-/g, ' ')}` : ''}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
              <YAxis
                domain={[0, 10]}
                ticks={[0, 2, 4, 6, 8, 10]}
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
              />
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
                dataKey="pain"
                stroke="#ef4444"
                strokeWidth={2}
                dot={{ fill: '#ef4444', r: 4 }}
                name="Dolor"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};

export default PainEvolutionChart;
