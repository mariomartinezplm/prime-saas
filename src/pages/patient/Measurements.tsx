import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import BodyDiagram from '@/components/body/BodyDiagram';
import PerimeterChart from '@/components/charts/PerimeterChart';
import WeightChart from '@/components/charts/WeightChart';
import { format, parseISO } from 'date-fns';
import api from '@/lib/api';
import type { Measurement } from '@/types';

const PERIMETER_LABELS: Record<string, string> = {
  chest: 'Pecho',
  bicepLeft: 'Bícep Izq',
  bicepRight: 'Bícep Der',
  waist: 'Cintura',
  hips: 'Cadera',
  thighLeft: 'Muslo Izq',
  thighRight: 'Muslo Der',
  calfLeft: 'Pantorrilla Izq',
  calfRight: 'Pantorrilla Der',
  forearmLeft: 'Antebrazo Izq',
  forearmRight: 'Antebrazo Der',
};

const Measurements = () => {
  const { user } = useAuth();
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [selectedZone, setSelectedZone] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    api.get(`/measurements/patient/${user.id}`)
      .then((res) => setMeasurements(res.data.data.measurements || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user]);

  const latestMeasurement = measurements[0];
  const zoneValues: Record<string, number> = {};
  if (latestMeasurement) {
    Object.entries(latestMeasurement.perimeters).forEach(([key, value]) => {
      if (value) zoneValues[key] = value;
    });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-secondary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Mediciones</h1>
        <p className="text-muted-foreground">
          Toca una zona del cuerpo para ver su evolución
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Body diagram */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-lg">Diagrama Corporal</CardTitle>
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
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Última Medición</CardTitle>
                <p className="text-sm text-muted-foreground">
                  {format(parseISO(latestMeasurement.date), 'dd/MM/yyyy')}
                </p>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                  {latestMeasurement.weight && (
                    <div className="p-2 rounded border border-border">
                      <p className="text-muted-foreground text-xs">Peso</p>
                      <p className="font-bold">{latestMeasurement.weight} kg</p>
                    </div>
                  )}
                  {latestMeasurement.height && (
                    <div className="p-2 rounded border border-border">
                      <p className="text-muted-foreground text-xs">Altura</p>
                      <p className="font-bold">{latestMeasurement.height} cm</p>
                    </div>
                  )}
                  {latestMeasurement.bmi && (
                    <div className="p-2 rounded border border-border">
                      <p className="text-muted-foreground text-xs">IMC</p>
                      <p className="font-bold">{latestMeasurement.bmi.toFixed(1)}</p>
                    </div>
                  )}
                  {Object.entries(latestMeasurement.perimeters).map(([key, value]) =>
                    value ? (
                      <div
                        key={key}
                        className="p-2 rounded border border-border cursor-pointer hover:border-secondary"
                        onClick={() => setSelectedZone(key)}
                      >
                        <p className="text-muted-foreground text-xs">{PERIMETER_LABELS[key] || key}</p>
                        <p className="font-bold">{value} cm</p>
                      </div>
                    ) : null
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Measurement history table */}
      {measurements.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Historial de Mediciones</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 text-muted-foreground">Fecha</th>
                    <th className="text-right py-2 text-muted-foreground">Peso</th>
                    <th className="text-right py-2 text-muted-foreground">IMC</th>
                    <th className="text-right py-2 text-muted-foreground">% Grasa</th>
                  </tr>
                </thead>
                <tbody>
                  {measurements.map((m) => (
                    <tr key={m._id} className="border-b border-border/50">
                      <td className="py-2">{format(parseISO(m.date), 'dd/MM/yyyy')}</td>
                      <td className="py-2 text-right">{m.weight ? `${m.weight} kg` : '-'}</td>
                      <td className="py-2 text-right">{m.bmi ? m.bmi.toFixed(1) : '-'}</td>
                      <td className="py-2 text-right">{m.bodyFatPercentage ? `${m.bodyFatPercentage}%` : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {measurements.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No tienes mediciones registradas aún</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Measurements;
