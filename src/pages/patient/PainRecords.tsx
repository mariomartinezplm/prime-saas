import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import PainBodyDiagram from '@/components/body/PainBodyDiagram';
import PainEvolutionChart from '@/components/charts/PainEvolutionChart';
import { format, parseISO } from 'date-fns';
import api from '@/lib/api';
import DataTable from '@/components/shared/DataTable';
import { cn } from '@/lib/utils';
import type { EVARecord } from '@/types';

const PainRecords = () => {
  const { user } = useAuth();
  const [records, setRecords] = useState<EVARecord[]>([]);
  const [selectedZone, setSelectedZone] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    api.get(`/eva/patient/${user.id}`)
      .then((res) => setRecords(res.data.data.evaRecords || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user]);

  // Calculate latest pain levels by zone
  const painLevels: Record<string, number> = {};
  const latestByArea: Record<string, EVARecord> = {};
  records.forEach((r) => {
    if (!latestByArea[r.bodyArea]) {
      latestByArea[r.bodyArea] = r;
      painLevels[r.bodyArea] = r.painLevel;
    }
  });

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
        <h1 className="text-2xl font-bold text-foreground">Registros de Dolor (EVA)</h1>
        <p className="text-muted-foreground">
          Toca una zona del cuerpo para ver la evolución del dolor
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Pain body diagram */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-lg">Mapa de Dolor</CardTitle>
          </CardHeader>
          <CardContent>
            <PainBodyDiagram
              selectedZone={selectedZone}
              onZoneClick={setSelectedZone}
              painLevels={painLevels}
            />
          </CardContent>
        </Card>

        {/* Charts and summary */}
        <div className="lg:col-span-2 space-y-4">
          {/* Pain evolution chart */}
          <PainEvolutionChart
            records={records}
            bodyArea={selectedZone || undefined}
          />

          {/* Affected areas summary */}
          {Object.keys(latestByArea).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Zonas Afectadas</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {Object.entries(latestByArea).map(([area, record]) => (
                    <div
                      key={area}
                      className="p-3 rounded-lg border border-border cursor-pointer hover:border-secondary transition-colors"
                      onClick={() => setSelectedZone(area)}
                    >
                      <p className="text-sm font-medium capitalize">
                        {area.replace(/-/g, ' ')}
                      </p>
                      <div className="flex items-center justify-between mt-1">
                        <span className={`text-lg font-bold ${
                          record.painLevel <= 3 ? 'text-success' :
                          record.painLevel <= 6 ? 'text-warning' : 'text-destructive'
                        }`}>
                          {record.painLevel}/10
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {format(parseISO(record.date), 'dd/MM')}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Records table */}
      {records.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Historial</CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable
              caption="Registros de dolor"
              rows={records}
              rowKey={(r) => r._id}
              onRowClick={(r) => setSelectedZone(r.bodyArea)}
              columns={[
                { key: 'date', header: 'Fecha', cell: (r) => format(parseISO(r.date), 'dd/MM/yyyy') },
                { key: 'zone', header: 'Zona', primary: true, cell: (r) => <span className="capitalize">{r.bodyArea.replace(/-/g, ' ')}</span> },
                {
                  key: 'pain',
                  header: 'Dolor',
                  align: 'center',
                  cell: (r) => (
                    <span className={cn('font-bold', r.painLevel <= 3 ? 'text-success' : r.painLevel <= 6 ? 'text-warning' : 'text-destructive')}>
                      {r.painLevel}/10
                    </span>
                  ),
                },
                { key: 'type', header: 'Tipo', cell: (r) => <span className="capitalize text-muted-foreground">{r.painType?.join(', ') || '-'}</span> },
                { key: 'duration', header: 'Duración', cell: (r) => <span className="capitalize text-muted-foreground">{r.duration || '-'}</span> },
              ]}
            />
          </CardContent>
        </Card>
      )}

      {records.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No tienes registros de dolor</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default PainRecords;
