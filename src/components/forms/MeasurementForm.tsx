import { useRef, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { TriangleAlert } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { FormField, NumberField } from '@/components/forms/FormField';
import SubmitButton from '@/components/forms/SubmitButton';
import { useUnsavedChangesWarning } from '@/hooks/useUnsavedChangesWarning';
import { notify } from '@/lib/notify';
import { showApiError } from '@/lib/apiError';
import api from '@/lib/api';
import { todayLocal, localNoonISO } from '@/lib/evolutionDate';
import { numberRangeError } from '@/lib/validation';
import type { Measurement } from '@/types';

interface MeasurementFormProps {
  patientId: string;
  onSuccess: () => void;
  // Sin tarjeta propia: para mostrarlo dentro de un diálogo
  embedded?: boolean;
  // Si viene, el formulario corrige esa medición en vez de crear una nueva
  record?: Measurement;
}

// Rangos pensados para atrapar errores de tipeo (700 kg, 1700 cm), no para limitar casos reales.
const GENERAL_FIELDS = [
  { key: 'weight', label: 'Peso', unit: 'kg', min: 20, max: 400 },
  { key: 'height', label: 'Altura', unit: 'cm', min: 50, max: 250 },
  { key: 'bodyFatPercentage', label: '% Grasa', unit: '', min: 1, max: 80 },
  { key: 'muscleMassPercentage', label: '% Músculo', unit: '', min: 1, max: 90 },
] as const;

const PERIMETER_FIELDS = [
  { key: 'shoulders', label: 'Hombros' },
  { key: 'neck', label: 'Cuello' },
  { key: 'chest', label: 'Pecho' },
  { key: 'waist', label: 'Cintura' },
  { key: 'hips', label: 'Cadera' },
  { key: 'bicepLeft', label: 'Bícep izq.' },
  { key: 'bicepRight', label: 'Bícep der.' },
  { key: 'thighLeft', label: 'Muslo izq.' },
  { key: 'thighRight', label: 'Muslo der.' },
  { key: 'calfLeft', label: 'Pantorrilla izq.' },
  { key: 'calfRight', label: 'Pantorrilla der.' },
  { key: 'forearmLeft', label: 'Antebrazo izq.' },
  { key: 'forearmRight', label: 'Antebrazo der.' },
] as const;

const JUMP_FIELDS = [
  { key: 'cmj', label: 'CMJ' },
  { key: 'sj', label: 'SJ' },
  { key: 'cmjLeftLeg', label: 'CMJ unipodal izq.' },
  { key: 'cmjRightLeg', label: 'CMJ unipodal der.' },
  { key: 'sjLeftLeg', label: 'SJ unipodal izq.' },
  { key: 'sjRightLeg', label: 'SJ unipodal der.' },
  { key: 'dropJump', label: 'Drop jump' },
  { key: 'abalakov', label: 'Abalakov' },
  { key: 'horizontalJump', label: 'Salto horizontal' },
] as const;

const emptyForm = () => ({
  date: todayLocal(),
  weight: '', height: '', bodyFatPercentage: '', muscleMassPercentage: '',
  shoulders: '', neck: '', chest: '', waist: '', hips: '',
  bicepLeft: '', bicepRight: '', thighLeft: '', thighRight: '', calfLeft: '', calfRight: '',
  forearmLeft: '', forearmRight: '', notes: '',
  cmj: '', sj: '', cmjLeftLeg: '', cmjRightLeg: '',
  sjLeftLeg: '', sjRightLeg: '', dropJump: '', abalakov: '', horizontalJump: '',
});
type FormState = ReturnType<typeof emptyForm>;
type Errors = Partial<Record<keyof FormState | 'general', string>>;

const text = (value?: number | null) => (value === undefined || value === null ? '' : String(value));

const formFromRecord = (m: Measurement): FormState => {
  const form = emptyForm();
  form.date = format(parseISO(m.date), 'yyyy-MM-dd');
  form.weight = text(m.weight);
  form.height = text(m.height);
  form.bodyFatPercentage = text(m.bodyFatPercentage);
  form.muscleMassPercentage = text(m.muscleMassPercentage);
  form.notes = m.notes ?? '';
  PERIMETER_FIELDS.forEach(({ key }) => { form[key] = text(m.perimeters?.[key]); });
  JUMP_FIELDS.forEach(({ key }) => { form[key] = text(m.jumpTests?.[key]); });
  return form;
};

function validate(form: FormState): Errors {
  const errors: Errors = {};
  if (!form.date) errors.date = 'Indica la fecha de la medición';
  else if (form.date > todayLocal()) errors.date = 'La fecha no puede ser futura';

  GENERAL_FIELDS.forEach(({ key, min, max, unit }) => {
    const message = numberRangeError(form[key], min, max, unit ? ` ${unit}` : '');
    if (message) errors[key] = message;
  });
  PERIMETER_FIELDS.forEach(({ key }) => {
    const message = numberRangeError(form[key], 5, 250, ' cm');
    if (message) errors[key] = message;
  });
  JUMP_FIELDS.forEach(({ key }) => {
    const message = numberRangeError(form[key], 1, 300, ' cm');
    if (message) errors[key] = message;
  });

  const numericKeys = [...GENERAL_FIELDS, ...PERIMETER_FIELDS, ...JUMP_FIELDS].map((f) => f.key);
  if (!numericKeys.some((k) => form[k].trim() !== '') && !form.notes.trim()) {
    errors.general = 'Ingresa al menos un dato (peso, un perímetro, un test…) para guardar la medición.';
  }
  return errors;
}

const MeasurementForm = ({ patientId, onSuccess, embedded = false, record }: MeasurementFormProps) => {
  const isEdit = !!record;
  const formRef = useRef<HTMLFormElement>(null);
  const submittingRef = useRef(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [form, setForm] = useState<FormState>(() => (record ? formFromRecord(record) : emptyForm()));

  const dirty = !isEdit && JSON.stringify(form) !== JSON.stringify(emptyForm());
  useUnsavedChangesWarning(dirty && !loading);

  const set = (field: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field] || errors.general) setErrors((prev) => ({ ...prev, [field]: undefined, general: undefined }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingRef.current) return;

    const found = validate(form);
    if (Object.keys(found).length > 0) {
      setErrors(found);
      requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
      return;
    }

    submittingRef.current = true;
    setLoading(true);
    try {
      // Al corregir, un campo vaciado se envía como null para borrarlo de verdad;
      // al crear, simplemente no se envía.
      const num = (v: string) => (v ? parseFloat(v.replace(',', '.')) : isEdit ? null : undefined);

      const perimeters: Record<string, number | null> = {};
      PERIMETER_FIELDS.forEach(({ key }) => {
        const value = num(form[key]);
        if (value !== undefined) perimeters[key] = value;
      });

      const jumpTests: Record<string, number | null> = {};
      JUMP_FIELDS.forEach(({ key }) => {
        const value = num(form[key]);
        if (value !== undefined) jumpTests[key] = value;
      });

      const payload = {
        date: form.date ? localNoonISO(form.date) : undefined,
        perimeters,
        jumpTests,
        weight: num(form.weight),
        height: num(form.height),
        bodyFatPercentage: num(form.bodyFatPercentage),
        muscleMassPercentage: num(form.muscleMassPercentage),
        notes: form.notes.trim() || (isEdit ? '' : undefined),
      };

      if (record) {
        await api.put(`/measurements/${record._id}`, payload);
        notify.success('Medición actualizada');
      } else {
        await api.post('/measurements', { patient: patientId, ...payload });
        notify.success('Medición registrada');
        setForm(emptyForm());
      }
      onSuccess();
    } catch (err: unknown) {
      // Si falla se conserva todo lo escrito para reintentar
      showApiError(err, isEdit ? 'No se pudo actualizar la medición' : 'No se pudo registrar la medición. Tus datos siguen aquí.');
    } finally {
      submittingRef.current = false;
      setLoading(false);
    }
  };

  const numberGrid = (fields: ReadonlyArray<{ key: keyof FormState; label: string }>, unit?: string) => (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {fields.map(({ key, label }) => (
        <NumberField key={key} label={label} unit={unit} value={form[key]} onChange={(v) => set(key, v)} error={errors[key]} />
      ))}
    </div>
  );

  const fields = (
    <>
      {errors.general && (
        <Alert variant="destructive">
          <TriangleAlert className="h-4 w-4" aria-hidden="true" />
          <AlertDescription>{errors.general}</AlertDescription>
        </Alert>
      )}

      <FormField label="Fecha de la medición" required error={errors.date} className="max-w-[220px]">
        {(c) => <Input {...c} type="date" max={todayLocal()} value={form.date} onChange={(e) => set('date', e.target.value)} />}
      </FormField>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {GENERAL_FIELDS.map(({ key, label, unit }) => (
          <NumberField key={key} label={label} unit={unit || undefined} value={form[key]} onChange={(v) => set(key, v)} error={errors[key]} />
        ))}
      </div>

      <fieldset className="space-y-3">
        <legend className="pt-2 text-sm font-medium">Perímetros (cm)</legend>
        {numberGrid(PERIMETER_FIELDS)}
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="pt-2 text-sm font-medium">Tests de salto (cm)</legend>
        {numberGrid(JUMP_FIELDS)}
      </fieldset>

      <FormField label="Notas">
        {(c) => <Textarea {...c} value={form.notes} onChange={(e) => set('notes', e.target.value)} />}
      </FormField>

      <SubmitButton className="w-full" loading={loading} loadingLabel={isEdit ? 'Guardando…' : 'Registrando…'}>
        {isEdit ? 'Guardar cambios' : 'Registrar medición'}
      </SubmitButton>
    </>
  );

  if (embedded) {
    return (
      <form ref={formRef} onSubmit={handleSubmit} noValidate className="space-y-4">
        {fields}
      </form>
    );
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} noValidate className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Nueva medición</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">{fields}</CardContent>
      </Card>
    </form>
  );
};

export default MeasurementForm;
