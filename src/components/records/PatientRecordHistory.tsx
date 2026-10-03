import { useCallback, useEffect, useState } from 'react';
import { format, parseISO } from 'date-fns';
import api from '@/lib/api';
import { showApiError } from '@/lib/apiError';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import MeasurementForm from '@/components/forms/MeasurementForm';
import ExerciseForm from '@/components/forms/ExerciseForm';
import RecordRowActions from './RecordRowActions';
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
      toast.success('Medición eliminada');
      await load();
    } catch (err: unknown) {
      showApiError(err, 'No se pudo eliminar la medición');
    }
  };

  if (loading || records.length === 0) return null;

  return (
    <Card>
      <CardHeader><CardTitle className="text-lg">Mediciones registradas</CardTitle></CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="text-left py-2 px-2">Fecha</th>
                <th className="text-right py-2 px-2">Peso</th>
                <th className="text-right py-2 px-2">% Grasa</th>
                <th className="py-2 px-2" />
              </tr>
            </thead>
            <tbody>
              {records.map((m) => (
                <tr key={m._id} className="border-b border-border/50">
                  <td className="py-2 px-2">{format(parseISO(m.date), 'dd/MM/yyyy')}</td>
                  <td className="py-2 px-2 text-right">{m.weight ? `${m.weight} kg` : '-'}</td>
                  <td className="py-2 px-2 text-right">{m.bodyFatPercentage ? `${m.bodyFatPercentage}%` : '-'}</td>
                  <td className="py-2 px-2">
                    <RecordRowActions itemLabel="esta medición" onEdit={() => setEditing(m)} onDelete={() => handleDelete(m)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
  );
};

export const ExerciseHistory = ({ patientId, refreshKey }: HistoryProps) => {
  const { records, loading, load } = useRecords<ExerciseProgress>(`/exercises/patient/${patientId}`, 'exercises', refreshKey);
  const [editing, setEditing] = useState<ExerciseProgress | null>(null);

  const handleDelete = async (e: ExerciseProgress) => {
    try {
      await api.delete(`/exercises/${e._id}`);
      toast.success('Ejercicio eliminado');
      await load();
    } catch (err: unknown) {
      showApiError(err, 'No se pudo eliminar el ejercicio');
    }
  };

  if (loading || records.length === 0) return null;

  return (
    <Card>
      <CardHeader><CardTitle className="text-lg">Ejercicios registrados</CardTitle></CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="text-left py-2 px-2">Fecha</th>
                <th className="text-left py-2 px-2">Ejercicio</th>
                <th className="text-center py-2 px-2">Series × Reps</th>
                <th className="text-right py-2 px-2">Peso</th>
                <th className="py-2 px-2" />
              </tr>
            </thead>
            <tbody>
              {records.map((e) => (
                <tr key={e._id} className="border-b border-border/50">
                  <td className="py-2 px-2">{format(parseISO(e.date), 'dd/MM/yyyy')}</td>
                  <td className="py-2 px-2 font-medium">{e.exerciseName}</td>
                  <td className="py-2 px-2 text-center">{e.sets || '-'} × {e.reps || '-'}</td>
                  <td className="py-2 px-2 text-right">{e.weight ? `${e.weight} ${e.weightUnit}` : '-'}</td>
                  <td className="py-2 px-2">
                    <RecordRowActions itemLabel="este ejercicio" onEdit={() => setEditing(e)} onDelete={() => handleDelete(e)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
