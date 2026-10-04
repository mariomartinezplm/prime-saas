import { useEffect, useState } from 'react';
import { userService } from '@/services/userService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { User } from '@/types';

interface EditPatientDialogProps {
  patient: User;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Solo el admin puede reasignar al paciente a otro profesional
  canAssign: boolean;
  onSaved: (patient: User) => void;
}

const NO_PROFESSIONAL = 'none';
const NO_GENDER = 'none';

// Una lista por línea: no se pierde nada si un texto trae comas (así vienen
// muchos datos importados de Airtable).
const toLines = (list?: string[]) => (list ?? []).join('\n');
const fromLines = (text: string) => text.split('\n').map((s) => s.trim()).filter(Boolean);

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
  objectives: toLines(patient.objectives),
  emergencyName: patient.emergencyContact?.name ?? '',
  emergencyPhone: patient.emergencyContact?.phone ?? '',
  emergencyRelationship: patient.emergencyContact?.relationship ?? '',
  chronicConditions: toLines(patient.medicalInfo?.chronicConditions),
  medications: toLines(patient.medicalInfo?.medications),
  allergies: toLines(patient.medicalInfo?.allergies),
  injuries: toLines(patient.medicalInfo?.injuries),
  assignedProfessionalId: idOf(patient.assignedProfessionalId) || NO_PROFESSIONAL,
  exemptFromCapacity: patient.exemptFromCapacity === true,
});

