import { useEffect, useRef, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { MessageCircle, Pencil } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { authService } from '@/services/authService';
import { clientPlanService } from '@/services/clientPlanService';
import ClinicalBaselineFields from '@/components/forms/ClinicalBaselineFields';
import { FormField } from '@/components/forms/FormField';
import SubmitButton from '@/components/forms/SubmitButton';
import PatientFilesTab from '@/components/files/PatientFilesTab';
import { DetailList, DetailRow } from '@/components/patients/DetailList';
import PageHeader from '@/components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getWhatsAppUrl } from '@/config/contact';
import { SERVICE_TYPE_LABELS, formatPlanUsage, formatCycleProgress } from '@/config/planCatalog';
import FounderBadge from '@/components/plans/FounderBadge';
import PaymentPendingBanner from '@/components/plans/PaymentPendingBanner';
import { showApiError } from '@/lib/apiError';
import { todayLocal } from '@/lib/evolutionDate';
import { notify } from '@/lib/notify';
import { birthDateError, isPhone } from '@/lib/validation';
import type { SessionBalance, User } from '@/types';

const formFromUser = (user: User) => ({
  firstName: user.firstName || '',
  lastName: user.lastName || '',
  phone: user.phone || '',
  address: user.address || '',
  dateOfBirth: user.dateOfBirth?.split('T')[0] || '',
});
type ProfileForm = ReturnType<typeof formFromUser>;
type ProfileErrors = Partial<Record<keyof ProfileForm, string>>;

const PersonalDataCard = ({ user, onSaved }: { user: User; onSaved: (user: User) => void }) => {
  const formRef = useRef<HTMLFormElement>(null);
  const savingRef = useRef(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<ProfileForm>(() => formFromUser(user));
  const [errors, setErrors] = useState<ProfileErrors>({});

  const set = (field: keyof ProfileForm, value: string) => {
    setForm((p) => ({ ...p, [field]: value }));
    if (errors[field]) setErrors((p) => ({ ...p, [field]: undefined }));
  };

  const startEditing = () => {
    // Siempre se parte de los datos guardados: antes, tras Cancelar, reaparecía lo que se había escrito
    setForm(formFromUser(user));
    setErrors({});
    setEditing(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (savingRef.current) return;

    const found: ProfileErrors = {};
    if (!form.firstName.trim()) found.firstName = 'Ingresa tu nombre';
    if (!form.lastName.trim()) found.lastName = 'Ingresa tu apellido';
    if (form.phone.trim() && !isPhone(form.phone)) found.phone = 'Ingresa un teléfono válido';
    const birth = birthDateError(form.dateOfBirth, todayLocal());
    if (birth) found.dateOfBirth = birth;
    if (Object.keys(found).length > 0) {
      setErrors(found);
      requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
      return;
    }

    savingRef.current = true;
    setSaving(true);
    try {
      const updated = await authService.updateProfile({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        phone: form.phone.trim() || undefined,
        address: form.address.trim() || undefined,
        dateOfBirth: form.dateOfBirth || undefined,
      });
      onSaved(updated);
      setEditing(false);
      notify.success('Perfil actualizado');
    } catch (err) {
      // Se conserva lo escrito para reintentar
      showApiError(err, 'No se pudo actualizar tu perfil. Tus datos siguen aquí.');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
        <CardTitle className="text-lg">Datos personales</CardTitle>
        {!editing && (
          <Button variant="outline" size="sm" onClick={startEditing}>
            <Pencil aria-hidden="true" />
            Editar
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {editing ? (
          <form ref={formRef} onSubmit={handleSubmit} noValidate className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <FormField label="Nombre" required error={errors.firstName}>
                {(c) => <Input {...c} autoComplete="given-name" value={form.firstName} onChange={(e) => set('firstName', e.target.value)} />}
              </FormField>
              <FormField label="Apellido" required error={errors.lastName}>
                {(c) => <Input {...c} autoComplete="family-name" value={form.lastName} onChange={(e) => set('lastName', e.target.value)} />}
              </FormField>
              <FormField label="Teléfono" error={errors.phone}>
                {(c) => <Input {...c} type="tel" inputMode="tel" autoComplete="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} />}
              </FormField>
              <FormField label="Fecha de nacimiento" error={errors.dateOfBirth}>
                {(c) => (
                  <Input {...c} type="date" max={todayLocal()} autoComplete="bday" value={form.dateOfBirth} onChange={(e) => set('dateOfBirth', e.target.value)} />
                )}
              </FormField>
              <FormField label="Dirección" className="md:col-span-2">
                {(c) => <Input {...c} autoComplete="street-address" value={form.address} onChange={(e) => set('address', e.target.value)} />}
              </FormField>
            </div>
            <div className="flex flex-wrap gap-2">
              <SubmitButton loading={saving} loadingLabel="Guardando…">
                Guardar cambios
              </SubmitButton>
              <Button type="button" variant="outline" onClick={() => setEditing(false)} disabled={saving}>
                Cancelar
              </Button>
            </div>
          </form>
        ) : (
          <DetailList>
            <DetailRow label="Nombre">
              {user.firstName} {user.lastName}
            </DetailRow>
            <DetailRow label="Correo">{user.email}</DetailRow>
            <DetailRow label="RUT">{user.rut}</DetailRow>
            <DetailRow label="Teléfono">{user.phone}</DetailRow>
            <DetailRow label="Fecha de nacimiento">
              {user.dateOfBirth ? format(parseISO(user.dateOfBirth.slice(0, 10)), 'dd/MM/yyyy') : undefined}
            </DetailRow>
            <DetailRow label="Dirección">{user.address}</DetailRow>
          </DetailList>
        )}
      </CardContent>
    </Card>
  );
};

const MyProfile = () => {
  const { user, updateUser } = useAuth();
  const [balance, setBalance] = useState<SessionBalance | null>(null);

  useEffect(() => {
    if (user) {
      clientPlanService.getBalance(user.id).then(setBalance).catch(() => {});
    }
  }, [user]);

  if (!user) return null;

  const renewUrl = getWhatsAppUrl('Hola, quiero renovar mi plan en Prime F&H');

  return (
    <div className="space-y-6">
      <PageHeader title="Mi perfil" badges={user.isFounder ? <FounderBadge /> : undefined} description="Información de tu cuenta" />

      <Tabs defaultValue="personal">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="personal">Datos personales</TabsTrigger>
          <TabsTrigger value="emergency">Emergencia</TabsTrigger>
          <TabsTrigger value="medical">Info médica</TabsTrigger>
          <TabsTrigger value="files">Archivos</TabsTrigger>
          <TabsTrigger value="plan">Mi plan</TabsTrigger>
        </TabsList>

        <TabsContent value="personal" className="mt-4">
          <PersonalDataCard user={user} onSaved={updateUser} />
        </TabsContent>

        <TabsContent value="emergency" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Contacto de emergencia</CardTitle>
            </CardHeader>
            <CardContent>
              <DetailList>
                <DetailRow label="Nombre">{user.emergencyContact?.name}</DetailRow>
                <DetailRow label="Teléfono">{user.emergencyContact?.phone}</DetailRow>
                <DetailRow label="Relación">{user.emergencyContact?.relationship}</DetailRow>
              </DetailList>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="medical" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Información médica</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <ClinicalBaselineFields
                medicalInfo={user.medicalInfo}
                dateOfBirth={user.dateOfBirth}
                onSave={async (medicalInfo) => {
                  const updated = await authService.updateProfile({ medicalInfo });
                  updateUser(updated);
                }}
              />
              <div className="space-y-3 border-t border-border pt-3">
                <div><span className="text-muted-foreground">Condiciones crónicas: </span>{user.medicalInfo?.chronicConditions?.join(', ') || 'Ninguna'}</div>
                <div><span className="text-muted-foreground">Medicamentos: </span>{user.medicalInfo?.medications?.join(', ') || 'Ninguno'}</div>
                <div><span className="text-muted-foreground">Alergias: </span>{user.medicalInfo?.allergies?.join(', ') || 'Ninguna'}</div>
                <div><span className="text-muted-foreground">Lesiones: </span>{user.medicalInfo?.injuries?.join(', ') || 'Ninguna'}</div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="files" className="mt-4">
          <PatientFilesTab patientId={user.id} canUpload={balance ? balance.hasActivePlan : true} />
        </TabsContent>

        <TabsContent value="plan" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Mi plan</CardTitle>
            </CardHeader>
            <CardContent>
              {balance?.hasActivePlan && balance.plan ? (
                <div className="space-y-4">
                  {balance.paymentPending && balance.paymentDueBy && <PaymentPendingBanner paymentDueBy={balance.paymentDueBy} />}
                  <DetailList>
                    <DetailRow label="Tipo">{SERVICE_TYPE_LABELS[balance.plan.serviceType]}</DetailRow>
                    <DetailRow label="Sesiones">{formatPlanUsage(balance.plan)}</DetailRow>
                    <DetailRow label="Inicio">{format(parseISO(balance.plan.startDate), 'dd/MM/yyyy')}</DetailRow>
                    {formatCycleProgress(balance.plan) && <DetailRow label="Plan">{formatCycleProgress(balance.plan)}</DetailRow>}
                    <DetailRow label="Vence">{format(parseISO(balance.plan.endDate), 'dd/MM/yyyy')}</DetailRow>
                    {balance.extraSessionsAvailable > 0 && <DetailRow label="Sesiones extra">{balance.extraSessionsAvailable}</DetailRow>}
                  </DetailList>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">No tienes un plan activo. Contacta a Prime F&H para renovar.</p>
                  <Button asChild variant="outline" size="sm">
                    <a href={renewUrl} target="_blank" rel="noopener noreferrer">
                      <MessageCircle aria-hidden="true" />
                      Escribir por WhatsApp
                      <span className="sr-only"> (se abre en otra pestaña)</span>
                    </a>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default MyProfile;
