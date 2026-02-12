import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import BodyDiagram from '@/components/body/BodyDiagram';
import PerimeterChart from '@/components/charts/PerimeterChart';
import WeightChart from '@/components/charts/WeightChart';
import JumpTestChart from '@/components/charts/JumpTestChart';
import { format, parseISO } from 'date-fns';
import { Ruler, Activity, TrendingUp, Zap } from 'lucide-react';
import api from '@/lib/api';
import type { Measurement } from '@/types';

const PERIMETER_LABELS: Record<string, string> = {
  shoulders: 'Hombros',
  chest: 'Pecho',
  neck: 'Cuello',
  bicepLeft: 'Bícep Izq',
  bicepRight: 'Bícep Der',
  forearmLeft: 'Antebrazo Izq',
  forearmRight: 'Antebrazo Der',
  waist: 'Cintura',
  hips: 'Cadera',
  thighLeft: 'Pierna Izq',
  thighRight: 'Pierna Der',
  calfLeft: 'Gemelo Izq',
  calfRight: 'Gemelo Der',
};

const JUMP_TEST_LABELS: Record<string, { label: string, description: string, color: string }> = {
  cmj: { label: 'CMJ', description: 'Counter Movement Jump', color: '#398CA2' },
  sj: { label: 'SJ', description: 'Squat Jump', color: '#2F7A8F' },
  cmjLeftLeg: { label: 'CMJ Unipodal Izq', description: 'CMJ Unipodal Pie Izquierdo', color: '#4BA5BC' },
  cmjRightLeg: { label: 'CMJ Unipodal Der', description: 'CMJ Unipodal Pie Derecho', color: '#5BB5CC' },
  sjLeftLeg: { label: 'SJ Unipodal Izq', description: 'SJ Unipodal Pie Izquierdo', color: '#6BC5DC' },
  sjRightLeg: { label: 'SJ Unipodal Der', description: 'SJ Unipodal Pie Derecho', color: '#7BD5EC' },
  dropJump: { label: 'Drop Jump', description: 'Salto desde altura', color: '#F59E0B' },
  abalakov: { label: 'Abalakov', description: 'Salto con impulso de brazos', color: '#8B5CF6' },
  horizontalJump: { label: 'Salto Horizontal', description: 'Salto longitudinal', color: '#D946EF' },
};