const EditPatientDialog = ({ patient, open, onOpenChange, canAssign, onSaved }: EditPatientDialogProps) => {
  const [form, setForm] = useState(() => buildForm(patient));
  const [saving, setSaving] = useState(false);
  const [staff, setStaff] = useState<User[]>([]);

  useEffect(() => {
    if (open) setForm(buildForm(patient));
  }, [open, patient]);

  useEffect(() => {
    if (!open || !canAssign || staff.length > 0) return;
    Promise.all([userService.getAll({ role: 'admin' }), userService.getAll({ role: 'professional' })])
      .then(([admins, professionals]) => setStaff([...admins.users, ...professionals.users].filter((s) => s.isActive)))
      .catch(() => toast.error('No se pudo cargar la lista de profesionales'));
  }, [open, canAssign, staff.length]);

  const set = (field: keyof typeof form, value: string) => setForm((prev) => ({ ...prev, [field]: value }));

  const handleSave = async () => {
    if (!form.firstName.trim() || !form.lastName.trim() || !form.email.trim()) {
      toast.error('Nombre, apellido y correo son obligatorios');
      return;
    }
    setSaving(true);
    try {
      const updated = await userService.update(patient.id, {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        rut: form.rut.trim(),
        dateOfBirth: form.dateOfBirth || undefined,
        address: form.address.trim(),
        gender: form.gender === NO_GENDER ? '' : (form.gender as User['gender']),
        healthInsurance: form.healthInsurance.trim(),
        referralSource: form.referralSource.trim(),
        objectives: fromLines(form.objectives),
        emergencyContact: {
          name: form.emergencyName.trim(),
          phone: form.emergencyPhone.trim(),
          relationship: form.emergencyRelationship.trim(),
        },
        // El servidor reemplaza medicalInfo completo: se conserva lo que este
        // formulario no toca (altura, peso base, fumador, cirugías).
        medicalInfo: {
          ...patient.medicalInfo,
          chronicConditions: fromLines(form.chronicConditions),
          medications: fromLines(form.medications),
          allergies: fromLines(form.allergies),
          injuries: fromLines(form.injuries),
        },
        ...(canAssign
          ? {
              assignedProfessionalId: form.assignedProfessionalId === NO_PROFESSIONAL ? '' : form.assignedProfessionalId,
              exemptFromCapacity: form.exemptFromCapacity,
            }
          : {}),
      });
      toast.success('Datos del paciente actualizados');
      onSaved(updated);
      onOpenChange(false);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      toast.error(error.response?.data?.message || 'No se pudieron guardar los cambios');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Editar datos de {patient.firstName}</DialogTitle>
          <DialogDescription>Solo el personal puede modificar estos datos.</DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <section className="space-y-3">
            <h3 className="font-semibold text-foreground">Datos personales</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Nombre *</Label>
                <Input value={form.firstName} onChange={(e) => set('firstName', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Apellido *</Label>
                <Input value={form.lastName} onChange={(e) => set('lastName', e.target.value)} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Correo *</Label>
                <Input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} />
                <p className="text-xs text-muted-foreground">Es el correo con el que el paciente inicia sesión.</p>
              </div>
              <div className="space-y-1.5">
                <Label>Teléfono</Label>
                <Input value={form.phone} onChange={(e) => set('phone', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>RUT</Label>
                <Input value={form.rut} onChange={(e) => set('rut', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Fecha de nacimiento</Label>
                <Input type="date" value={form.dateOfBirth} onChange={(e) => set('dateOfBirth', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Género</Label>
                <Select value={form.gender} onValueChange={(v) => set('gender', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_GENDER}>Sin especificar</SelectItem>
                    <SelectItem value="Masculino">Masculino</SelectItem>
                    <SelectItem value="Femenino">Femenino</SelectItem>
                    <SelectItem value="Otro">Otro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Dirección</Label>
                <Input value={form.address} onChange={(e) => set('address', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Previsión</Label>
                <Input value={form.healthInsurance} onChange={(e) => set('healthInsurance', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Cómo llegó</Label>
                <Input value={form.referralSource} onChange={(e) => set('referralSource', e.target.value)} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Objetivos</Label>
                <Textarea rows={3} value={form.objectives} onChange={(e) => set('objectives', e.target.value)} />
                <p className="text-xs text-muted-foreground">Uno por línea.</p>
              </div>
              {canAssign && (
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Profesional asignado</Label>
                  <Select value={form.assignedProfessionalId} onValueChange={(v) => set('assignedProfessionalId', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_PROFESSIONAL}>Sin asignar (lo ve todo el personal)</SelectItem>
                      {staff.map((s) => (
                        <SelectItem key={s.id} value={s.id}>{s.firstName} {s.lastName}</SelectItem>
                      ))}
                      {form.assignedProfessionalId !== NO_PROFESSIONAL && !staff.some((s) => s.id === form.assignedProfessionalId) && (
                        <SelectItem value={form.assignedProfessionalId}>Profesional actual</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {canAssign && (
                <div className="flex items-start justify-between gap-4 rounded-lg border border-border p-3 sm:col-span-2">
                  <div className="space-y-1">
                    <Label htmlFor="exempt-capacity">Puede agendar sobre el cupo</Label>
                    <p className="text-xs text-muted-foreground">
                      Aunque el horario ya tenga 4 pacientes, esta persona puede agendar, y sus citas no
                      cuentan en esos 4 (no le quitan lugar a nadie). Vale para las citas que agende desde ahora.
                    </p>
                  </div>
                  <Switch
                    id="exempt-capacity"
                    checked={form.exemptFromCapacity}
                    onCheckedChange={(v) => setForm((prev) => ({ ...prev, exemptFromCapacity: v }))}
                  />
                </div>
              )}
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="font-semibold text-foreground">Contacto de emergencia</h3>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label>Nombre</Label>
                <Input value={form.emergencyName} onChange={(e) => set('emergencyName', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Teléfono</Label>
                <Input value={form.emergencyPhone} onChange={(e) => set('emergencyPhone', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Relación</Label>
                <Input value={form.emergencyRelationship} onChange={(e) => set('emergencyRelationship', e.target.value)} />
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="font-semibold text-foreground">Información médica</h3>
            <p className="text-xs text-muted-foreground">Uno por línea. Peso y altura base se editan en la tarjeta de Información Médica.</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Condiciones crónicas</Label>
                <Textarea rows={3} value={form.chronicConditions} onChange={(e) => set('chronicConditions', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Medicamentos</Label>
                <Textarea rows={3} value={form.medications} onChange={(e) => set('medications', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Alergias</Label>
                <Textarea rows={3} value={form.allergies} onChange={(e) => set('allergies', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Lesiones</Label>
                <Textarea rows={3} value={form.injuries} onChange={(e) => set('injuries', e.target.value)} />
              </div>
            </div>
          </section>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Guardar cambios
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EditPatientDialog;
