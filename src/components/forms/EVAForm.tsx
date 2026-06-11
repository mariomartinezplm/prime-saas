import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import api from '@/lib/api';
import PainBodyDiagram from '@/components/body/PainBodyDiagram';

interface EVAFormProps {
  patientId: string;
  onSuccess: () => void;
}

const BODY_AREAS = [
  'cabeza', 'cuello', 'hombro-izquierdo', 'hombro-derecho',
  'brazo-izquierdo', 'brazo-derecho', 'codo-izquierdo', 'codo-derecho',
  'muneca-izquierda', 'muneca-derecha', 'mano-izquierda', 'mano-derecha',
  'columna-cervical', 'columna-dorsal', 'columna-lumbar',
  'cadera-izquierda', 'cadera-derecha', 'rodilla-izquierda', 'rodilla-derecha',
  'tobillo-izquierdo', 'tobillo-derecho', 'pie-izquierdo', 'pie-derecho',
];

const PAIN_TYPES = [
  'punzante', 'quemante', 'opresivo', 'pulsátil',
  'sordo', 'irradiado', 'hormigueo', 'entumecimiento',
  'calambre', 'rigidez',
];

const EVAForm = ({ patientId, onSuccess }: EVAFormProps) => {
  const [loading, setLoading] = useState(false);
  const [painLevel, setPainLevel] = useState(0);
  const [bodyArea, setBodyArea] = useState('');
  const [painType, setPainType] = useState('');
  const [duration, setDuration] = useState('');
  const [observations, setObservations] = useState('');
  const [treatmentPlan, setTreatmentPlan] = useState('');
  const [selectedPoint, setSelectedPoint] = useState<{ x: number, y: number, gender: 'male' | 'female' } | null>(null);

  const handleMapClick = (x: number, y: number) => {
    setSelectedPoint({ x, y, gender: 'male' }); // The gender is handled by local state inside PainBodyDiagram now, but we can pass it later if needed.
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bodyArea && !selectedPoint) {
      toast.error('Selecciona una zona del cuerpo o pincha en el mapa');
      return;
    }

    setLoading(true);
    try {
      await api.post('/eva', {
        patient: patientId,
        painLevel,
        bodyArea: bodyArea || 'otro',
        painType: painType ? [painType] : [],
        duration: duration || undefined,
        observations: observations || undefined,
        treatmentPlan: treatmentPlan || undefined,
        point: selectedPoint || undefined,
      });

      toast.success('Registro EVA creado exitosamente');
      setPainLevel(0);
      setBodyArea('');
      setPainType('');
      setDuration('');
      setObservations('');
      setTreatmentPlan('');
      setSelectedPoint(null);
      onSuccess();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      toast.error(error.response?.data?.message || 'Error al registrar EVA');
    } finally {
      setLoading(false);
    }
  };

  const getPainColor = (level: number) => {
    if (level <= 3) return 'text-green-400';
    if (level <= 6) return 'text-yellow-400';
    return 'text-red-400';
  };

  return (
    <form onSubmit={handleSubmit}>
      <Card>
        <CardHeader><CardTitle className="text-lg">Nuevo Registro EVA</CardTitle></CardHeader>
        <CardContent className="space-y-6">
          {/* Pain level slider */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Nivel de Dolor</Label>
              <span className={`text-2xl font-bold ${getPainColor(painLevel)}`}>
                {painLevel}/10
              </span>
            </div>
            <Slider
              value={[painLevel]}
              onValueChange={(v) => setPainLevel(v[0])}
              max={10}
              step={1}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Sin dolor</span>
              <span>Dolor máximo</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Zona del cuerpo *</Label>
              <Select value={bodyArea} onValueChange={setBodyArea}>
                <SelectTrigger><SelectValue placeholder="Seleccionar zona (o pincha el mapa)" /></SelectTrigger>
                <SelectContent>
                  {BODY_AREAS.map((area) => (
                    <SelectItem key={area} value={area}>
                      {area.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </SelectItem>
                  ))}
                  <SelectItem value="otro">Otro (Punto en mapa)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Tipo de dolor</Label>
              <Select value={painType} onValueChange={setPainType}>
                <SelectTrigger><SelectValue placeholder="Seleccionar tipo" /></SelectTrigger>
                <SelectContent>
                  {PAIN_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Duración</Label>
            <Select value={duration} onValueChange={setDuration}>
              <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="agudo">Agudo (menos de 6 semanas)</SelectItem>
                <SelectItem value="subagudo">Subagudo (6-12 semanas)</SelectItem>
                <SelectItem value="cronico">Crónico (más de 12 semanas)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-4 border-t pt-4">
            <Label>Mapa de Dolor (Opcional - Selecciona el punto exacto)</Label>
            <div className="border border-border rounded-xl p-4 bg-muted/20">
              <PainBodyDiagram
                selectedZone={bodyArea !== 'otro' ? bodyArea : null}
                onZoneClick={setBodyArea}
                onMapClick={handleMapClick}
                selectedPoint={selectedPoint}
                gender={selectedPoint?.gender || 'male'}
                onGenderChange={(g) => {
                  if (selectedPoint) setSelectedPoint({ ...selectedPoint, gender: g });
                }}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Notas y Observaciones</Label>
            <Textarea value={observations} onChange={(e) => setObservations(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>Plan de tratamiento</Label>
            <Textarea value={treatmentPlan} onChange={(e) => setTreatmentPlan(e.target.value)} />
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Registrar EVA
          </Button>
        </CardContent>
      </Card>
    </form>
  );
};

export default EVAForm;
