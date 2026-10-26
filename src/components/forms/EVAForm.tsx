import { useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { notify } from '@/lib/notify';
import { showApiError } from '@/lib/apiError';
import api from '@/lib/api';
import { FormField } from '@/components/forms/FormField';
import SubmitButton from '@/components/forms/SubmitButton';
import { useUnsavedChangesWarning } from '@/hooks/useUnsavedChangesWarning';
import PainBodyDiagram from '@/components/body/PainBodyDiagram';
import { Input } from '@/components/ui/input';
import { todayLocal, localNoonISO } from '@/lib/evolutionDate';
import { BODY_ZONE_GEOMETRY } from '@/lib/bodyZones';

interface EVAFormProps {
  patientId: string;
  onSuccess: () => void;
}

// Zonas elegibles: las mismas del mapa (y del servidor)
const BODY_AREAS = BODY_ZONE_GEOMETRY.map((z) => ({ id: z.id, label: z.label }));

const PAIN_TYPES = [
  'punzante', 'quemante', 'opresivo', 'pulsátil',
  'sordo', 'irradiado', 'hormigueo', 'entumecimiento',
  'calambre', 'rigidez',
];

const EVAForm = ({ patientId, onSuccess }: EVAFormProps) => {
  const formRef = useRef<HTMLFormElement>(null);
  const submittingRef = useRef(false);
  const [loading, setLoading] = useState(false);
  const [zoneError, setZoneError] = useState<string | undefined>();
  const [dateError, setDateError] = useState<string | undefined>();
  const [date, setDate] = useState(todayLocal());
  const [painLevel, setPainLevel] = useState(0);
  const [bodyArea, setBodyArea] = useState('');
  const [painType, setPainType] = useState('');
  const [duration, setDuration] = useState('');
  const [observations, setObservations] = useState('');
  const [treatmentPlan, setTreatmentPlan] = useState('');

  // Hay datos escritos que todavía no se guardaron
  const dirty = !!(bodyArea || painType || duration || observations || treatmentPlan || painLevel > 0 || date !== todayLocal());
  useUnsavedChangesWarning(dirty && !loading);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingRef.current) return;

    const zone = !bodyArea ? 'Elige una zona del cuerpo: tócala en el mapa o búscala en la lista' : undefined;
    const when = !date ? 'Indica la fecha del registro' : date > todayLocal() ? 'La fecha no puede ser futura' : undefined;
    setZoneError(zone);
    setDateError(when);
    if (zone || when) {
      requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
      return;
    }

    submittingRef.current = true;
    setLoading(true);
    try {
      await api.post('/eva', {
        patient: patientId,
        date: date ? localNoonISO(date) : undefined,
        painLevel,
        bodyArea: bodyArea || 'otro',
        painType: painType ? [painType] : [],
        duration: duration || undefined,
        observations: observations || undefined,
        treatmentPlan: treatmentPlan || undefined,
      });

      notify.success('Registro de dolor guardado');
      setDate(todayLocal());
      setPainLevel(0);
      setBodyArea('');
      setPainType('');
      setDuration('');
      setObservations('');
      setTreatmentPlan('');
      onSuccess();
    } catch (err: unknown) {
      // Si falla se conserva todo lo escrito para reintentar
      showApiError(err, 'No se pudo guardar el registro de dolor. Tus datos siguen aquí.');
    } finally {
      submittingRef.current = false;
      setLoading(false);
    }
  };

  const getPainColor = (level: number) => {
    if (level <= 3) return 'text-success';
    if (level <= 6) return 'text-warning';
    return 'text-destructive';
  };

  return (
    <form ref={formRef} onSubmit={handleSubmit} noValidate>
      <Card>
        <CardHeader><CardTitle className="text-lg">Nuevo registro de dolor (EVA)</CardTitle></CardHeader>
        <CardContent className="space-y-6">
          <FormField label="Fecha del registro" required error={dateError} className="max-w-[220px]">
            {(c) => <Input {...c} type="date" max={todayLocal()} value={date} onChange={(e) => { setDate(e.target.value); setDateError(undefined); }} />}
          </FormField>

          {/* Pain level slider */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label id="eva-pain-label">Nivel de dolor</Label>
              <span className={`text-2xl font-bold ${getPainColor(painLevel)}`}>
                {painLevel}/10
              </span>
            </div>
            <Slider
              aria-labelledby="eva-pain-label"
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

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Zona del cuerpo" required error={zoneError}>
              {(c) => (
              <Select value={bodyArea} onValueChange={(v) => { setBodyArea(v); setZoneError(undefined); }}>
                <SelectTrigger id={c.id} aria-invalid={c['aria-invalid']} aria-describedby={c['aria-describedby']}><SelectValue placeholder="Elegir de la lista (o tócala en el mapa)" /></SelectTrigger>
                <SelectContent>
                  {BODY_AREAS.map((area) => (
                    <SelectItem key={area.id} value={area.id}>{area.label}</SelectItem>
                  ))}
                  <SelectItem value="otro">Otra zona</SelectItem>
                </SelectContent>
              </Select>
              )}
            </FormField>

            <FormField label="Tipo de dolor">
              {(c) => (
              <Select value={painType} onValueChange={setPainType}>
                <SelectTrigger id={c.id}><SelectValue placeholder="Seleccionar tipo" /></SelectTrigger>
                <SelectContent>
                  {PAIN_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              )}
            </FormField>
          </div>

          <FormField label="Duración">
            {(c) => (
            <Select value={duration} onValueChange={setDuration}>
              <SelectTrigger id={c.id}><SelectValue placeholder="Seleccionar" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="agudo">Agudo (menos de 6 semanas)</SelectItem>
                <SelectItem value="subagudo">Subagudo (6-12 semanas)</SelectItem>
                <SelectItem value="cronico">Crónico (más de 12 semanas)</SelectItem>
              </SelectContent>
            </Select>
            )}
          </FormField>

          <div className="space-y-4 border-t pt-4">
            <Label>Mapa del cuerpo (toca la zona del dolor)</Label>
            <div className="border border-border rounded-xl p-4 bg-muted/20">
              <PainBodyDiagram selectedZone={bodyArea !== 'otro' ? bodyArea : null} onZoneClick={(z) => { setBodyArea(z); setZoneError(undefined); }} />
            </div>
          </div>

          <FormField label="Notas y observaciones">
            {(c) => <Textarea {...c} value={observations} onChange={(e) => setObservations(e.target.value)} />}
          </FormField>

          <FormField label="Plan de tratamiento">
            {(c) => <Textarea {...c} value={treatmentPlan} onChange={(e) => setTreatmentPlan(e.target.value)} />}
          </FormField>

          <SubmitButton className="w-full" loading={loading} loadingLabel="Guardando…">
            Registrar dolor
          </SubmitButton>
        </CardContent>
      </Card>
    </form>
  );
};

export default EVAForm;
