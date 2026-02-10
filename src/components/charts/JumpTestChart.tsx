import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine } from 'recharts';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { TrendingUp, TrendingDown, Minus, Award } from 'lucide-react';

interface JumpData {
    date: string;
    value: number;
}

interface JumpTestChartProps {
    data: JumpData[];
    title: string;
    description?: string;
    unit?: string;
    color?: string;
    target?: number;
}

const JumpTestChart = ({
    data,
    title,
    description,
    unit = 'cm',
    color = '#398CA2',
    target
}: JumpTestChartProps) => {
    if (!data || data.length === 0) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg font-semibold">{title}</CardTitle>
                    {description && <CardDescription>{description}</CardDescription>}
                </CardHeader>
                <CardContent className="py-12 text-center">
                    <p className="text-muted-foreground">No hay datos registrados aún</p>
                </CardContent>
            </Card>
        );
    }

    const chartData = data.map(item => ({
        date: format(parseISO(item.date), 'dd MMM', { locale: es }),
        fullDate: format(parseISO(item.date), "d 'de' MMMM yyyy", { locale: es }),
        value: item.value,
    }));

    const latestValue = chartData[chartData.length - 1]?.value || 0;
    const previousValue = chartData[chartData.length - 2]?.value || latestValue;
    const improvement = latestValue - previousValue;
    const improvementPercent = previousValue > 0 ? ((improvement / previousValue) * 100).toFixed(1) : '0';

    const maxValue = Math.max(...chartData.map(d => d.value));
    const minValue = Math.min(...chartData.map(d => d.value));
    const average = chartData.reduce((sum, d) => sum + d.value, 0) / chartData.length;

    return (
        <Card className="shadow-card hover:shadow-elevated transition-all duration-300">
            <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                    <div>
                        <CardTitle className="text-lg font-bold text-foreground">{title}</CardTitle>
                        {description && (
                            <CardDescription className="text-sm text-muted-foreground mt-1">
                                {description}
                            </CardDescription>
                        )}
                    </div>
                    <div className="flex flex-col items-end gap-1">
                        <div className="text-3xl font-bold" style={{ color }}>
                            {latestValue} <span className="text-sm font-normal text-muted-foreground">{unit}</span>
                        </div>
                        <div className="flex items-center gap-1 text-sm">
                            {improvement > 0 && (
                                <>
                                    <TrendingUp className="w-4 h-4 text-green-500" />
                                    <span className="text-green-500 font-semibold">+{improvement} {unit} ({improvementPercent}%)</span>
                                </>
                            )}
                            {improvement < 0 && (
                                <>
                                    <TrendingDown className="w-4 h-4 text-red-500" />
                                    <span className="text-red-500 font-semibold">{improvement} {unit} ({improvementPercent}%)</span>
                                </>
                            )}
                            {improvement === 0 && (
                                <>
                                    <Minus className="w-4 h-4 text-muted-foreground" />
                                    <span className="text-muted-foreground">Sin cambios</span>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="pb-6">
                {/* Stats Summary */}
                <div className="grid grid-cols-3 gap-3 mb-6">
                    <div className="bg-gradient-section rounded-lg p-3 border border-border">
                        <div className="text-xs text-muted-foreground mb-1">Máximo</div>
                        <div className="text-lg font-bold" style={{ color }}>
                            {maxValue} {unit}
                        </div>
                    </div>
                    <div className="bg-gradient-section rounded-lg p-3 border border-border">
                        <div className="text-xs text-muted-foreground mb-1">Promedio</div>
                        <div className="text-lg font-bold text-foreground">
                            {average.toFixed(1)} {unit}
                        </div>
                    </div>
                    <div className="bg-gradient-section rounded-lg p-3 border border-border">
                        <div className="text-xs text-muted-foreground mb-1">Mínimo</div>
                        <div className="text-lg font-bold text-foreground">
                            {minValue} {unit}
                        </div>
                    </div>
                </div>

                {/* Chart */}
                <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#E1E6ED" vertical={false} />
                            <XAxis
                                dataKey="date"
                                tick={{ fill: '#6B7280', fontSize: 12 }}
                                stroke="#E1E6ED"
                            />
                            <YAxis
                                tick={{ fill: '#6B7280', fontSize: 12 }}
                                stroke="#E1E6ED"
                                domain={[Math.floor(minValue * 0.95), Math.ceil(maxValue * 1.05)]}
                            />
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: '#FFFFFF',
                                    border: '1px solid #E1E6ED',
                                    borderRadius: '8px',
                                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                                }}
                                labelStyle={{ color: '#252B33', fontWeight: 600 }}
                                formatter={(value: number) => [`${value} ${unit}`, title]}
                                labelFormatter={(label, payload) => {
                                    if (payload && payload[0]) {
                                        return payload[0].payload.fullDate;
                                    }
                                    return label;
                                }}
                            />
                            {target && (
                                <ReferenceLine
                                    y={target}
                                    stroke="#F59E0B"
                                    strokeDasharray="5 5"
                                    label={{ value: `Objetivo: ${target} ${unit}`, fill: '#F59E0B', fontSize: 12 }}
                                />
                            )}
                            <Line
                                type="monotone"
                                dataKey="value"
                                stroke={color}
                                strokeWidth={3}
                                dot={{ fill: color, strokeWidth: 2, r: 5 }}
                                activeDot={{ r: 7, fill: color, strokeWidth: 0 }}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </div>

                {/* Achievement Badge if target reached */}
                {target && latestValue >= target && (
                    <div className="mt-4 flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg p-3">
                        <Award className="w-5 h-5 text-green-600" />
                        <span className="text-sm font-semibold text-green-700">
                            ¡Objetivo alcanzado! 🎉
                        </span>
                    </div>
                )}
            </CardContent>
        </Card>
    );
};

export default JumpTestChart;
