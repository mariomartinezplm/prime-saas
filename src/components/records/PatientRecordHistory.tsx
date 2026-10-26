import { useCallback, useEffect, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import api from '@/lib/api';
import { showApiError } from '@/lib/apiError';
import { notify } from '@/lib/notify';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import MeasurementForm from '@/components/forms/MeasurementForm';
import ExerciseForm from '@/components/forms/ExerciseForm';
import RecordRowActions from './RecordRowActions';
import DataTable from '@/components/shared/DataTable';
import MetricChartGrid from '@/components/charts/MetricChartGrid';
import { GENERAL_METRICS, PERIMETER_METRICS, JUMP_METRICS } from '@/components/charts/measurementMetrics';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { ExerciseProgress, Measurement } from '@/types';

interface HistoryProps {
  patientId: string;
  // Se cambia desde afuera (por ejemplo al guardar un registro nuevo) para recargar
  refreshKey?: number;
}

// Historial para el personal: permite corregir o borrar lo que se ingresó mal.
// Un profesional solo ve a sus pacientes; eso lo decide el servidor.
const useRecords = <T,>(url: string, key: string, refreshKey: number | undefined) => {
  const [records, setRecords] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await api.get(url);
      setRecords(res.data.data[key] || []);
    } catch (err: unknown) {
      showApiError(err, 'No se pudo cargar el historial');
    } finally {
      setLoading(false);
    }
  }, [url, key]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  return { records, loading, load };
};

export const MeasurementHistory = ({ patientId, refreshKey }: HistoryProps) => {
  const { records, loading, load } = useRecords<Measurement>(`/measurements/patient/${patientId}`, 'measurements', refreshKey);
  const [editing, setEditing] = useState<Measurement | null>(null);

  const handleDelete = async (m: Measurement) => {
    try {
      await api.delete(`/measurements/${m._id}`);
      notify.success('Medición eliminada');
      await load();
    } catch (err: unknown) {
      showApiError(err, 'No se pudo eliminar la medición');
      throw err;
    }
  };

  if (loading || records.length === 0) return null;

  return (
    <>
    <Card>
      <CardHeader><CardTitle className="text-lg">Evolución</CardTitle></CardHeader>
      <CardContent>
        <Tabs defaultValue="body">
          <TabsList>
            <TabsTrigger value="body">Cuerpo</TabsTrigger>
            <TabsTrigger value="perimeters">Perímetros</TabsTrigger>
            <TabsTrigger value="jumps">Saltos</TabsTrigger>
          </TabsList>
          <TabsContent value="body" className="mt-4">
            <MetricChartGrid measurements={records} metrics={GENERAL_METRICS} emptyMessage="Aún no hay peso, grasa ni músculo registrados." />
          </TabsContent>
          <TabsContent value="perimeters" className="mt-4">
            <MetricChartGrid measurements={records} metrics={PERIMETER_METRICS} emptyMessage="Aún no hay perímetros registrados." />
          </TabsContent>
          <TabsContent value="jumps" className="mt-4">
            <MetricChartGrid measurements={records} metrics={JUMP_METRICS} emptyMessage="Aún no hay tests de salto registrados." />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>

    <Card>
      <CardHeader><CardTitle className="text-lg">Mediciones registradas</CardTitle></CardHeader>
      <CardContent>
        <DataTable
          caption="Mediciones registradas"
          rows={records}
          rowKey={(m) => m._id}
          columns={[
            { key: 'date', header: 'Fecha', cell: (m) => format(parseISO(m.date), 'dd/MM/yyyy'), primary: true },
            { key: 'weight', header: 'Peso', align: 'right', cell: (m) => (m.weight ? `${m.weight} kg` : '-') },
            { key: 'fat', header: '% Grasa', align: 'right', cell: (m) => (m.bodyFatPercentage ? `${m.bodyFatPercentage}%` : '-') },
          ]}
          actions={(m) => <RecordRowActions itemLabel="esta medición" onEdit={() => setEditing(m)} onDelete={() => handleDelete(m)} />}
        />
      </CardContent>

      <Dialog open={!!editing} onOpenChange={(open) => { if (!open) setEditing(null); }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Corregir medición</DialogTitle>
            <DialogDescription>Un campo que dejes vacío se borra de la medición.</DialogDescription>
          </DialogHeader>
          {editing && (
            <MeasurementForm
              key={editing._id}
              patientId={patientId}
              record={editing}
              embedded
              onSuccess={() => { setEditing(null); load(); }}
            />
          )}
        </DialogContent>
      </Dialog>
    </Card>
    </>
  );
};

export const ExerciseHistory = ({ patientId, refreshKey, onNewWeight }: HistoryProps & { onNewWeight?: (record: ExerciseProgress) => void }) => {
  const { records, loading, load } = useRecords<ExerciseProgress>(`/exercises/patient/${patientId}`, 'exercises', refreshKey);
  const [editing, setEditing] = useState<ExerciseProgress | null>(null);

  const handleDelete = async (e: ExerciseProgress) => {
    try {
      await api.delete(`/exercises/${e._id}`);
      notify.success('Ejercicio eliminado');
      await load();
    } catch (err: unknown) {
      showApiError(err, 'No se pudo eliminar el ejercicio');
      throw err;
    }
  };

  if (loading || records.length === 0) return null;

  return (
    <Card>
      <CardHeader><CardTitle className="text-lg">Ejercicios registrados</CardTitle></CardHeader>
      <CardContent>
        <DataTable
          caption="Ejercicios registrados"
          rows={records}
          rowKey={(e) => e._id}
          columns={[
            { key: 'date', header: 'Fecha', cell: (e) => format(parseISO(e.date), 'dd/MM/yyyy') },
            { key: 'name', header: 'Ejercicio', cell: (e) => <span className="font-medium">{e.exerciseName}</span>, primary: true },
            { key: 'sets', header: 'Series × Reps', align: 'center', cell: (e) => `${e.sets || '-'} × ${e.reps || '-'}` },
            { key: 'weight', header: 'Peso', align: 'right', cell: (e) => (e.weight ? `${e.weight} ${e.weightUnit}` : '-') },
          ]}
          actions={(e) => (
            <RecordRowActions
              itemLabel="este ejercicio"
              onEdit={() => setEditing(e)}
              onDelete={() => handleDelete(e)}
              extra={onNewWeight && (
                <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Registrar un nuevo peso en ${e.exerciseName}`} title="Registrar un nuevo peso" onClick={() => onNewWeight(e)}>
                  <Plus className="h-4 w-4" aria-hidden="true" />
                </Button>
              )}
            />
          )}
        />
      </CardContent>

      <Dialog open={!!editing} onOpenChange={(open) => { if (!open) setEditing(null); }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Corregir ejercicio</DialogTitle>
            <DialogDescription>Un campo que dejes vacío se borra del registro.</DialogDescription>
          </DialogHeader>
          {editing && (
            <ExerciseForm
              key={editing._id}
              patientId={patientId}
              record={editing}
              embedded
              onSuccess={() => { setEditing(null); load(); }}
            />
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
};
