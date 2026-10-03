import { useState } from 'react';
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

interface ExerciseFormProps {
  patientId: string;
  onSuccess: () => void;
  // Sin tarjeta propia: para mostrarlo dentro de un diálogo
  embedded?: boolean;
}

const CATEGORIES = [
  { value: 'fuerza', label: 'Fuerza' },
  { value: 'cardio', label: 'Cardio' },
  { value: 'flexibilidad', label: 'Flexibilidad' },
  { value: 'funcional', label: 'Funcional' },
  { value: 'rehabilitacion', label: 'Rehabilitación' },
  { value: 'otro', label: 'Otro' },
];

const ExerciseForm = ({ patientId, onSuccess, embedded = false }: ExerciseFormProps) => {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    date: todayLocal(),
    exerciseName: '',
    category: 'fuerza',
    sets: '',
    reps: '',
    weight: '',
    rpe: '',
    notes: '',
  });

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
      await api.post('/exercises', {
        patient: patientId,
        date: form.date ? localNoonISO(form.date) : undefined,
        exerciseName: form.exerciseName,
        category: form.category,
        sets: form.sets ? parseInt(form.sets) : undefined,
        reps: form.reps ? parseInt(form.reps) : undefined,
        weight: form.weight ? parseFloat(form.weight) : undefined,
        rpe: form.rpe ? parseInt(form.rpe) : undefined,
        notes: form.notes || undefined,
      });

      toast.success('Ejercicio registrado exitosamente');
      setForm({ date: todayLocal(), exerciseName: '', category: 'fuerza', sets: '', reps: '', weight: '', rpe: '', notes: '' });
      onSuccess();
    } catch (err: unknown) {
      showApiError(err, 'Error al registrar ejercicio');
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
            Registrar Ejercicio
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
