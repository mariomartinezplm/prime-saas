import { useCallback, useEffect, useRef, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { FormField, NumberField } from '@/components/forms/FormField';
import SubmitButton from '@/components/forms/SubmitButton';
import ExercisePicker from '@/components/forms/ExercisePicker';
import { exerciseService, type ExerciseSummary, type LibraryExercise } from '@/services/exerciseService';
import { exactExercise, lastRecordText } from '@/lib/exercisePicker';
import { useUnsavedChangesWarning } from '@/hooks/useUnsavedChangesWarning';
import { notify } from '@/lib/notify';
import { showApiError } from '@/lib/apiError';
import api from '@/lib/api';
import { todayLocal, localNoonISO } from '@/lib/evolutionDate';
import { numberRangeError } from '@/lib/validation';
import { toNumber } from '@/lib/decimal';
import type { ExerciseProgress } from '@/types';

interface ExerciseFormProps {
  patientId: string;
  onSuccess: () => void;
  // Sin tarjeta propia: para mostrarlo dentro de un diálogo
  embedded?: boolean;
  // Si viene, el formulario corrige ese registro en vez de crear uno nuevo
  record?: ExerciseProgress;
  // Para registrar un nuevo peso en un ejercicio que ya está en el historial: se completan su nombre y categoría y el cursor va al peso.
  // `nonce` cambia cada vez que se pide, así volver a elegir el mismo ejercicio también funciona.
  prefill?: { name: string; category: string; nonce: number };
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
type FormState = ReturnType<typeof emptyForm>;
type Errors = Partial<Record<keyof FormState, string>>;

const text = (value?: number | null) => (value === undefined || value === null ? '' : String(value));

const formFromRecord = (e: ExerciseProgress): FormState => ({
  date: format(parseISO(e.date), 'yyyy-MM-dd'),
  exerciseName: e.exerciseName,
  category: e.category,
  sets: text(e.sets),
  reps: text(e.reps),
  weight: text(e.weight),
  rpe: text(e.rpe),
  notes: e.notes ?? '',
});

const integerError = (value: string, min: number, max: number): string | undefined =>
  numberRangeError(value, min, max) ?? (value.trim() && !Number.isInteger(Number(value)) ? 'Ingresa un número entero' : undefined);

function validate(form: FormState): Errors {
  const errors: Errors = {};
  if (!form.date) errors.date = 'Indica la fecha';
  else if (form.date > todayLocal()) errors.date = 'La fecha no puede ser futura';
  if (!form.exerciseName.trim()) errors.exerciseName = 'Ingresa el nombre del ejercicio';
  else if (form.exerciseName.trim().length > 80) errors.exerciseName = 'Máximo 80 caracteres';
  const sets = integerError(form.sets, 1, 50);
  if (sets) errors.sets = sets;
  const reps = integerError(form.reps, 1, 1000);
  if (reps) errors.reps = reps;
  const weight = numberRangeError(form.weight, 0, 1000, ' kg');
  if (weight) errors.weight = weight;
  const rpe = integerError(form.rpe, 1, 10);
  if (rpe) errors.rpe = rpe;
  return errors;
}

const ExerciseForm = ({ patientId, onSuccess, embedded = false, record, prefill }: ExerciseFormProps) => {
  const isEdit = !!record;
  const formRef = useRef<HTMLFormElement>(null);
  const submittingRef = useRef(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [form, setForm] = useState<FormState>(() => (record ? formFromRecord(record) : emptyForm()));
  // Ejercicios que la persona ya tiene registrados: se ofrecen en una lista para no escribirlos de nuevo (si no cargan, se escribe como siempre)
  const [options, setOptions] = useState<ExerciseSummary[]>([]);
  const [library, setLibrary] = useState<LibraryExercise[]>([]);
  const loadOptions = useCallback(() => {
    if (isEdit) return;
    exerciseService.getSummary(patientId).then(setOptions).catch(() => setOptions([]));
    exerciseService.getLibrary().then(setLibrary).catch(() => setLibrary([]));
  }, [patientId, isEdit]);
  useEffect(loadOptions, [loadOptions]);

  const dirty = !isEdit && JSON.stringify(form) !== JSON.stringify(emptyForm());
  useUnsavedChangesWarning(dirty && !loading);

  const set = (field: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  // Elegir un ejercicio de la lista: se completan su nombre (con la misma escritura de siempre) y su categoría, y el cursor pasa al peso
  const pickExercise = (o: ExerciseSummary | LibraryExercise) => {
    setForm((prev) => ({ ...prev, exerciseName: o.name, category: CATEGORIES.some((c) => c.value === o.category) ? o.category : prev.category }));
    setErrors((prev) => ({ ...prev, exerciseName: undefined }));
    requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>('input[data-step="0.5"]')?.focus());
  };
  const matched = isEdit ? undefined : exactExercise(options, form.exerciseName);

  useEffect(() => {
    if (!prefill || isEdit) return;
    setForm((prev) => ({ ...prev, exerciseName: prefill.name, category: CATEGORIES.some((c) => c.value === prefill.category) ? prefill.category : prev.category }));
    setErrors((prev) => ({ ...prev, exerciseName: undefined }));
    formRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
    requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>('input[data-step="0.5"]')?.focus());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefill?.nonce]);

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
      // Al corregir, un campo vaciado se envía como null para borrarlo de verdad
      const empty = isEdit ? null : undefined;
      const payload = {
        date: form.date ? localNoonISO(form.date) : undefined,
        exerciseName: form.exerciseName.trim(),
        category: form.category,
        sets: form.sets ? parseInt(form.sets, 10) : empty,
        reps: form.reps ? parseInt(form.reps, 10) : empty,
        weight: toNumber(form.weight) ?? empty,
        rpe: form.rpe ? parseInt(form.rpe, 10) : empty,
        notes: form.notes.trim() || (isEdit ? '' : undefined),
      };

      if (record) {
        await api.put(`/exercises/${record._id}`, payload);
        notify.success('Ejercicio actualizado');
      } else {
        await api.post('/exercises', { patient: patientId, ...payload });
        notify.success('Ejercicio registrado');
        setForm(emptyForm());
        loadOptions(); // el ejercicio recién registrado ya aparece en la lista
      }
      onSuccess();
    } catch (err: unknown) {
      // Si falla se conserva todo lo escrito para reintentar
      showApiError(err, isEdit ? 'No se pudo actualizar el ejercicio' : 'No se pudo registrar el ejercicio. Tus datos siguen aquí.');
    } finally {
      submittingRef.current = false;
      setLoading(false);
    }
  };

  const fields = (
    <>
      <FormField label="Fecha" required error={errors.date} className="max-w-[220px]">
        {(c) => <Input {...c} type="date" max={todayLocal()} value={form.date} onChange={(e) => set('date', e.target.value)} />}
      </FormField>

      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="Ejercicio" required error={errors.exerciseName} hint={matched ? `Ya registrado · Último: ${lastRecordText(matched)}` : undefined}>
          {(c) => isEdit
            ? <Input {...c} autoComplete="off" placeholder="Ej: Sentadilla" value={form.exerciseName} onChange={(e) => set('exerciseName', e.target.value)} />
            : <ExercisePicker control={c} value={form.exerciseName} onChange={(v) => set('exerciseName', v)} options={options} library={library} onPick={pickExercise} />}
        </FormField>
        <FormField label="Categoría">
          {(c) => (
            <Select value={form.category} onValueChange={(v) => set('category', v)}>
              <SelectTrigger id={c.id}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </FormField>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <NumberField label="Series" step="1" value={form.sets} onChange={(v) => set('sets', v)} error={errors.sets} placeholder={matched?.last.sets ? String(matched.last.sets) : undefined} />
        <NumberField label="Repeticiones" step="1" value={form.reps} onChange={(v) => set('reps', v)} error={errors.reps} placeholder={matched?.last.reps ? String(matched.last.reps) : undefined} />
        <NumberField label="Peso" unit="kg" step="0.5" value={form.weight} onChange={(v) => set('weight', v)} error={errors.weight} />
        <NumberField label="RPE" unit="1 a 10" step="1" value={form.rpe} onChange={(v) => set('rpe', v)} error={errors.rpe} />
      </div>

      <FormField label="Notas">{(c) => <Textarea {...c} value={form.notes} onChange={(e) => set('notes', e.target.value)} />}</FormField>

      <SubmitButton className="w-full" loading={loading} loadingLabel={isEdit ? 'Guardando…' : 'Registrando…'}>
        {isEdit ? 'Guardar cambios' : 'Registrar ejercicio'}
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
    <form ref={formRef} onSubmit={handleSubmit} noValidate>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Nuevo ejercicio</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">{fields}</CardContent>
      </Card>
    </form>
  );
};

export default ExerciseForm;
