import { useEffect, useMemo, useRef, useState } from 'react';
import { TriangleAlert } from 'lucide-react';
import { userService } from '@/services/userService';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { FormField } from '@/components/forms/FormField';
import SubmitButton from '@/components/forms/SubmitButton';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import { showApiError } from '@/lib/apiError';
import { todayLocal } from '@/lib/evolutionDate';
import { notify } from '@/lib/notify';
import { isValidRut, normalizeRut } from '@/lib/rut';
import { birthDateError, isEmail, isPhone, joinLines, parseLines } from '@/lib/validation';
import type { User } from '@/types';

interface EditPatientDialogProps {
  patient: User;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Solo el admin puede reasignar al paciente a otro profesional
  canAssign: boolean;
  canChangeProfessional?: boolean;
  onSaved: (patient: User) => void;
}

const NO_PROFESSIONAL = 'none';
const NO_GENDER = 'none';

const idOf = (value?: User | string) => (typeof value === 'object' ? value?.id : value) ?? '';

const buildForm = (patient: User) => ({
  firstName: patient.firstName ?? '',
  lastName: patient.lastName ?? '',
  email: patient.email ?? '',
  phone: patient.phone ?? '',
  rut: patient.rut ?? '',
  dateOfBirth: patient.dateOfBirth ? patient.dateOfBirth.slice(0, 10) : '',
  address: patient.address ?? '',
  gender: patient.gender || NO_GENDER,
  healthInsurance: patient.healthInsurance ?? '',
  referralSource: patient.referralSource ?? '',
  objectives: joinLines(patient.objectives),
  emergencyName: patient.emergencyContact?.name ?? '',
  emergencyPhone: patient.emergencyContact?.phone ?? '',
  emergencyRelationship: patient.emergencyContact?.relationship ?? '',
  chronicConditions: joinLines(patient.medicalInfo?.chronicConditions),
  medications: joinLines(patient.medicalInfo?.medications),
  allergies: joinLines(patient.medicalInfo?.allergies),
  injuries: joinLines(patient.medicalInfo?.injuries),
  assignedProfessionalId: idOf(patient.assignedProfessionalId) || NO_PROFESSIONAL,
  exemptFromCapacity: patient.exemptFromCapacity === true,
});
type FormState = ReturnType<typeof buildForm>;
type Errors = Partial<Record<keyof FormState, string>>;

