import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { TrendingUp, Dumbbell } from 'lucide-react';

interface ExerciseProgressData {
    date: string;
    weight: number;
    reps?: number;
    sets?: number;
}

interface ExerciseProgressChartProps {
    exerciseName: string;
    data: ExerciseProgressData[];
    color?: string;
}

const ExerciseProgressChart = ({
    exerciseName,
    data,
    color = '#398CA2'
}: ExerciseProgressChartProps) => {
    if (!data || data.length === 0) {
        return (
            <Card>
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <Dumbbell className="w-5 h-5 text-primary" />
                        <CardTitle className="text-lg font-semibold">{exerciseName}</CardTitle>
                    </div>
                </CardHeader>
                <CardContent className="py-12 text-center">
                    <p className="text-muted-foreground">No hay datos registrados para este ejercicio</p>
                </CardContent>
            </Card>
        );
    }

    const chartData = data.map(item => ({
        date: format(parseISO(item.date), 'dd MMM', { locale: es }),
        fullDate: format(parseISO(item.date), "d 'de' MMMM yyyy", { locale: es }),
        weight: item.weight,
        reps: item.reps,
        sets: item.sets,
    }));

    const latestWeight = chartData[chartData.length - 1]?.weight || 0;
    const initialWeight = chartData[0]?.weight || 0;
    const totalImprovement = latestWeight - initialWeight;
    const improvementPercent = initialWeight > 0 ? ((totalImprovement / initialWeight) * 100).toFixed(1) : '0';

    const maxWeight = Math.max(...chartData.map(d => d.weight));

    return (
        <Card className="shadow-card hover:shadow-elevated transition-all duration-300 overflow-hidden">
            <CardHeader className="pb-3 bg-gradient-section">
                <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                        <div className="p-2 rounded-lg bg-primary/10">
                            <Dumbbell className="w-5 h-5" style={{ color }} />
                        </div>
                        <div>
                            <CardTitle className="text-lg font-bold text-foreground">{exerciseName}</CardTitle>
                            <CardDescription className="text-sm">Progreso de carga</CardDescription>
                        </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                        <div className="text-3xl font-bold" style={{ color }}>
                            {latestWeight} <span className="text-sm font-normal text-muted-foreground">kg</span>
                        </div>
                        {totalImprovement !== 0 && (
                            <div className="flex items-center gap-1 text-sm">
                                <TrendingUp className="w-4 h-4 text-green-500" />
                                <span className="text-green-500 font-semibold">
                                    +{totalImprovement} kg ({improvementPercent}%)
                                </span>
                            </div>
                        )}
                    </div>
                </div>
            </CardHeader>
            <CardContent className="pb-6 pt-4">
                {/* Mini Stats */}
                <div className="grid grid-cols-3 gap-2 mb-4">
                    <div className="text-center p-2 bg-background rounded border border-border">
                        <div className="text-xs text-muted-foreground">Inicial</div>
                        <div className="text-sm font-bold text-foreground">{initialWeight} kg</div>
                    </div>
                    <div className="text-center p-2 bg-background rounded border border-border">
                        <div className="text-xs text-muted-foreground">Máximo</div>
                        <div className="text-sm font-bold" style={{ color }}>{maxWeight} kg</div>
                    </div>
                    <div className="text-center p-2 bg-background rounded border border-border">
                        <div className="text-xs text-muted-foreground">Actual</div>
                        <div className="text-sm font-bold text-foreground">{latestWeight} kg</div>
                    </div>
                </div>

                {/* Chart */}
                <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData}>
                            <defs>
                                <linearGradient id={`colorWeight-${exerciseName}`} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                                    <stop offset="95%" stopColor={color} stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#E1E6ED" vertical={false} />
                            <XAxis
                                dataKey="date"
                                tick={{ fill: '#6B7280', fontSize: 11 }}
                                stroke="#E1E6ED"
                            />
                            <YAxis
                                tick={{ fill: '#6B7280', fontSize: 11 }}
                                stroke="#E1E6ED"
                                domain={[0, Math.ceil(maxWeight * 1.1)]}
                            />
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: '#FFFFFF',
                                    border: '1px solid #E1E6ED',
                                    borderRadius: '8px',
                                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                                }}
                                labelStyle={{ color: '#252B33', fontWeight: 600 }}
                                formatter={(value: number, name: string) => {
                                    if (name === 'weight') return [`${value} kg`, 'Peso'];
                                    if (name === 'reps') return [`${value}`, 'Repeticiones'];
                                    if (name === 'sets') return [`${value}`, 'Series'];
                                    return value;
                                }}
                                labelFormatter={(label, payload) => {
                                    if (payload && payload[0]) {
                                        return payload[0].payload.fullDate;
                                    }
                                    return label;
                                }}
                            />
                            <Area
                                type="monotone"
                                dataKey="weight"
                                stroke={color}
                                strokeWidth={2}
                                fill={`url(#colorWeight-${exerciseName})`}
                                dot={{ fill: color, strokeWidth: 2, r: 4 }}
                                activeDot={{ r: 6, fill: color, strokeWidth: 0 }}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>

                {/* Latest session details */}
                {chartData[chartData.length - 1]?.reps && (
                    <div className="mt-4 bg-gradient-section rounded-lg p-3 border border-border">
                        <div className="text-xs text-muted-foreground mb-1">Última sesión</div>
                        <div className="flex gap-4 text-sm">
                            <div>
                                <span className="font-semibold">{chartData[chartData.length - 1].sets}</span>
                                <span className="text-muted-foreground"> series</span>
                            </div>
                            <div>
                                <span className="font-semibold">{chartData[chartData.length - 1].reps}</span>
                                <span className="text-muted-foreground"> reps</span>
                            </div>
                            <div>
                                <span className="font-semibold">{chartData[chartData.length - 1].weight}</span>
                                <span className="text-muted-foreground"> kg</span>
                            </div>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
};

export default ExerciseProgressChart;
