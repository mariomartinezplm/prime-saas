import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { clientPlanService } from '@/services/clientPlanService';
import { userService } from '@/services/userService';
import SessionsSelect from '@/components/plans/SessionsSelect';
import PlanTermFields from '@/components/plans/PlanTermFields';
import FounderBadge from '@/components/plans/FounderBadge';
import {
  SERVICE_TYPE_LABELS,
  DEFAULT_CHOICE,
  choiceLabel,
  choiceToPayload,
  formatPlanUsage,
  formatCycleProgress,
  formatPaymentDeadline,
  sessionChoicesFor,
  type ServiceType,
  type SessionsChoice,
  type PlanTerm,
  type BillingCycle,
} from '@/config/planCatalog';
import { notify } from '@/lib/notify';
import { getErrorMessage } from '@/lib/apiError';
import PageHeader from '@/components/shared/PageHeader';
import { ListSkeleton, SkeletonRegion } from '@/components/shared/Skeletons';
import EmptyState from '@/components/shared/EmptyState';
import { StatusBadge } from '@/components/shared/StatusBadge';
import SubmitButton from '@/components/forms/SubmitButton';
import { Loader2, Search, Plus, X, Dumbbell, Stethoscope, ClipboardList, Clock, TriangleAlert, FileText } from 'lucide-react';
import { format, parseISO, differenceInCalendarDays } from 'date-fns';
import { cn } from '@/lib/utils';
import type { ClientPlan, User } from '@/types';
import RenewsCheckbox from '@/components/plans/RenewsCheckbox';
import GraceDaysField, { DEFAULT_GRACE_DAYS, MAX_GRACE_DAYS } from '@/components/plans/GraceDaysField';
import EditGraceDaysDialog from '@/components/plans/EditGraceDaysDialog';
import EditStartDateDialog from '@/components/plans/EditStartDateDialog';
import StartDateField from '@/components/plans/StartDateField';

const SERVICE_ICON: Record<ServiceType, typeof Dumbbell> = {
  entrenamiento: Dumbbell,
  kinesiologia: Stethoscope,
};

function daysRemaining(endDate: string): number {
  return differenceInCalendarDays(parseISO(endDate), new Date());
}

// Un mes intermedio de un plan trimestral/anual no "vence pronto": el siguiente ya está pagado
const isLastCycle = (plan: ClientPlan) => (plan.cycleNumber ?? 1) >= (plan.cyclesTotal ?? 1);

// Kinesiología «hasta completar»: sin fecha de término; está terminado cuando ya no quedan sesiones
const isCompletedOpenEnded = (plan: ClientPlan) => !!plan.openEnded && plan.status === 'active' && plan.sessionsUsed >= plan.sessionsTotal;

function rowHighlightClass(plan: ClientPlan): string {
  if (isCompletedOpenEnded(plan)) return 'border-l-4 border-l-warning bg-warning/10';
  if (plan.openEnded) return '';
  if (plan.status === 'expired') return 'border-l-4 border-l-destructive bg-destructive/10';
  if (plan.paymentPending) return 'border-l-4 border-l-warning bg-warning/10';
  const remaining = daysRemaining(plan.endDate);
  if (plan.status === 'active' && isLastCycle(plan) && remaining <= 5) return 'border-l-4 border-l-warning bg-warning/10';
  return '';
}

// ¿Conviene ofrecer «Renovar»? Plan vencido o en su último ciclo y a pocos días de vencer (el pendiente de pago tiene su propio botón)
function canRenew(plan: ClientPlan): boolean {
  if (isCompletedOpenEnded(plan)) return true;
  if (plan.openEnded) return false;
  if (plan.paymentPending) return false;
  if (plan.status === 'expired') return true;
  return plan.status === 'active' && isLastCycle(plan) && daysRemaining(plan.endDate) <= 5;
}

function statusBadge(plan: ClientPlan) {
  if (isCompletedOpenEnded(plan)) return <StatusBadge tone="warning">Sesiones completadas</StatusBadge>;
  if (plan.openEnded && plan.status === 'active') return <StatusBadge tone="success">Activo</StatusBadge>;
  if (plan.openEnded && plan.status === 'expired') return <StatusBadge tone="neutral">Completado</StatusBadge>;
  if (plan.status === 'expired') return <StatusBadge tone="danger">Vencido</StatusBadge>;
  if (plan.paymentPending) return <StatusBadge tone="warning">Pendiente de pago</StatusBadge>;
  const remaining = daysRemaining(plan.endDate);
  if (isLastCycle(plan) && remaining <= 5) return <StatusBadge tone="warning">Vence pronto</StatusBadge>;
  return <StatusBadge tone="success">Activo</StatusBadge>;
}

