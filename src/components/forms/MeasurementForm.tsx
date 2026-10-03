import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { showApiError } from '@/lib/apiError';
import { Loader2 } from 'lucide-react';
import api from '@/lib/api';
import { todayLocal, localNoonISO } from '@/lib/evolutionDate';
import type { Measurement } from '@/types';

interface MeasurementFormProps {
  patientId: string;
  onSuccess: () => void;
  // Sin tarjeta propia: para mostrarlo dentro de un diálogo
  embedded?: boolean;
  // Si viene, el formulario corrige esa medición en vez de crear una nueva
  record?: Measurement;
}

const PERIMETER_FIELDS = ['shoulders', 'neck', 'chest', 'waist', 'hips', 'bicepLeft', 'bicepRight', 'thighLeft', 'thighRight', 'calfLeft', 'calfRight', 'forearmLeft', 'forearmRight'] as const;
const JUMP_FIELDS = ['cmj', 'sj', 'cmjLeftLeg', 'cmjRightLeg', 'sjLeftLeg', 'sjRightLeg', 'dropJump', 'abalakov', 'horizontalJump'] as const;

const emptyForm = () => ({
  date: todayLocal(),
  weight: '', height: '', bodyFatPercentage: '', muscleMassPercentage: '',
  shoulders: '', neck: '', chest: '', waist: '', hips: '',
  bicepLeft: '', bicepRight: '', thighLeft: '', thighRight: '', calfLeft: '', calfRight: '',
  forearmLeft: '', forearmRight: '', notes: '',
  cmj: '', sj: '', cmjLeftLeg: '', cmjRightLeg: '',
  sjLeftLeg: '', sjRightLeg: '', dropJump: '', abalakov: '', horizontalJump: '',
});

const text = (value?: number | null) => (value === undefined || value === null ? '' : String(value));

const formFromRecord = (m: Measurement) => {
  const form = emptyForm();
  form.date = format(parseISO(m.date), 'yyyy-MM-dd');
  form.weight = text(m.weight);
  form.height = text(m.height);
  form.bodyFatPercentage = text(m.bodyFatPercentage);
  form.muscleMassPercentage = text(m.muscleMassPercentage);
  form.notes = m.notes ?? '';
  PERIMETER_FIELDS.forEach((f) => { form[f] = text(m.perimeters?.[f]); });
  JUMP_FIELDS.forEach((f) => { form[f] = text(m.jumpTests?.[f]); });
  return form;
};

const MeasurementForm = ({ patientId, onSuccess, embedded = false, record }: MeasurementFormProps) => {
  const isEdit = !!record;
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState(() => (record ? formFromRecord(record) : emptyForm()));

  const handleChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      // Al corregir, un campo vaciado se envía como null para borrarlo de verdad;
      // al crear, simplemente no se envía.
      const num = (v: string) => (v ? parseFloat(v) : isEdit ? null : undefined);

      const perimeters: Record<string, number | null> = {};
      PERIMETER_FIELDS.forEach((f) => {
        const value = num(form[f]);
        if (value !== undefined) perimeters[f] = value;
      });

      const jumpTests: Record<string, number | null> = {};
      JUMP_FIELDS.forEach((f) => {
        const value = num(form[f]);
        if (value !== undefined) jumpTests[f] = value;
      });

      const payload = {
        date: form.date ? localNoonISO(form.date) : undefined,
        perimeters,
        jumpTests,
        weight: num(form.weight),
        height: num(form.height),
        bodyFatPercentage: num(form.bodyFatPercentage),
        muscleMassPercentage: num(form.muscleMassPercentage),
        notes: form.notes || (isEdit ? '' : undefined),
      };

      if (record) {
        await api.put(`/measurements/${record._id}`, payload);
        toast.success('Medición actualizada');
      } else {
        await api.post('/measurements', { patient: patientId, ...payload });
        toast.success('Medición registrada exitosamente');
        setForm(emptyForm());
      }
      onSuccess();
    } catch (err: unknown) {
      showApiError(err, isEdit ? 'Error al actualizar la medición' : 'Error al registrar medición');
    } finally {
      setLoading(false);
    }
  };

  const fields = (
    <>
          <div className="space-y-1 max-w-[200px]">
            <Label className="text-xs">Fecha de la medición</Label>
            <Input type="date" max={todayLocal()} value={form.date} onChange={(e) => handleChange('date', e.target.value)} />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Peso (kg)</Label>
              <Input type="number" step="0.1" value={form.weight} onChange={(e) => handleChange('weight', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Altura (cm)</Label>
              <Input type="number" step="0.1" value={form.height} onChange={(e) => handleChange('height', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">% Grasa</Label>
              <Input type="number" step="0.1" value={form.bodyFatPercentage} onChange={(e) => handleChange('bodyFatPercentage', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">% Músculo</Label>
              <Input type="number" step="0.1" value={form.muscleMassPercentage} onChange={(e) => handleChange('muscleMassPercentage', e.target.value)} />
            </div>
          </div>

          <h4 className="text-sm font-medium pt-2">Perímetros (cm)</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { key: 'shoulders', label: 'Hombros' },
              { key: 'neck', label: 'Cuello' },
              { key: 'chest', label: 'Pecho' },
              { key: 'waist', label: 'Cintura' },
              { key: 'hips', label: 'Cadera' },
              { key: 'bicepLeft', label: 'Bícep Izq' },
              { key: 'bicepRight', label: 'Bícep Der' },
              { key: 'thighLeft', label: 'Muslo Izq' },
              { key: 'thighRight', label: 'Muslo Der' },
              { key: 'calfLeft', label: 'Pantorrilla Izq' },
              { key: 'calfRight', label: 'Pantorrilla Der' },
              { key: 'forearmLeft', label: 'Antebrazo Izq' },
              { key: 'forearmRight', label: 'Antebrazo Der' },
            ].map(({ key, label }) => (
              <div key={key} className="space-y-1">
                <Label className="text-xs">{label}</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={form[key as keyof typeof form]}
                  onChange={(e) => handleChange(key, e.target.value)}
                />
              </div>
            ))}
          </div>

          <h4 className="text-sm font-medium pt-2">Tests de Salto (cm)</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { key: 'cmj', label: 'CMJ' },
              { key: 'sj', label: 'SJ' },
              { key: 'cmjLeftLeg', label: 'CMJ Unipod. Izq' },
              { key: 'cmjRightLeg', label: 'CMJ Unipod. Der' },
              { key: 'sjLeftLeg', label: 'SJ Unipod. Izq' },
              { key: 'sjRightLeg', label: 'SJ Unipod. Der' },
              { key: 'dropJump', label: 'Drop Jump' },
              { key: 'abalakov', label: 'Abalakov' },
              { key: 'horizontalJump', label: 'Salto Horizontal' },
            ].map(({ key, label }) => (
              <div key={key} className="space-y-1">
                <Label className="text-xs">{label}</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={form[key as keyof typeof form]}
                  onChange={(e) => handleChange(key, e.target.value)}
                />
              </div>
            ))}
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Notas</Label>
            <Textarea value={form.notes} onChange={(e) => handleChange('notes', e.target.value)} />
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            {isEdit ? 'Guardar cambios' : 'Registrar Medición'}
          </Button>
    </>
  );

  if (embedded) {
    return <form onSubmit={handleSubmit} className="space-y-4">{fields}</form>;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-lg">Nueva Medición</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {fields}
        </CardContent>
      </Card>
    </form>
  );
};

export default MeasurementForm;
