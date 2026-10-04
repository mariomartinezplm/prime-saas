import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import BodyDiagram from '@/components/body/BodyDiagram';
import MetricChart from '@/components/charts/MetricChart';
import MetricChartGrid from '@/components/charts/MetricChartGrid';
import {
  GENERAL_METRICS,
  PERIMETER_METRICS,
  JUMP_METRICS,
  PERIMETER_LABELS,
  JUMP_TEST_LABELS,
  buildSeries,
} from '@/components/charts/measurementMetrics';
import { format, parseISO } from 'date-fns';
import { Ruler, Activity, TrendingUp, Zap } from 'lucide-react';
import api from '@/lib/api';
import MeasurementForm from '@/components/forms/MeasurementForm';
import PatientRecordDialog from '@/components/forms/PatientRecordDialog';
import RecordRowActions from '@/components/records/RecordRowActions';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useHasActivePlan } from '@/hooks/useHasActivePlan';
import { showApiError } from '@/lib/apiError';
import { toast } from 'sonner';
import type { Measurement } from '@/types';

const MeasurementsEnhanced = () => {
  const { user } = useAuth();
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [selectedZone, setSelectedZone] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('perimeters');
  const [refreshKey, setRefreshKey] = useState(0);
  const [editing, setEditing] = useState<Measurement | null>(null);
  const hasActivePlan = useHasActivePlan(user?.id);

  useEffect(() => {
    if (!user) return;
    api.get(`/measurements/patient/${user.id}`)
      .then((res) => setMeasurements(res.data.data.measurements || []))
      .catch(() => { })
      .finally(() => setLoading(false));
  }, [user, refreshKey]);

  const canEdit = hasActivePlan === true;

  const handleDelete = async (m: Measurement) => {
    try {
      await api.delete(`/measurements/${m._id}`);
      toast.success('Medición eliminada');
      setRefreshKey((k) => k + 1);
    } catch (err: unknown) {
      showApiError(err, 'No se pudo eliminar la medición');
    }
  };

  const latestMeasurement = measurements[0];
  const zoneValues: Record<string, number> = {};
  if (latestMeasurement) {
    Object.entries(latestMeasurement.perimeters ?? {}).forEach(([key, value]) => {
      if (value) zoneValues[key] = value;
    });
  }

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
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Mediciones y Progreso</h1>
          <p className="text-muted-foreground mt-1">
            Monitorea tu evolución física y de rendimiento
          </p>
        </div>
        <div className="flex flex-wrap items-start gap-3">
          {latestMeasurement && (
            <div className="bg-gradient-section rounded-lg p-4 border border-border">
              <div className="text-xs text-muted-foreground mb-1">Última medición</div>
              <div className="text-lg font-bold text-foreground">
                {format(parseISO(latestMeasurement.date), 'dd/MM/yyyy')}
              </div>
            </div>
          )}
          <PatientRecordDialog
            label="Registrar medición"
            title="Registrar medición"
            description="Anota tu peso, % de grasa, perímetros o resultados. Solo completa lo que tengas."
          >
            {(close) => (
              <MeasurementForm
                patientId={user!.id}
                embedded
                onSuccess={() => { close(); setRefreshKey((k) => k + 1); }}
              />
            )}
          </PatientRecordDialog>
        </div>
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
              {selectedZone ? (
                <>
                  <Button variant="outline" size="sm" onClick={() => setSelectedZone(null)}>
                    Ver todos los perímetros
                  </Button>
                  {(() => {
                    const metric = PERIMETER_METRICS.find((m) => m.key === selectedZone);
                    const points = metric ? buildSeries(measurements, metric.read) : [];
                    return points.length > 0 && metric ? (
                      <MetricChart
                        title={`Evolución - ${PERIMETER_LABELS[selectedZone] || selectedZone}`}
                        unit={metric.unit}
                        color={metric.color}
                        points={points}
                      />
                    ) : (
                      <p className="py-8 text-center text-sm text-muted-foreground">
                        Aún no hay medidas de esta zona.
                      </p>
                    );
                  })()}
                </>
              ) : (
                <MetricChartGrid
                  measurements={measurements}
                  metrics={PERIMETER_METRICS}
                  emptyMessage="Todavía no hay perímetros registrados. Anótalos con el botón “Registrar medición”."
                />
              )}
            </div>
          </div>
        </TabsContent>

        {/* Pestaña de Tests de Salto */}
        <TabsContent value="jumps" className="space-y-6">
          <MetricChartGrid
            measurements={measurements}
            metrics={JUMP_METRICS}
            emptyMessage="Todavía no hay tests de salto registrados."
          />

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

          <MetricChartGrid
            measurements={measurements}
            metrics={GENERAL_METRICS}
            emptyMessage="Todavía no hay datos de peso, grasa o músculo."
          />

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
                        {canEdit && <th className="py-3 px-2" />}
                      </tr>
                    </thead>
                    <tbody>
                      {measurements.map((m, idx) => (
                        <tr key={m._id} className={`border-b border-border/50 hover:bg-gradient-section transition-colors ${idx % 2 === 0 ? 'bg-background' : ''}`}>
                          <td className="py-3 px-2 font-medium">{format(parseISO(m.date), 'dd/MM/yyyy')}</td>
                          <td className="py-3 px-2 text-right">{m.weight ? `${m.weight} kg` : '-'}</td>
                          <td className="py-3 px-2 text-right">{m.bmi ? m.bmi.toFixed(1) : '-'}</td>
                          <td className="py-3 px-2 text-right">{m.bodyFatPercentage ? `${m.bodyFatPercentage}%` : '-'}</td>
                          {canEdit && (
                            <td className="py-3 px-2">
                              <RecordRowActions itemLabel="esta medición" onEdit={() => setEditing(m)} onDelete={() => handleDelete(m)} />
                            </td>
                          )}
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
              Usa el botón "Registrar medición" para anotar tu peso, % de grasa o perímetros
            </p>
          </CardContent>
        </Card>
      )}

      <Dialog open={!!editing} onOpenChange={(open) => { if (!open) setEditing(null); }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Corregir medición</DialogTitle>
            <DialogDescription>Un campo que dejes vacío se borra de la medición.</DialogDescription>
          </DialogHeader>
          {editing && (
            <MeasurementForm
              key={editing._id}
              patientId={user!.id}
              record={editing}
              embedded
              onSuccess={() => { setEditing(null); setRefreshKey((k) => k + 1); }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MeasurementsEnhanced;
