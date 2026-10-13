import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, Dumbbell, Stethoscope, TriangleAlert } from 'lucide-react';
import { userService } from '@/services/userService';
import { clientPlanService } from '@/services/clientPlanService';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { FormField } from '@/components/forms/FormField';
import FormSection from '@/components/forms/FormSection';
import SubmitButton from '@/components/forms/SubmitButton';
import SessionsSelect from '@/components/plans/SessionsSelect';
import PlanTermFields from '@/components/plans/PlanTermFields';
import RenewsCheckbox from '@/components/plans/RenewsCheckbox';
import PageHeader from '@/components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  SERVICE_TYPE_LABELS,
  DEFAULT_CHOICE,
  choiceToPayload,
  type ServiceType,
  type SessionsChoice,
  type PlanTerm,
  type BillingCycle,
} from '@/config/planCatalog';
import { useUnsavedChangesWarning } from '@/hooks/useUnsavedChangesWarning';
import { showApiError } from '@/lib/apiError';
import { todayLocal } from '@/lib/evolutionDate';
import { notify } from '@/lib/notify';
import { isValidRut, normalizeRut } from '@/lib/rut';
import { birthDateError, isEmail, isPhone, parseLines } from '@/lib/validation';
import { cn } from '@/lib/utils';

type PlanInicialOption = ServiceType | 'despues';

const emptyForm = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  rut: '',
  dateOfBirth: '',
  address: '',
  emergencyName: '',
  emergencyPhone: '',
  emergencyRelationship: '',
  chronicConditions: '',
  allergies: '',
  injuries: '',
};
type FormState = typeof emptyForm;
type Errors = Partial<Record<keyof FormState, string>>;

const PLAN_OPTIONS = [
  { value: 'kinesiologia', label: SERVICE_TYPE_LABELS.kinesiologia, icon: Stethoscope },
  { value: 'entrenamiento', label: SERVICE_TYPE_LABELS.entrenamiento, icon: Dumbbell },
  { value: 'despues', label: 'Asignar después', icon: Clock },
] as const;

function validate(form: FormState): Errors {
  const errors: Errors = {};
  if (!form.firstName.trim()) errors.firstName = 'Ingresa el nombre';
  if (!form.lastName.trim()) errors.lastName = 'Ingresa el apellido';
  if (!form.email.trim()) errors.email = 'Ingresa el correo';
  else if (!isEmail(form.email)) errors.email = 'Ingresa un correo válido, por ejemplo nombre@correo.cl';
  if (form.rut.trim() && !isValidRut(form.rut)) errors.rut = 'RUT inválido: revisa los números y el dígito verificador';
  if (form.phone.trim() && !isPhone(form.phone)) errors.phone = 'Ingresa un teléfono válido, por ejemplo +56 9 1234 5678';
  const birth = birthDateError(form.dateOfBirth, todayLocal());
  if (birth) errors.dateOfBirth = birth;
  const hasEmergency = form.emergencyName.trim() || form.emergencyPhone.trim() || form.emergencyRelationship.trim();
  if (hasEmergency && !form.emergencyName.trim()) errors.emergencyName = 'Indica el nombre del contacto (si no, estos datos no se guardan)';
  if (form.emergencyPhone.trim() && !isPhone(form.emergencyPhone)) errors.emergencyPhone = 'Ingresa un teléfono válido';
  return errors;
}