const EditPatientDialog = ({ patient, open, onOpenChange, canAssign, canChangeProfessional = false, onSaved }: EditPatientDialogProps) => {
  const bodyRef = useRef<HTMLDivElement>(null);
  const savingRef = useRef(false);
  const [form, setForm] = useState(() => buildForm(patient));
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);
  const [staff, setStaff] = useState<User[]>([]);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  const initial = useMemo(() => buildForm(patient), [patient]);
  const dirty = JSON.stringify(form) !== JSON.stringify(initial);

  useEffect(() => {
    if (open) {
      setForm(buildForm(patient));
      setErrors({});
    }
  }, [open, patient]);

  const showProfessional = canAssign || canChangeProfessional;

  useEffect(() => {
    if (!open || !showProfessional || staff.length > 0) return;
    Promise.all([userService.getAll({ role: 'admin' }), userService.getAll({ role: 'professional' })])
      .then(([admins, professionals]) => setStaff([...admins.users, ...professionals.users].filter((s) => s.isActive)))
      .catch(() => notify.error('No se pudo cargar la lista de profesionales'));
  }, [open, showProfessional, staff.length]);

  const set = <K extends keyof FormState>(field: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  // Cerrar con cambios sin guardar pregunta antes de descartarlos
  const requestClose = (next: boolean) => {
    if (next) return onOpenChange(true);
    if (saving) return;
    if (dirty) setConfirmDiscard(true);
    else onOpenChange(false);
  };

  const validate = (): Errors => {
    const found: Errors = {};
    if (!form.firstName.trim()) found.firstName = 'Ingresa el nombre';
    if (!form.lastName.trim()) found.lastName = 'Ingresa el apellido';
    if (!form.email.trim()) found.email = 'Ingresa el correo';
    else if (!isEmail(form.email)) found.email = 'Ingresa un correo válido';
    // El RUT solo se exige válido si se cambió: una ficha antigua con un RUT raro igual se puede editar
    if (form.rut.trim() && form.rut.trim() !== (patient.rut ?? '') && !isValidRut(form.rut)) {
      found.rut = 'RUT inválido: revisa los números y el dígito verificador';
    }
    if (form.phone.trim() && !isPhone(form.phone)) found.phone = 'Ingresa un teléfono válido';
    const birth = birthDateError(form.dateOfBirth, todayLocal());
    if (birth) found.dateOfBirth = birth;
    if (form.emergencyPhone.trim() && !isPhone(form.emergencyPhone)) found.emergencyPhone = 'Ingresa un teléfono válido';
    return found;
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (savingRef.current) return;

    const found = validate();
    if (Object.keys(found).length > 0) {
      setErrors(found);
      requestAnimationFrame(() => bodyRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
      return;
    }

    savingRef.current = true;
    setSaving(true);
    try {
      const rut = form.rut.trim();
      const updated = await userService.update(patient.id, {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        // Un RUT válido se guarda normalizado (el login por RUT busca el texto exacto); uno antiguo sin tocar se deja como está
        rut: rut && isValidRut(rut) ? normalizeRut(rut) : rut,
        dateOfBirth: form.dateOfBirth || undefined,
        address: form.address.trim(),
        gender: form.gender === NO_GENDER ? '' : (form.gender as User['gender']),
        healthInsurance: form.healthInsurance.trim(),
        referralSource: form.referralSource.trim(),
        objectives: parseLines(form.objectives),
        emergencyContact: {
          name: form.emergencyName.trim(),
          phone: form.emergencyPhone.trim(),
          relationship: form.emergencyRelationship.trim(),
        },
        // El servidor reemplaza medicalInfo completo: se conserva lo que este formulario no toca
        // (altura, peso base, fumador, cirugías).
        medicalInfo: {
          ...patient.medicalInfo,
          chronicConditions: parseLines(form.chronicConditions),
          medications: parseLines(form.medications),
          allergies: parseLines(form.allergies),
          injuries: parseLines(form.injuries),
        },
        ...(canAssign
          ? {
              assignedProfessionalId: form.assignedProfessionalId === NO_PROFESSIONAL ? '' : form.assignedProfessionalId,
              exemptFromCapacity: form.exemptFromCapacity,
            }
          : canChangeProfessional && form.assignedProfessionalId !== NO_PROFESSIONAL
            ? { assignedProfessionalId: form.assignedProfessionalId }
            : {}),
      });
      notify.success('Datos del paciente actualizados');
      onSaved(updated);
      onOpenChange(false);
    } catch (err: unknown) {
      const response = (err as { response?: { status?: number } }).response;
      if (response?.status === 409) {
        // Correo repetido: se marca en el campo y no se pierde nada de lo escrito
        setErrors((prev) => ({ ...prev, email: 'Ya existe otra persona con este correo' }));
        requestAnimationFrame(() => bodyRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
      } else {
        showApiError(err, 'No se pudieron guardar los cambios. Tus datos siguen aquí: intenta de nuevo.');
      }
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const errorCount = Object.values(errors).filter(Boolean).length;

  return (
    <>
      <Dialog open={open} onOpenChange={requestClose}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Editar datos del paciente</DialogTitle>
            <DialogDescription>Los campos con * son obligatorios. Las listas se escriben una por línea.</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSave} noValidate>
            <div ref={bodyRef} className="space-y-6">
              {errorCount > 0 && (
                <Alert variant="destructive">
                  <TriangleAlert className="h-4 w-4" aria-hidden="true" />
                  <AlertDescription>Revisa {errorCount === 1 ? 'el campo marcado' : `los ${errorCount} campos marcados`}.</AlertDescription>
                </Alert>
              )}

              <section className="space-y-3">
                <h3 className="font-semibold text-foreground">Datos personales</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  <FormField label="Nombre" required error={errors.firstName}>
                    {(c) => <Input {...c} autoComplete="off" value={form.firstName} onChange={(e) => set('firstName', e.target.value)} />}
                  </FormField>
                  <FormField label="Apellido" required error={errors.lastName}>
                    {(c) => <Input {...c} autoComplete="off" value={form.lastName} onChange={(e) => set('lastName', e.target.value)} />}
                  </FormField>
                  <FormField label="Correo" required error={errors.email} className="sm:col-span-2">
                    {(c) => <Input {...c} type="email" inputMode="email" autoComplete="off" value={form.email} onChange={(e) => set('email', e.target.value)} />}
                  </FormField>
                  <FormField label="Teléfono" error={errors.phone}>
                    {(c) => <Input {...c} type="tel" inputMode="tel" autoComplete="off" value={form.phone} onChange={(e) => set('phone', e.target.value)} />}
                  </FormField>
                  <FormField label="RUT" error={errors.rut}>
                    {(c) => (
                      <Input
                        {...c}
                        autoComplete="off"
                        value={form.rut}
                        onChange={(e) => set('rut', e.target.value)}
                        onBlur={() => form.rut.trim() && isValidRut(form.rut) && set('rut', normalizeRut(form.rut))}
                      />
                    )}
                  </FormField>
                  <FormField label="Fecha de nacimiento" error={errors.dateOfBirth}>
                    {(c) => <Input {...c} type="date" max={todayLocal()} value={form.dateOfBirth} onChange={(e) => set('dateOfBirth', e.target.value)} />}
                  </FormField>
                  <FormField label="Género">
                    {(c) => (
                      <Select value={form.gender} onValueChange={(v) => set('gender', v)}>
                        <SelectTrigger id={c.id}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NO_GENDER}>Sin especificar</SelectItem>
                          <SelectItem value="Masculino">Masculino</SelectItem>
                          <SelectItem value="Femenino">Femenino</SelectItem>
                          <SelectItem value="Otro">Otro</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </FormField>
                  <FormField label="Dirección" className="sm:col-span-2">
                    {(c) => <Input {...c} autoComplete="off" value={form.address} onChange={(e) => set('address', e.target.value)} />}
                  </FormField>
                  <FormField label="Previsión">
                    {(c) => <Input {...c} autoComplete="off" value={form.healthInsurance} onChange={(e) => set('healthInsurance', e.target.value)} />}
                  </FormField>
                  <FormField label="Cómo llegó">
                    {(c) => <Input {...c} autoComplete="off" value={form.referralSource} onChange={(e) => set('referralSource', e.target.value)} />}
                  </FormField>
                  <FormField label="Objetivos" hint="Uno por línea." className="sm:col-span-2">
                    {(c) => <Textarea {...c} rows={3} value={form.objectives} onChange={(e) => set('objectives', e.target.value)} />}
                  </FormField>
                  {showProfessional && (
                    <FormField label="Profesional asignado" className="sm:col-span-2">
                      {(c) => (
                        <Select value={form.assignedProfessionalId} onValueChange={(v) => set('assignedProfessionalId', v)}>
                          <SelectTrigger id={c.id}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {canAssign && <SelectItem value={NO_PROFESSIONAL}>Sin asignar (lo ve todo el personal)</SelectItem>}
                            {!canAssign && form.assignedProfessionalId === NO_PROFESSIONAL && (
                              <SelectItem value={NO_PROFESSIONAL}>Sin asignar: elige un profesional</SelectItem>
                            )}
                            {staff.map((s) => (
                              <SelectItem key={s.id} value={s.id}>
                                {s.firstName} {s.lastName}
                              </SelectItem>
                            ))}
                            {form.assignedProfessionalId !== NO_PROFESSIONAL && !staff.some((s) => s.id === form.assignedProfessionalId) && (
                              <SelectItem value={form.assignedProfessionalId}>Profesional actual</SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                      )}
                    </FormField>
                  )}
                  {canAssign && (
                    <div className="flex items-start justify-between gap-4 rounded-lg border border-border p-3 sm:col-span-2">
                      <div className="space-y-1">
                        <Label htmlFor="exempt-capacity">Puede agendar sobre el cupo</Label>
                        <p className="text-xs text-muted-foreground">
                          Aunque el horario ya tenga 4 pacientes, esta persona puede agendar, y sus citas no cuentan en esos 4 (no le quitan lugar a
                          nadie). Vale para las citas que agende desde ahora.
                        </p>
                      </div>
                      <Switch id="exempt-capacity" checked={form.exemptFromCapacity} onCheckedChange={(v) => set('exemptFromCapacity', v)} />
                    </div>
                  )}
                </div>
              </section>

              <section className="space-y-3">
                <h3 className="font-semibold text-foreground">Contacto de emergencia</h3>
                <div className="grid gap-3 sm:grid-cols-3">
                  <FormField label="Nombre">
                    {(c) => <Input {...c} autoComplete="off" value={form.emergencyName} onChange={(e) => set('emergencyName', e.target.value)} />}
                  </FormField>
                  <FormField label="Teléfono" error={errors.emergencyPhone}>
                    {(c) => <Input {...c} type="tel" inputMode="tel" autoComplete="off" value={form.emergencyPhone} onChange={(e) => set('emergencyPhone', e.target.value)} />}
                  </FormField>
                  <FormField label="Relación">
                    {(c) => <Input {...c} autoComplete="off" value={form.emergencyRelationship} onChange={(e) => set('emergencyRelationship', e.target.value)} />}
                  </FormField>
                </div>
              </section>

              <section className="space-y-3">
                <h3 className="font-semibold text-foreground">Información médica</h3>
                <p className="text-xs text-muted-foreground">Una por línea. Peso y altura base se editan en la tarjeta de Información médica.</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <FormField label="Condiciones crónicas">
                    {(c) => <Textarea {...c} rows={3} value={form.chronicConditions} onChange={(e) => set('chronicConditions', e.target.value)} />}
                  </FormField>
                  <FormField label="Medicamentos">
                    {(c) => <Textarea {...c} rows={3} value={form.medications} onChange={(e) => set('medications', e.target.value)} />}
                  </FormField>
                  <FormField label="Alergias">
                    {(c) => <Textarea {...c} rows={3} value={form.allergies} onChange={(e) => set('allergies', e.target.value)} />}
                  </FormField>
                  <FormField label="Lesiones">
                    {(c) => <Textarea {...c} rows={3} value={form.injuries} onChange={(e) => set('injuries', e.target.value)} />}
                  </FormField>
                </div>
              </section>
            </div>

            <DialogFooter className="mt-6">
              <Button type="button" variant="outline" onClick={() => requestClose(false)} disabled={saving}>
                Cancelar
              </Button>
              <SubmitButton loading={saving} loadingLabel="Guardando…" disabled={!dirty}>
                Guardar cambios
              </SubmitButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmDiscard}
        onOpenChange={setConfirmDiscard}
        title="¿Descartar los cambios?"
        description="Hiciste cambios que todavía no guardaste. Si cierras, se pierden."
        confirmLabel="Descartar"
        cancelLabel="Seguir editando"
        destructive
        onConfirm={() => onOpenChange(false)}
      />
    </>
  );
};

export default EditPatientDialog;
