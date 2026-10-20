import { useCallback, useEffect, useRef, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { Activity, ChevronLeft, ChevronRight, FolderOpen, HeartPulse, MessageCircle, Pencil, ShieldCheck, UserRound, Users, type LucideIcon } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { authService } from '@/services/authService';
import { clientPlanService } from '@/services/clientPlanService';
import ClinicalBaselineFields from '@/components/forms/ClinicalBaselineFields';
import { FormField } from '@/components/forms/FormField';
import SubmitButton from '@/components/forms/SubmitButton';
import PatientFilesTab from '@/components/files/PatientFilesTab';
import { DetailList, DetailRow } from '@/components/patients/DetailList';
import PageTitle from '@/components/premium/PageTitle';
import { CARD, CARD_LINK, HERO_SURFACE } from '@/components/dashboard/brand';
import { cn } from '@/lib/utils';
import LoadErrorAlert from '@/components/shared/LoadErrorAlert';
import LoadingState from '@/components/shared/LoadingState';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
        <CardTitle className="sr-only">Datos personales</CardTitle>
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

type SectionKey = 'personal' | 'emergency' | 'medical' | 'plan' | 'files';

// Marco común de cada sección: volver, título y contenido en una tarjeta oscura
const SectionShell = ({ title, onBack, children }: { title: string; onBack: () => void; children: React.ReactNode }) => (
  <div className="mx-auto w-full max-w-3xl space-y-4">
    <button type="button" onClick={onBack} className="-ml-1 flex min-h-[44px] items-center gap-1 rounded-xl px-1 text-[15px] font-semibold text-[#7cc0d2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#fff8e4]">
      <ChevronLeft className="h-5 w-5" aria-hidden="true" />
      Mi perfil
    </button>
    <h2 className="text-[1.5rem] font-extrabold leading-tight tracking-tight text-[#fff8e4]">{title}</h2>
    {children}
  </div>
);

const HubRow = ({ icon: Icon, title, summary, onClick, attention }: { icon: LucideIcon; title: string; summary: string; onClick: () => void; attention?: string }) => (
  <button type="button" onClick={onClick} className={cn(CARD, CARD_LINK, 'flex min-h-[68px] w-full items-center gap-3.5 px-4 py-3 text-left')}>
    <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#398ca2]/40 bg-[#398ca2]/15 text-[#7cc0d2]">
      <Icon className="h-5 w-5" />
    </span>
    <span className="min-w-0 flex-1">
      <span className="block text-[15.5px] font-semibold text-[#fff8e4]">{title}</span>
      <span className="block truncate text-[13px] text-[#fff8e4]/70">{summary}</span>
    </span>
    {attention && <span className="shrink-0 rounded-full border border-[#398ca2]/50 bg-[#398ca2]/20 px-2.5 py-0.5 text-[11.5px] font-semibold text-[#fff8e4]">{attention}</span>}
    <ChevronRight className="h-5 w-5 shrink-0 text-[#fff8e4]/55" aria-hidden="true" />
  </button>
);

const initialsOf = (u: User) => `${u.firstName?.[0] ?? ''}${u.lastName?.[0] ?? ''}`.toUpperCase() || 'P';

const MyProfile = () => {
  const { user, updateUser } = useAuth();
  const [balance, setBalance] = useState<SessionBalance | null>(null);
  // Si no se pudo consultar el plan NO se dice "no tienes un plan activo": sería falso
  const [balanceStatus, setBalanceStatus] = useState<'loading' | 'ok' | 'error'>('loading');
  const [section, setSection] = useState<SectionKey | null>(null);
  const userId = user?.id;

  const loadBalance = useCallback(() => {
    if (!userId) return;
    setBalanceStatus('loading');
    clientPlanService
      .getBalance(userId)
      .then((b) => {
        setBalance(b);
        setBalanceStatus('ok');
      })
      .catch(() => setBalanceStatus('error'));
  }, [userId]);

  useEffect(() => {
    loadBalance();
  }, [loadBalance]);

  // Al abrir una sección o volver, se sube al inicio de la pantalla
  useEffect(() => {
    window.scrollTo?.(0, 0);
    document.getElementById('contenido')?.scrollTo?.({ top: 0 });
  }, [section]);

  if (!user) return null;

  const renewUrl = getWhatsAppUrl('Hola, quiero renovar mi plan en Prime F&H');
  const back = () => setSection(null);
  const hasEmergency = !!(user.emergencyContact?.name || user.emergencyContact?.phone);
  const planSummary =
    balanceStatus === 'ok' ? (balance?.hasActivePlan && balance.plan ? `${SERVICE_TYPE_LABELS[balance.plan.serviceType]} · ${formatPlanUsage(balance.plan)}` : 'Sin plan activo') : balanceStatus === 'error' ? 'No pudimos consultarlo' : 'Consultando…';

  if (section === 'personal') {
    return (
      <SectionShell title="Datos personales" onBack={back}>
        <PersonalDataCard user={user} onSaved={updateUser} />
      </SectionShell>
    );
  }

  if (section === 'emergency') {
    return (
      <SectionShell title="Contacto de emergencia" onBack={back}>
        <Card>
          <CardContent className="pt-6">
            {hasEmergency ? (
              <DetailList>
                <DetailRow label="Nombre">{user.emergencyContact?.name}</DetailRow>
                <DetailRow label="Teléfono">{user.emergencyContact?.phone}</DetailRow>
                <DetailRow label="Relación">{user.emergencyContact?.relationship}</DetailRow>
              </DetailList>
            ) : (
              <p className="text-sm text-[#fff8e4]/75">Aún no hay un contacto de emergencia registrado. Pídele a tu kinesiólogo que lo anote en tu próxima sesión.</p>
            )}
          </CardContent>
        </Card>
      </SectionShell>
    );
  }

  if (section === 'medical') {
    return (
      <SectionShell title="Información médica" onBack={back}>
        <Card>
          <CardContent className="space-y-4 pt-6 text-sm">
            <ClinicalBaselineFields
              medicalInfo={user.medicalInfo}
              dateOfBirth={user.dateOfBirth}
              onSave={async (medicalInfo) => {
                const updated = await authService.updateProfile({ medicalInfo });
                updateUser(updated);
              }}
            />
            <div className="space-y-3 border-t border-[#fff8e4]/10 pt-3">
              <div><span className="text-[#fff8e4]/70">Condiciones crónicas: </span>{user.medicalInfo?.chronicConditions?.join(', ') || 'Ninguna'}</div>
              <div><span className="text-[#fff8e4]/70">Medicamentos: </span>{user.medicalInfo?.medications?.join(', ') || 'Ninguno'}</div>
              <div><span className="text-[#fff8e4]/70">Alergias: </span>{user.medicalInfo?.allergies?.join(', ') || 'Ninguna'}</div>
              <div><span className="text-[#fff8e4]/70">Lesiones: </span>{user.medicalInfo?.injuries?.join(', ') || 'Ninguna'}</div>
            </div>
          </CardContent>
        </Card>
      </SectionShell>
    );
  }

  if (section === 'files') {
    return (
      <SectionShell title="Mis archivos" onBack={back}>
        <PatientFilesTab patientId={user.id} canUpload={balance ? balance.hasActivePlan : true} />
      </SectionShell>
    );
  }

  if (section === 'plan') {
    return (
      <SectionShell title="Mi plan" onBack={back}>
        <Card>
          <CardContent className="pt-6">
            {balanceStatus === 'loading' ? (
              <LoadingState label="Consultando tu plan…" className="py-6" />
            ) : balanceStatus === 'error' ? (
              <LoadErrorAlert message="No pudimos consultar tu plan." onRetry={loadBalance} />
            ) : balance?.hasActivePlan && balance.plan ? (
              <div className="space-y-4">
                {balance.paymentPending && balance.paymentDueBy && <PaymentPendingBanner paymentDueBy={balance.paymentDueBy} />}
                <DetailList>
                  <DetailRow label="Tipo">{SERVICE_TYPE_LABELS[balance.plan.serviceType]}</DetailRow>
                  <DetailRow label="Sesiones">{formatPlanUsage(balance.plan)}</DetailRow>
                  <DetailRow label="Inicio">{format(parseISO(balance.plan.startDate), 'dd/MM/yyyy')}</DetailRow>
                  {formatCycleProgress(balance.plan) && <DetailRow label="Plan">{formatCycleProgress(balance.plan)}</DetailRow>}
                  <DetailRow label={balance.plan.openEnded ? 'Duración' : 'Vence'}>
                    {balance.plan.openEnded ? 'Hasta completar tus sesiones' : format(parseISO(balance.plan.endDate), 'dd/MM/yyyy')}
                  </DetailRow>
                  {balance.extraSessionsAvailable > 0 && <DetailRow label="Sesiones extra">{balance.extraSessionsAvailable}</DetailRow>}
                </DetailList>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-[#fff8e4]/75">No tienes un plan activo. Contacta a Prime F&H para activarlo o renovarlo.</p>
                <Button asChild variant="outline" className="min-h-[44px] border-[#398ca2] text-[#fff8e4] hover:bg-[#398ca2]/15 hover:text-[#fff8e4]">
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
      </SectionShell>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5">
      <PageTitle eyebrow="Mi perfil" title={<>Tu espacio<br />personal</>} />

      <section aria-label="Tu cuenta" className={cn('flex items-center gap-4 rounded-[24px] border p-5', HERO_SURFACE)}>
        <span aria-hidden="true" className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border border-[#398ca2]/60 bg-[#181619]/60 text-xl font-extrabold text-[#fff8e4]">{initialsOf(user)}</span>
        <div className="min-w-0 space-y-1">
          <p className="truncate text-xl font-bold tracking-tight text-[#fff8e4]">{user.firstName} {user.lastName}</p>
          <p className="truncate text-sm text-[#fff8e4]/72">{user.email}</p>
          {user.isFounder && <FounderBadge tone="brand" />}
        </div>
      </section>

      <nav aria-label="Secciones de tu perfil" className="space-y-2.5">
        <HubRow icon={UserRound} title="Datos personales" summary={user.phone ? `Contacto y preferencias · ${user.phone}` : 'Contacto y preferencias'} onClick={() => setSection('personal')} />
        <HubRow icon={Users} title="Contacto de emergencia" summary={hasEmergency ? (user.emergencyContact?.name ?? 'Registrado') : 'Aún sin registrar'} attention={hasEmergency ? undefined : 'Pendiente'} onClick={() => setSection('emergency')} />
        <HubRow icon={HeartPulse} title="Información médica" summary="Antecedentes, alergias y cuidados" onClick={() => setSection('medical')} />
        <HubRow icon={Activity} title="Mi plan" summary={planSummary} onClick={() => setSection('plan')} />
        <HubRow icon={FolderOpen} title="Mis archivos" summary="Exámenes, informes y documentos" onClick={() => setSection('files')} />
      </nav>

      <p className="flex items-start gap-2.5 rounded-2xl border border-[#398ca2]/30 bg-[#398ca2]/10 px-4 py-3 text-[13px] leading-relaxed text-[#fff8e4]/80">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#7cc0d2]" aria-hidden="true" />
        Tus datos de salud son privados: solo los ve el equipo de Prime F&amp;H que te atiende.
      </p>
    </div>
  );
};

export default MyProfile;