const RegisterPatient = () => {
  const navigate = useNavigate();
  const formRef = useRef<HTMLFormElement>(null);
  const submittingRef = useRef(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [planInicial, setPlanInicial] = useState<PlanInicialOption>('despues');
  const [choice, setChoice] = useState<SessionsChoice>(DEFAULT_CHOICE.kinesiologia);
  const [term, setTerm] = useState<PlanTerm>('mensual');
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('calendar');
  const [renews, setRenews] = useState(true);
  const [form, setForm] = useState<FormState>(emptyForm);

  const dirty = useMemo(() => Object.keys(emptyForm).some((k) => form[k as keyof FormState] !== ''), [form]);
  useUnsavedChangesWarning(dirty && !loading);

  const set = (field: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    // El error de un campo desaparece apenas se vuelve a editar
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const focusFirstInvalid = () => {
    requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Un doble clic o dos Enter seguidos no deben crear dos pacientes
    if (submittingRef.current) return;

    const found = validate(form);
    if (Object.keys(found).length > 0) {
      setErrors(found);
      focusFirstInvalid();
      return;
    }

    submittingRef.current = true;
    setLoading(true);
    try {
      // La cuenta nace inutilizable y el paciente recibe una invitación por correo para elegir su contraseña.
      const hasEmergency = form.emergencyName.trim();
      const nuevoPaciente = await userService.create({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || undefined,
        // Se guarda normalizado ("12345678-5"): el login por RUT busca el texto exacto
        rut: form.rut.trim() ? normalizeRut(form.rut) : undefined,
        dateOfBirth: form.dateOfBirth || undefined,
        address: form.address.trim() || undefined,
        role: 'patient',
        emergencyContact: hasEmergency
          ? { name: form.emergencyName.trim(), phone: form.emergencyPhone.trim(), relationship: form.emergencyRelationship.trim() }
          : undefined,
        medicalInfo: {
          chronicConditions: parseLines(form.chronicConditions),
          allergies: parseLines(form.allergies),
          injuries: parseLines(form.injuries),
        },
      });

      if (planInicial === 'despues') {
        notify.success('Paciente registrado. Le llegará un correo para crear su contraseña.');
      } else {
        try {
          await clientPlanService.create({
            patientId: nuevoPaciente.id,
            serviceType: planInicial,
            ...choiceToPayload(choice),
            term,
            billingCycle,
            renews,
          });
          notify.success('Paciente registrado con su plan inicial. Le llegará un correo para crear su contraseña.');
        } catch {
          notify.warning('Paciente registrado, pero no se pudo asignar el plan inicial. Puedes asignarlo después desde Planes.');
        }
      }

      // Los datos ya se guardaron: se puede salir sin el aviso de "cambios sin guardar"
      setForm(emptyForm);
      navigate('/app/admin/pacientes');
    } catch (err: unknown) {
      const response = (err as { response?: { status?: number; data?: { message?: string } } }).response;
      const message = response?.data?.message ?? '';
      // Correo o RUT repetido: se marca en su campo y se conservan todos los datos escritos
      // (al crear el servidor responde 400 "El email ya está registrado"; al editar, 409).
      if (response?.status === 409 || /email ya est/i.test(message)) {
        setErrors((prev) => ({ ...prev, email: 'Ya existe una persona registrada con este correo' }));
        focusFirstInvalid();
      } else if (/rut/i.test(message) && /duplicate|ya existe|ya est/i.test(message)) {
        setErrors((prev) => ({ ...prev, rut: 'Ya existe una persona registrada con este RUT' }));
        focusFirstInvalid();
      } else {
        showApiError(err, 'No se pudo registrar al paciente. Tus datos siguen aquí: intenta de nuevo.');
      }
    } finally {
      submittingRef.current = false;
      setLoading(false);
    }
  };

  const handlePlanInicialChange = (option: PlanInicialOption) => {
    setPlanInicial(option);
    if (option !== 'despues') setChoice(DEFAULT_CHOICE[option]);
  };

  const errorCount = Object.values(errors).filter(Boolean).length;

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader title="Registrar paciente" description="Al guardar, el paciente recibe un correo para crear su contraseña." />

      <form ref={formRef} onSubmit={handleSubmit} noValidate className="space-y-6">
        {errorCount > 0 && (
          <Alert variant="destructive">
            <TriangleAlert className="h-4 w-4" aria-hidden="true" />
            <AlertDescription>
              Revisa {errorCount === 1 ? 'el campo marcado' : `los ${errorCount} campos marcados`} para poder registrar al paciente.
            </AlertDescription>
          </Alert>
        )}

        <FormSection title="Datos personales" description="Los campos con * son obligatorios.">
          <FormField label="Nombre" required error={errors.firstName}>
            {(c) => <Input {...c} autoComplete="off" value={form.firstName} onChange={(e) => set('firstName', e.target.value)} />}
          </FormField>
          <FormField label="Apellido" required error={errors.lastName}>
            {(c) => <Input {...c} autoComplete="off" value={form.lastName} onChange={(e) => set('lastName', e.target.value)} />}
          </FormField>
          <FormField label="Correo" required error={errors.email} hint="Aquí recibe la invitación para crear su contraseña.">
            {(c) => <Input {...c} type="email" inputMode="email" autoComplete="off" value={form.email} onChange={(e) => set('email', e.target.value)} />}
          </FormField>
          <FormField label="RUT" error={errors.rut} hint="Con o sin puntos; se guarda como 12345678-5, que es como entra con su RUT.">
            {(c) => (
              <Input
                {...c}
                autoComplete="off"
                placeholder="12.345.678-5"
                value={form.rut}
                onChange={(e) => set('rut', e.target.value)}
                onBlur={() => form.rut.trim() && set('rut', normalizeRut(form.rut))}
              />
            )}
          </FormField>
          <FormField label="Teléfono" error={errors.phone}>
            {(c) => <Input {...c} type="tel" inputMode="tel" autoComplete="off" placeholder="+56 9 1234 5678" value={form.phone} onChange={(e) => set('phone', e.target.value)} />}
          </FormField>
          <FormField label="Fecha de nacimiento" error={errors.dateOfBirth}>
            {(c) => <Input {...c} type="date" max={todayLocal()} value={form.dateOfBirth} onChange={(e) => set('dateOfBirth', e.target.value)} />}
          </FormField>
          <FormField label="Dirección" className="md:col-span-2">
            {(c) => <Input {...c} autoComplete="off" value={form.address} onChange={(e) => set('address', e.target.value)} />}
          </FormField>
        </FormSection>

        <FormSection title="Contacto de emergencia" description="Opcional. Si completas algún dato, indica también el nombre." className="md:grid-cols-3">
          <FormField label="Nombre" error={errors.emergencyName}>
            {(c) => <Input {...c} autoComplete="off" value={form.emergencyName} onChange={(e) => set('emergencyName', e.target.value)} />}
          </FormField>
          <FormField label="Teléfono" error={errors.emergencyPhone}>
            {(c) => <Input {...c} type="tel" inputMode="tel" autoComplete="off" value={form.emergencyPhone} onChange={(e) => set('emergencyPhone', e.target.value)} />}
          </FormField>
          <FormField label="Relación">
            {(c) => <Input {...c} autoComplete="off" placeholder="Madre, pareja…" value={form.emergencyRelationship} onChange={(e) => set('emergencyRelationship', e.target.value)} />}
          </FormField>
        </FormSection>

        <FormSection title="Información médica" description="Opcional. Escribe uno por línea." className="md:grid-cols-1">
          <FormField label="Condiciones crónicas">
            {(c) => <Textarea {...c} rows={2} value={form.chronicConditions} onChange={(e) => set('chronicConditions', e.target.value)} />}
          </FormField>
          <FormField label="Alergias">
            {(c) => <Textarea {...c} rows={2} value={form.allergies} onChange={(e) => set('allergies', e.target.value)} />}
          </FormField>
          <FormField label="Lesiones">
            {(c) => <Textarea {...c} rows={2} value={form.injuries} onChange={(e) => set('injuries', e.target.value)} />}
          </FormField>
        </FormSection>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Plan inicial</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div role="radiogroup" aria-label="Plan inicial" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {PLAN_OPTIONS.map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={planInicial === value}
                  onClick={() => handlePlanInicialChange(value)}
                  className={cn(
                    'rounded-lg border-2 p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    planInicial === value ? 'border-secondary bg-secondary/10' : 'border-border hover:border-muted-foreground/40'
                  )}
                >
                  <Icon className="mb-1 h-4 w-4 text-secondary" aria-hidden="true" />
                  <p className="text-sm font-semibold">{label}</p>
                </button>
              ))}
            </div>

            {planInicial !== 'despues' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Sesiones por mes</Label>
                  <SessionsSelect serviceType={planInicial} value={choice} onChange={setChoice} />
                </div>
                <PlanTermFields term={term} billingCycle={billingCycle} onTermChange={setTerm} onBillingCycleChange={setBillingCycle} />
                <RenewsCheckbox id="register-renews" checked={renews} onChange={setRenews} />
              </div>
            )}
          </CardContent>
        </Card>

        <SubmitButton className="w-full" loading={loading} loadingLabel="Registrando…">
          Registrar paciente
        </SubmitButton>
      </form>
    </div>
  );
};

export default RegisterPatient;