const Plans = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [clientPlans, setClientPlans] = useState<ClientPlan[]>([]);
  const [patients, setPatients] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const submittingRef = useRef(false);

  // Dialog "Registrar pago"
  const [dialogOpen, setDialogOpen] = useState(false);
  const [patientSearch, setPatientSearch] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<User | null>(null);
  const [serviceType, setServiceType] = useState<ServiceType>('entrenamiento');
  const [choice, setChoice] = useState<SessionsChoice>(DEFAULT_CHOICE.entrenamiento);
  const [term, setTerm] = useState<PlanTerm>('mensual');
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('calendar');
  const [renews, setRenews] = useState(true);
  const [graceDays, setGraceDays] = useState(DEFAULT_GRACE_DAYS);
  const [startDate, setStartDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [graceEditPlan, setGraceEditPlan] = useState<ClientPlan | null>(null);
  const [startEditPlan, setStartEditPlan] = useState<ClientPlan | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Confirmación de reemplazo de plan activo
  const [conflictPlan, setConflictPlan] = useState<ClientPlan | null>(null);

  const fetchClientPlans = async () => {
    try {
      setClientPlans(await clientPlanService.getAll());
    } catch (err) {
      notify.error(getErrorMessage(err, 'El pago se registró, pero no se pudo actualizar la lista. Recarga la página.'));
    }
  };

  const load = useCallback(async () => {
    setLoading(true);
    setLoadFailed(false);
    try {
      // getAllPatients recorre todas las páginas: con más de 50 pacientes el buscador dejaba a los demás fuera
      const [plans, patientsData] = await Promise.all([clientPlanService.getAll(), userService.getAllPatients()]);
      setClientPlans(plans);
      setPatients(patientsData);
    } catch {
      setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Sin tildes ni mayúsculas: "matias" encuentra a "Matías"
  const filteredPatients = useMemo(() => {
    const clean = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    const q = clean(patientSearch.trim());
    if (!q) return patients;
    return patients.filter((p) => clean(`${p.firstName} ${p.lastName} ${p.email}`).includes(q));
  }, [patients, patientSearch]);

  const resetDialog = () => {
    setSelectedPatient(null);
    setPatientSearch('');
    setServiceType('entrenamiento');
    setChoice(DEFAULT_CHOICE.entrenamiento);
    setTerm('mensual');
    setBillingCycle('calendar');
    setRenews(true);
    setGraceDays(DEFAULT_GRACE_DAYS);
    setStartDate(format(new Date(), 'yyyy-MM-dd'));
    setConflictPlan(null);
  };

  // Plan pendiente de pago del paciente elegido (si lo tiene)
  const pendingOfSelected = useMemo(
    () => (selectedPatient
      ? clientPlans.find((p) => p.paymentPending && p.status === 'active' && (typeof p.patient === 'object' ? p.patient.id : p.patient) === selectedPatient.id)
      : undefined),
    [clientPlans, selectedPatient]
  );

  // "Registrar pago" desde una tarjeta pendiente: abre el diálogo ya completado
  const openPaymentFor = (plan: ClientPlan) => {
    if (typeof plan.patient !== 'object') return;
    const patient = patients.find((p) => p.id === (plan.patient as User).id) ?? (plan.patient as User);
    setSelectedPatient(patient);
    setServiceType(plan.serviceType);
    setChoice(plan.unlimited ? 'ilimitado' : plan.sessionsTotal);
    setTerm(plan.term ?? 'mensual');
    setBillingCycle(plan.billingCycle ?? 'calendar');
    setGraceDays(plan.graceDays ?? DEFAULT_GRACE_DAYS);
    setDialogOpen(true);
  };

  // Desde la ficha del paciente («Renovar plan»): abre el diálogo con ese paciente y, si ya tuvo un plan, con el mismo plan ya completado
  const renewPatientId = searchParams.get('paciente');
  const renewHandled = useRef(false);
  useEffect(() => {
    if (!renewPatientId || loading || loadFailed || renewHandled.current) return;
    renewHandled.current = true;
    const patient = patients.find((p) => p.id === renewPatientId);
    if (patient) {
      const idOf = (plan: ClientPlan) => (typeof plan.patient === 'object' ? plan.patient.id : plan.patient);
      const last = clientPlans.filter((plan) => idOf(plan) === patient.id).sort((a, b) => b.endDate.localeCompare(a.endDate))[0];
      if (last) {
        openPaymentFor(last);
      } else {
        setSelectedPatient(patient);
        setDialogOpen(true);
      }
    }
    setSearchParams({}, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [renewPatientId, loading, loadFailed, patients, clientPlans]);

  const handleServiceTypeChange = (type: ServiceType) => {
    setServiceType(type);
    setChoice(DEFAULT_CHOICE[type]);
  };

  const submitPlan = async (replaceExisting: boolean) => {
    if (!selectedPatient || submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    try {
      await clientPlanService.create({
        patientId: selectedPatient.id,
        serviceType,
        ...choiceToPayload(choice),
        term,
        billingCycle,
        renews,
        graceDays: Number.isInteger(graceDays) ? graceDays : undefined,
        startDate: pendingOfSelected ? undefined : startDate || undefined,
        replaceExisting,
      });
      notify.success('Plan registrado exitosamente');
      setConflictPlan(null);
      setDialogOpen(false);
      resetDialog();
      await fetchClientPlans();
    } catch (err: unknown) {
      const error = err as { response?: { status?: number; data?: { message?: string; data?: { existingPlan?: ClientPlan } } } };
      if (error.response?.status === 409 && error.response.data?.data?.existingPlan) {
        setConflictPlan(error.response.data.data.existingPlan);
      } else {
        notify.error(error.response?.data?.message || 'No se pudo registrar el plan. Intenta de nuevo.');
      }
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submitPlan(false);
  };

  const pendingPlans = clientPlans.filter((p) => p.paymentPending && p.status === 'active');
  const otherPlans = clientPlans.filter((p) => !(p.paymentPending && p.status === 'active'));

  const renderPlanCard = (plan: ClientPlan) => {
    const patient = typeof plan.patient === 'object' ? plan.patient : null;
    const remaining = daysRemaining(plan.endDate);
    const cycleProgress = formatCycleProgress(plan);
    return (
      <Card key={plan._id} className={cn('transition-colors', rowHighlightClass(plan))}>
        <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <p className="font-medium flex items-center gap-2 flex-wrap">
              {patient ? `${patient.firstName} ${patient.lastName}` : 'Paciente'}
              {patient?.isFounder && <FounderBadge compact />}
            </p>
            <p className="text-sm text-muted-foreground">
              {SERVICE_TYPE_LABELS[plan.serviceType]} · {formatPlanUsage(plan)}
              {cycleProgress && <> · {cycleProgress}</>}
            </p>
            <p className="text-xs text-muted-foreground">
              {plan.openEnded
                ? <>Desde el {format(parseISO(plan.startDate), 'dd/MM/yyyy')} · hasta completar las sesiones</>
                : <>{format(parseISO(plan.startDate), 'dd/MM/yyyy')} → {format(parseISO(plan.endDate), 'dd/MM/yyyy')}</>}
              {plan.paymentPending && plan.paymentDueBy && (
                <> · paga hasta el {formatPaymentDeadline(plan.paymentDueBy)}</>
              )}
              {plan.status === 'active' && !plan.paymentPending && !plan.openEnded && (
                <> · {remaining >= 0 ? `${remaining} día(s) restante(s)` : 'vencido'}</>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2 sm:flex-col sm:items-end">
            {statusBadge(plan)}
            {plan.paymentPending && (
              <Button size="sm" variant="outline" onClick={() => openPaymentFor(plan)}>
                Registrar pago
              </Button>
            )}
            {plan.status !== 'cancelled' && (plan.cycleNumber ?? 1) === 1 && (
              <Button size="sm" variant="ghost" onClick={() => setStartEditPlan(plan)}>
                Fecha de inicio
              </Button>
            )}
            {!plan.openEnded && plan.renews !== false && (plan.status === 'active' || plan.status === 'upcoming') && (
              <Button size="sm" variant="ghost" onClick={() => setGraceEditPlan(plan)}>
                Plazo de pago
              </Button>
            )}
            {canRenew(plan) && (
              <Button size="sm" variant="outline" onClick={() => openPaymentFor(plan)}>
                Renovar
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Planes"
        description="Gestión de planes y sesiones de pacientes"
        actions={
          <>
            <Button variant="outline" onClick={() => navigate('/app/admin/planes/clasificar')}>
              <ClipboardList aria-hidden="true" />
              Clasificar pacientes sin plan
            </Button>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus aria-hidden="true" />
              Renovar plan / registrar pago
            </Button>
          </>
        }
      />

      {loadFailed && (
        <Alert variant="warning">
          <TriangleAlert className="h-4 w-4" aria-hidden="true" />
          <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
            <span>No se pudieron cargar los planes ni los pacientes.</span>
            <Button variant="outline" size="sm" onClick={load}>
              Reintentar
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Catálogo de planes (referencia) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {(Object.keys(SERVICE_TYPE_LABELS) as ServiceType[]).map((type) => {
          const Icon = SERVICE_ICON[type];
          return (
            <Card key={type}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Icon className="h-4 w-4 text-secondary" />
                  {SERVICE_TYPE_LABELS[type]}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {sessionChoicesFor(type).map((c) => (
                    <span
                      key={c}
                      className="px-3 py-1 rounded-full text-sm bg-secondary/10 text-secondary border border-secondary/30"
                    >
                      {choiceLabel(c)}
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Pendientes de pago: lo primero que el admin necesita ver */}
      {pendingPlans.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-foreground mb-1 flex items-center gap-2">
            <Clock className="h-5 w-5 text-warning" />
            Pendientes de pago ({pendingPlans.length})
          </h2>
          <p className="text-sm text-muted-foreground mb-3">
            Pueden seguir agendando hasta su fecha límite. Si no pagan, el plan vence solo.
          </p>
          <div className="space-y-3">
            {pendingPlans.map((plan) => renderPlanCard(plan))}
          </div>
        </div>
      )}

      {/* Lista de planes activos/vencidos */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-3">Planes de pacientes</h2>
        {loading ? (
          <SkeletonRegion label="Cargando planes…">
            <ListSkeleton rows={4} />
          </SkeletonRegion>
        ) : loadFailed ? null : otherPlans.length === 0 ? (
          <EmptyState icon={FileText} title="No hay planes registrados todavía" description="Los planes que registres aparecerán aquí." />
        ) : (
          <div className="space-y-3">
            {otherPlans.map((plan) => renderPlanCard(plan))}
          </div>
        )}
      </div>

      {/* Dialog: Registrar pago */}
      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) resetDialog();
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Renovar plan o registrar pago</DialogTitle>
            <DialogDescription>Elige al paciente y el plan que pagó (una renovación es registrar el pago del plan que viene). Quedará registrado como pagado.</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Paso 1: Paciente */}
            <div className="space-y-2">
              <Label htmlFor="plan-patient-search">Paciente</Label>
              {selectedPatient ? (
                <div className="flex items-center justify-between gap-2 rounded-md border border-primary/40 bg-primary/10 p-2 pl-3">
                  <span className="text-sm font-medium">
                    {selectedPatient.firstName} {selectedPatient.lastName}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Cambiar de paciente"
                    onClick={() => setSelectedPatient(null)}
                  >
                    <X aria-hidden="true" />
                  </Button>
                </div>
              ) : (
                <>
                  <div className="relative">
                    <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="plan-patient-search"
                      type="search"
                      autoComplete="off"
                      placeholder="Buscar por nombre o correo"
                      value={patientSearch}
                      onChange={(e) => setPatientSearch(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <ul className="max-h-44 space-y-1 overflow-y-auto rounded-md border border-border p-1" aria-label="Pacientes">
                    {filteredPatients.length === 0 ? (
                      <li className="p-2 text-xs text-muted-foreground">Sin resultados</li>
                    ) : (
                      filteredPatients.map((p) => (
                        <li key={p.id}>
                          <button
                            type="button"
                            onClick={() => setSelectedPatient(p)}
                            className="flex min-h-11 w-full flex-col items-start justify-center rounded-md px-2 py-1 text-left text-sm hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            <span className="font-medium">{p.firstName} {p.lastName}</span>
                            <span className="text-xs text-muted-foreground">{p.email}</span>
                          </button>
                        </li>
                      ))
                    )}
                  </ul>
                </>
              )}
            </div>

            {/* Paso 2: Tipo de plan */}
            <div className="space-y-2" role="radiogroup" aria-labelledby="plan-type-label">
              <Label id="plan-type-label">Tipo de plan</Label>
              <div className="grid grid-cols-2 gap-3">
                {(Object.keys(SERVICE_TYPE_LABELS) as ServiceType[]).map((type) => {
                  const Icon = SERVICE_ICON[type];
                  return (
                    <button
                      key={type}
                      type="button"
                      role="radio"
                      aria-checked={serviceType === type}
                      onClick={() => handleServiceTypeChange(type)}
                      className={cn(
                        'rounded-lg border-2 p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        serviceType === type
                          ? 'border-primary bg-primary/10 shadow-sm'
                          : 'border-border hover:border-muted-foreground/40'
                      )}
                    >
                      <Icon aria-hidden="true" className="mb-1 h-4 w-4 text-secondary" />
                      <p className="text-sm font-semibold">{SERVICE_TYPE_LABELS[type]}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Paso 3: Sesiones */}
            <div className="space-y-2">
              <Label htmlFor="plan-sessions">{serviceType === 'kinesiologia' ? 'Sesiones del plan' : 'Sesiones por mes'}</Label>
              <SessionsSelect id="plan-sessions" serviceType={serviceType} value={choice} onChange={setChoice} />
            </div>

            {!pendingOfSelected && <StartDateField id="plan-start-date-new" value={startDate} onChange={setStartDate} />}

            {/* Paso 4: Duración, ciclo y renovación (kinesiología no los tiene: dura hasta completar las sesiones) */}
            {serviceType === 'kinesiologia' ? (
              <p className="text-xs rounded-md border border-border bg-muted/40 p-3 text-muted-foreground">
                Kinesiología se paga por sesiones: el plan dura hasta que se completen, sin fecha de término ni renovación mensual.
              </p>
            ) : pendingOfSelected ? (
              <p className="text-xs rounded-md border border-warning/40 bg-warning/10 p-3 text-warning">
                Este paciente tiene la renovación pendiente de pago. Al confirmar se marca como pagada
                (mismo ciclo) y conserva las sesiones que ya usó.
              </p>
            ) : (
              <PlanTermFields
                allowAnnual={isAdmin}
                term={term}
                billingCycle={billingCycle}
                onTermChange={setTerm}
                onBillingCycleChange={setBillingCycle}
              />
            )}
            {serviceType !== 'kinesiologia' && <RenewsCheckbox id="plan-renews" checked={renews} onChange={setRenews} />}
            {serviceType !== 'kinesiologia' && renews && (
              <GraceDaysField id="plan-grace-days" value={graceDays} onChange={setGraceDays} billingCycle={billingCycle} />
            )}

            <DialogFooter>
              <SubmitButton disabled={!selectedPatient || !(Number.isInteger(graceDays) && graceDays >= 0 && graceDays <= MAX_GRACE_DAYS)} loading={submitting} loadingLabel="Registrando…" className="w-full">
                Confirmar pago
              </SubmitButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <EditStartDateDialog
        plan={startEditPlan}
        patientName={startEditPlan && typeof startEditPlan.patient === 'object' ? `${startEditPlan.patient.firstName} ${startEditPlan.patient.lastName}` : 'el paciente'}
        onClose={() => setStartEditPlan(null)}
        onSaved={fetchClientPlans}
      />

      <EditGraceDaysDialog
        plan={graceEditPlan}
        patientName={graceEditPlan && typeof graceEditPlan.patient === 'object' ? `${graceEditPlan.patient.firstName} ${graceEditPlan.patient.lastName}` : 'el paciente'}
        onClose={() => setGraceEditPlan(null)}
        onSaved={fetchClientPlans}
      />

      {/* Confirmación de reemplazo de plan activo */}
      <AlertDialog open={!!conflictPlan} onOpenChange={(open) => !open && setConflictPlan(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Este paciente ya tiene un plan activo</AlertDialogTitle>
            <AlertDialogDescription>
              {conflictPlan && (
                <>
                  Plan actual: {SERVICE_TYPE_LABELS[conflictPlan.serviceType]} — {formatPlanUsage(conflictPlan)},
                  vence el {format(parseISO(conflictPlan.endDate), 'dd/MM/yyyy')}.
                  <br /><br />
                  Si continúas, el plan actual se cancelará y <strong>las sesiones restantes se perderán</strong>. Esta acción no se puede deshacer.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction disabled={submitting} onClick={() => submitPlan(true)}>
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Sí, reemplazar plan
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Plans;
