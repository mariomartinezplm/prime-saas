import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import api from '@/lib/api';

interface MeasurementFormProps {
  patientId: string;
  onSuccess: () => void;
}

const MeasurementForm = ({ patientId, onSuccess }: MeasurementFormProps) => {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    weight: '',
    height: '',
    bodyFatPercentage: '',
    muscleMassPercentage: '',
    chest: '',
    waist: '',
    hips: '',
    bicepLeft: '',
    bicepRight: '',
    thighLeft: '',
    thighRight: '',
    calfLeft: '',
    calfRight: '',
    forearmLeft: '',
    forearmRight: '',
    notes: '',
  });

  const handleChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const perimeters: Record<string, number> = {};
      const perimeterFields = ['chest', 'waist', 'hips', 'bicepLeft', 'bicepRight', 'thighLeft', 'thighRight', 'calfLeft', 'calfRight', 'forearmLeft', 'forearmRight'];
      perimeterFields.forEach((f) => {
        if (form[f as keyof typeof form]) {
          perimeters[f] = parseFloat(form[f as keyof typeof form]);
        }
      });

      await api.post('/measurements', {
        patient: patientId,
        perimeters,
        weight: form.weight ? parseFloat(form.weight) : undefined,
        height: form.height ? parseFloat(form.height) : undefined,
        bodyFatPercentage: form.bodyFatPercentage ? parseFloat(form.bodyFatPercentage) : undefined,
        muscleMassPercentage: form.muscleMassPercentage ? parseFloat(form.muscleMassPercentage) : undefined,
        notes: form.notes || undefined,
      });

      toast.success('Medición registrada exitosamente');
      setForm({
        weight: '', height: '', bodyFatPercentage: '', muscleMassPercentage: '',
        chest: '', waist: '', hips: '', bicepLeft: '', bicepRight: '',
        thighLeft: '', thighRight: '', calfLeft: '', calfRight: '',
        forearmLeft: '', forearmRight: '', notes: '',
      });
      onSuccess();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      toast.error(error.response?.data?.message || 'Error al registrar medición');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-lg">Nueva Medición</CardTitle></CardHeader>
        <CardContent className="space-y-4">
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

          <div className="space-y-1">
            <Label className="text-xs">Notas</Label>
            <Textarea value={form.notes} onChange={(e) => handleChange('notes', e.target.value)} />
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Registrar Medición
          </Button>
        </CardContent>
      </Card>
    </form>
  );
};

export default MeasurementForm;