const MeasurementsEnhanced = () => {
  const { user } = useAuth();
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [selectedZone, setSelectedZone] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('perimeters');

  useEffect(() => {
    if (!user) return;
    api.get(`/measurements/patient/${user.id}`)
      .then((res) => setMeasurements(res.data.data.measurements || []))
      .catch(() => { })
      .finally(() => setLoading(false));
  }, [user]);

  const latestMeasurement = measurements[0];
  const zoneValues: Record<string, number> = {};
  if (latestMeasurement) {
    Object.entries(latestMeasurement.perimeters).forEach(([key, value]) => {
      if (value) zoneValues[key] = value;
    });
  }

  // Prepare jump test data
  const prepareJumpData = (testKey: keyof typeof JUMP_TEST_LABELS) => {
    return measurements
      .filter(m => m.jumpTests?.[testKey])
      .map(m => ({
        date: m.date,
        value: m.jumpTests![testKey]!,
      }))
      .reverse();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Mediciones y Progreso</h1>
          <p className="text-muted-foreground mt-1">
            Monitorea tu evolución física y de rendimiento
          </p>
        </div>
        {latestMeasurement && (
          <div className="bg-gradient-section rounded-lg p-4 border border-border">
            <div className="text-xs text-muted-foreground mb-1">Última medición</div>
            <div className="text-lg font-bold text-foreground">
              {format(parseISO(latestMeasurement.date), 'dd/MM/yyyy')}
            </div>
          </div>
        )}
      </div>

      {/* Tabs para diferentes vistas */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-6">
          <TabsTrigger value="perimeters" className="flex items-center gap-2">
            <Ruler className="w-4 h-4" />
            <span>Perímetros</span>
          </TabsTrigger>
          <TabsTrigger value="jumps" className="flex items-center gap-2">
            <Zap className="w-4 h-4" />
            <span>Tests de Salto</span>
          </TabsTrigger>
          <TabsTrigger value="general" className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            <span>General</span>
          </TabsTrigger>
        </TabsList>

        {/* Pestaña de Perímetros */}
        <TabsContent value="perimeters" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Body diagram */}
            <Card className="lg:col-span-1 shadow-card">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Activity className="w-5 h-5 text-primary" />
                  Diagrama Corporal
                </CardTitle>
                <CardDescription>
                  Toca una zona para ver su evolución
                </CardDescription>
              </CardHeader>
              <CardContent>
                <BodyDiagram
                  selectedZone={selectedZone}
                  onZoneClick={setSelectedZone}
                  zoneValues={zoneValues}
                />
              </CardContent>
            </Card>

            {/* Charts */}
            <div className="lg:col-span-2 space-y-4">
              {/* Weight chart always visible */}
              <WeightChart measurements={measurements} />

              {/* Selected zone chart */}
              {selectedZone && (
                <PerimeterChart
                  measurements={measurements}
                  perimeterKey={selectedZone}
                  label={`Evolución - ${PERIMETER_LABELS[selectedZone] || selectedZone}`}
                />
              )}

              {/* If no zone selected, show latest values */}
              {!selectedZone && latestMeasurement && (
                <Card className="shadow-card">
                  <CardHeader>
                    <CardTitle className="text-lg">Última Medición - Perímetros</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {format(parseISO(latestMeasurement.date), 'dd/MM/yyyy')}
                    </p>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                      {Object.entries(latestMeasurement.perimeters).map(([key, value]) =>
                        value ? (
                          <div
                            key={key}
                            className="p-3 rounded-lg border border-border cursor-pointer hover:border-primary hover:shadow-md transition-all duration-200 bg-gradient-section"
                            onClick={() => setSelectedZone(key)}
                          >
                            <p className="text-muted-foreground text-xs mb-1">{PERIMETER_LABELS[key] || key}</p>
                            <p className="font-bold text-lg text-foreground">{value} <span className="text-xs text-muted-foreground">cm</span></p>
                          </div>
                        ) : null
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Pestaña de Tests de Salto */}
        <TabsContent value="jumps" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            {(Object.keys(JUMP_TEST_LABELS) as Array<keyof typeof JUMP_TEST_LABELS>).map((testKey) => {
              const jumpData = prepareJumpData(testKey);
              const config = JUMP_TEST_LABELS[testKey];

              return (
                <JumpTestChart
                  key={testKey}
                  data={jumpData}
                  title={config.label}
                  description={config.description}
                  color={config.color}
                  unit="cm"
                />
              );
            })}
          </div>

          {/* Jump tests summary */}
          {latestMeasurement?.jumpTests && (
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Zap className="w-5 h-5 text-primary" />
                  Resumen de Tests de Salto
                </CardTitle>
                <CardDescription>Última medición realizada</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {Object.entries(latestMeasurement.jumpTests).map(([key, value]) =>
                    value ? (
                      <div key={key} className="p-4 rounded-lg bg-gradient-section border border-border">
                        <div className="text-xs text-muted-foreground mb-2">
                          {JUMP_TEST_LABELS[key as keyof typeof JUMP_TEST_LABELS]?.label || key}
                        </div>
                        <div className="text-2xl font-bold" style={{ color: JUMP_TEST_LABELS[key as keyof typeof JUMP_TEST_LABELS]?.color }}>
                          {value} <span className="text-sm text-muted-foreground">cm</span>
                        </div>
                      </div>
                    ) : null
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Pestaña General */}
        <TabsContent value="general" className="space-y-6">
          {latestMeasurement && (
            <div className="grid gap-4 md:grid-cols-4">
              {latestMeasurement.weight && (
                <Card className="shadow-card bg-gradient-section">
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <div className="text-sm text-muted-foreground mb-2">Peso</div>
                      <div className="text-3xl font-bold text-primary">{latestMeasurement.weight} <span className="text-sm">kg</span></div>
                    </div>
                  </CardContent>
                </Card>
              )}
              {latestMeasurement.height && (
                <Card className="shadow-card bg-gradient-section">
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <div className="text-sm text-muted-foreground mb-2">Altura</div>
                      <div className="text-3xl font-bold text-primary">{latestMeasurement.height} <span className="text-sm">cm</span></div>
                    </div>
                  </CardContent>
                </Card>
              )}
              {latestMeasurement.bmi && (
                <Card className="shadow-card bg-gradient-section">
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <div className="text-sm text-muted-foreground mb-2">IMC</div>
                      <div className="text-3xl font-bold text-primary">{latestMeasurement.bmi.toFixed(1)}</div>
                    </div>
                  </CardContent>
                </Card>
              )}
              {latestMeasurement.bodyFatPercentage && (
                <Card className="shadow-card bg-gradient-section">
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <div className="text-sm text-muted-foreground mb-2">% Grasa</div>
                      <div className="text-3xl font-bold text-primary">{latestMeasurement.bodyFatPercentage}<span className="text-sm">%</span></div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          <WeightChart measurements={measurements} />

          {/* Measurement history table */}
          {measurements.length > 0 && (
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle className="text-lg">Historial de Mediciones</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-3 px-2 text-muted-foreground font-semibold">Fecha</th>
                        <th className="text-right py-3 px-2 text-muted-foreground font-semibold">Peso</th>
                        <th className="text-right py-3 px-2 text-muted-foreground font-semibold">IMC</th>
                        <th className="text-right py-3 px-2 text-muted-foreground font-semibold">% Grasa</th>
                      </tr>
                    </thead>
                    <tbody>
                      {measurements.map((m, idx) => (
                        <tr key={m._id} className={`border-b border-border/50 hover:bg-gradient-section transition-colors ${idx % 2 === 0 ? 'bg-background' : ''}`}>
                          <td className="py-3 px-2 font-medium">{format(parseISO(m.date), 'dd/MM/yyyy')}</td>
                          <td className="py-3 px-2 text-right">{m.weight ? `${m.weight} kg` : '-'}</td>
                          <td className="py-3 px-2 text-right">{m.bmi ? m.bmi.toFixed(1) : '-'}</td>
                          <td className="py-3 px-2 text-right">{m.bodyFatPercentage ? `${m.bodyFatPercentage}%` : '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {measurements.length === 0 && (
        <Card>
          <CardContent className="py-20 text-center">
            <Activity className="w-16 h-16 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">
              No tienes mediciones registradas
            </h3>
            <p className="text-muted-foreground">
              Tu kinesiólogo registrará tus mediciones durante las sesiones
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default MeasurementsEnhanced;
