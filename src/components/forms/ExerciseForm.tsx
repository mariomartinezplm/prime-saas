import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { showApiError } from '@/lib/apiError';
import { Loader2 } from 'lucide-react';
import api from '@/lib/api';
import { todayLocal, localNoonISO } from '@/lib/evolutionDate';
import type { ExerciseProgress } from '@/types';

interface ExerciseFormProps {
  patientId: string;
  onSuccess: () => void;
  // Sin tarjeta propia: para mostrarlo dentro de un diálogo
  embedded?: boolean;
  // Si viene, el formulario corrige ese registro en vez de crear uno nuevo
  record?: ExerciseProgress;
}

const CATEGORIES = [
  { value: 'fuerza', label: 'Fuerza' },
  { value: 'cardio', label: 'Cardio' },
  { value: 'flexibilidad', label: 'Flexibilidad' },
  { value: 'funcional', label: 'Funcional' },
  { value: 'rehabilitacion', label: 'Rehabilitación' },
  { value: 'otro', label: 'Otro' },
];

const emptyForm = () => ({
  date: todayLocal(),
  exerciseName: '',
  category: 'fuerza',
  sets: '',
  reps: '',
  weight: '',
  rpe: '',
  notes: '',
});

const text = (value?: number | null) => (value === undefined || value === null ? '' : String(value));

const formFromRecord = (e: ExerciseProgress) => ({
  date: format(parseISO(e.date), 'yyyy-MM-dd'),
  exerciseName: e.exerciseName,
  category: e.category,
  sets: text(e.sets),
  reps: text(e.reps),
  weight: text(e.weight),
  rpe: text(e.rpe),
  notes: e.notes ?? '',
});

const ExerciseForm = ({ patientId, onSuccess, embedded = false, record }: ExerciseFormProps) => {
  const isEdit = !!record;
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState(() => (record ? formFromRecord(record) : emptyForm()));

  const handleChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.exerciseName.trim()) {
      toast.error('El nombre del ejercicio es requerido');
      return;
    }

    setLoading(true);
    try {
      // Al corregir, un campo vaciado se envía como null para borrarlo de verdad
      const empty = isEdit ? null : undefined;
      const payload = {
        date: form.date ? localNoonISO(form.date) : undefined,
        exerciseName: form.exerciseName,
        category: form.category,
        sets: form.sets ? parseInt(form.sets) : empty,
        reps: form.reps ? parseInt(form.reps) : empty,
        weight: form.weight ? parseFloat(form.weight) : empty,
        rpe: form.rpe ? parseInt(form.rpe) : empty,
        notes: form.notes || (isEdit ? '' : undefined),
      };

      if (record) {
        await api.put(`/exercises/${record._id}`, payload);
        toast.success('Ejercicio actualizado');
      } else {
        await api.post('/exercises', { patient: patientId, ...payload });
        toast.success('Ejercicio registrado exitosamente');
        setForm(emptyForm());
      }
      onSuccess();
    } catch (err: unknown) {
      showApiError(err, isEdit ? 'Error al actualizar el ejercicio' : 'Error al registrar ejercicio');
    } finally {
      setLoading(false);
    }
  };

  const fields = (
    <>
          <div className="space-y-1 max-w-[200px]">
            <Label className="text-xs">Fecha</Label>
            <Input type="date" max={todayLocal()} value={form.date} onChange={(e) => handleChange('date', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Ejercicio *</Label>
              <Input
                value={form.exerciseName}
                onChange={(e) => handleChange('exerciseName', e.target.value)}
                placeholder="Ej: Sentadilla"
                required
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Categoría</Label>
              <Select value={form.category} onValueChange={(v) => handleChange('category', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Series</Label>
              <Input type="number" value={form.sets} onChange={(e) => handleChange('sets', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Reps</Label>
              <Input type="number" value={form.reps} onChange={(e) => handleChange('reps', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Peso (kg)</Label>
              <Input type="number" step="0.5" value={form.weight} onChange={(e) => handleChange('weight', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">RPE (1-10)</Label>
              <Input type="number" min="1" max="10" value={form.rpe} onChange={(e) => handleChange('rpe', e.target.value)} />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Notas</Label>
            <Textarea value={form.notes} onChange={(e) => handleChange('notes', e.target.value)} />
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            {isEdit ? 'Guardar cambios' : 'Registrar Ejercicio'}
          </Button>
    </>
  );

  if (embedded) {
    return <form onSubmit={handleSubmit} className="space-y-4">{fields}</form>;
  }

  return (
    <form onSubmit={handleSubmit}>
      <Card>
        <CardHeader><CardTitle className="text-lg">Nuevo Ejercicio</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {fields}
        </CardContent>
      </Card>
    </form>
  );
};

export default ExerciseForm;
