import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { userService } from '@/services/userService';
import { clientPlanService } from '@/services/clientPlanService';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import PageHeader from '@/components/shared/PageHeader';
import { ListSkeleton, SkeletonRegion } from '@/components/shared/Skeletons';
import EmptyState from '@/components/shared/EmptyState';
import SessionsSelect from '@/components/plans/SessionsSelect';
import PlanTermFields from '@/components/plans/PlanTermFields';
import {
  PLAN_CATALOG,
  SERVICE_TYPE_LABELS,
  DEFAULT_CHOICE,
  choiceToPayload,
  type ServiceType,
  type SessionsChoice,
  type PlanTerm,
  type BillingCycle,
} from '@/config/planCatalog';
import { notify } from '@/lib/notify';
import { getErrorMessage } from '@/lib/apiError';
import { ArrowLeft, Loader2, Dumbbell, Stethoscope, PartyPopper, TriangleAlert, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { User } from '@/types';
import RenewsCheckbox from '@/components/plans/RenewsCheckbox';

const SERVICE_ICON: Record<ServiceType, typeof Dumbbell> = {
  entrenamiento: Dumbbell,
  kinesiologia: Stethoscope,
};

interface RowState {
  serviceType: ServiceType;
  choice: SessionsChoice;
  term: PlanTerm;
  billingCycle: BillingCycle;
  renews: boolean;
  submitting: boolean;
}

const ClassifyPlans = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isProfessional = user?.role === 'professional';
  const userId = user?.id;

  const [patients, setPatients] = useState<User[]>([]);
  const [patientsWithoutPlan, setPatientsWithoutPlan] = useState<User[]>([]);
  const [rowState, setRowState] = useState<Record<string, RowState>>({});
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const assigningRef = useRef(new Set<string>());

  const load = useCallback(async () => {
    setLoading(true);
    setLoadFailed(false);
    try {
      const [patientsData, clientPlans] = await Promise.all([
        // Todas las páginas: antes se pedían 200 y el resto de los pacientes nunca aparecía
        userService.getAllPatients(
          isProfessional && userId ? { assignedProfessionalId: userId, isActive: true } : { isActive: true }
        ),
        clientPlanService.getAll(),
      ]);

      const idsConPlanActivo = new Set(
        clientPlans
          .filter((plan) => plan.status === 'active')
          .map((plan) => (typeof plan.patient === 'object' ? plan.patient.id : plan.patient))
      );

      const sinPlan = patientsData.filter((p) => !idsConPlanActivo.has(p.id));
      setPatients(patientsData);
      setPatientsWithoutPlan(sinPlan);
      setRowState(
        Object.fromEntries(
          sinPlan.map((p) => [
            p.id,
            { serviceType: 'kinesiologia' as ServiceType, choice: DEFAULT_CHOICE.kinesiologia, term: 'mensual' as PlanTerm, billingCycle: 'calendar' as BillingCycle, renews: true, submitting: false },
          ])
        )
      );
    } catch {
      setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  }, [isProfessional, userId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleServiceTypeChange = (patientId: string, type: ServiceType) => {
    setRowState((prev) => ({
      ...prev,
      [patientId]: {
        ...prev[patientId],
        serviceType: type,
        choice: DEFAULT_CHOICE[type],
      },
    }));
  };

  const handleSessionsChange = (patientId: string, choice: SessionsChoice) => {
    setRowState((prev) => ({ ...prev, [patientId]: { ...prev[patientId], choice } }));
  };

  const handleTermChange = (patientId: string, term: PlanTerm) => {
    setRowState((prev) => ({ ...prev, [patientId]: { ...prev[patientId], term } }));
  };

  const handleBillingCycleChange = (patientId: string, billingCycle: BillingCycle) => {
    setRowState((prev) => ({ ...prev, [patientId]: { ...prev[patientId], billingCycle } }));
  };

  const handleRenewsChange = (patientId: string, renews: boolean) => {
    setRowState((prev) => ({ ...prev, [patientId]: { ...prev[patientId], renews } }));
  };

  const handleAsignar = async (patient: User) => {
    const row = rowState[patient.id];
    // El doble clic no asigna el plan dos veces
    if (!row || assigningRef.current.has(patient.id)) return;
    assigningRef.current.add(patient.id);

    setRowState((prev) => ({ ...prev, [patient.id]: { ...prev[patient.id], submitting: true } }));
    try {
      await clientPlanService.create({
        patientId: patient.id,
        serviceType: row.serviceType,
        ...choiceToPayload(row.choice),
        term: row.term,
        billingCycle: row.billingCycle,
        renews: row.renews,
      });
      notify.success(`Plan asignado a ${patient.firstName} ${patient.lastName}`);
      setPatientsWithoutPlan((prev) => prev.filter((p) => p.id !== patient.id));
    } catch (err: unknown) {
      notify.error(getErrorMessage(err, 'No se pudo asignar el plan. Intenta de nuevo.'));
      setRowState((prev) => ({ ...prev, [patient.id]: { ...prev[patient.id], submitting: false } }));
    } finally {
      assigningRef.current.delete(patient.id);
    }
  };

  const withPlanCount = useMemo(
    () => patients.length - patientsWithoutPlan.length,
    [patients, patientsWithoutPlan]
  );

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Button variant="ghost" size="sm" className="-ml-3" onClick={() => navigate('/app/admin/planes')}>
          <ArrowLeft aria-hidden="true" />
          Planes
        </Button>
        <PageHeader
          title="Clasificar pacientes sin plan"
          description="Asigna el plan inicial a cada paciente que todavía no tiene uno activo."
        />
      </div>

      {loadFailed && (
        <Alert variant="warning">
          <TriangleAlert className="h-4 w-4" aria-hidden="true" />
          <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
            <span>No se pudieron cargar los pacientes.</span>
            <Button variant="outline" size="sm" onClick={load}>
              Reintentar
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {loading ? (
        <SkeletonRegion label="Cargando pacientes…">
          <ListSkeleton rows={4} />
        </SkeletonRegion>
      ) : loadFailed ? null : patientsWithoutPlan.length === 0 ? (
        <EmptyState
          icon={patients.length === 0 ? Users : PartyPopper}
          title={patients.length === 0 ? 'No tienes pacientes asignados todavía' : 'Todos tus pacientes ya tienen un plan asignado'}
        />
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {patientsWithoutPlan.length} sin plan · {withPlanCount} ya clasificados
          </p>
          {patientsWithoutPlan.map((patient) => {
            const row = rowState[patient.id];
            if (!row) return null;
            return (
              <Card key={patient.id}>
                <CardContent className="p-4 space-y-3">
                  <div>
                    <p className="font-medium">{patient.firstName} {patient.lastName}</p>
                    <p className="text-sm text-muted-foreground">{patient.email}</p>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                    <div
                      className="grid grid-cols-2 gap-2 flex-1"
                      role="radiogroup"
                      aria-label={`Tipo de plan de ${patient.firstName} ${patient.lastName}`}
                    >
                      {(Object.keys(PLAN_CATALOG) as ServiceType[]).map((type) => {
                        const Icon = SERVICE_ICON[type];
                        return (
                          <button
                            key={type}
                            type="button"
                            role="radio"
                            aria-checked={row.serviceType === type}
                            onClick={() => handleServiceTypeChange(patient.id, type)}
                            className={cn(
                              'rounded-lg border-2 p-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                              row.serviceType === type
                                ? 'border-primary bg-primary/10'
                                : 'border-border hover:border-muted-foreground/40'
                            )}
                          >
                            <Icon aria-hidden="true" className="mb-1 h-4 w-4 text-secondary" />
                            {SERVICE_TYPE_LABELS[type]}
                          </button>
                        );
                      })}
                    </div>

                    <SessionsSelect
                      serviceType={row.serviceType}
                      value={row.choice}
                      onChange={(choice) => handleSessionsChange(patient.id, choice)}
                      ariaLabel={`Sesiones por mes de ${patient.firstName} ${patient.lastName}`}
                      className="sm:w-40"
                    />

                    <Button
                      onClick={() => handleAsignar(patient)}
                      disabled={row.submitting}
                      aria-busy={row.submitting || undefined}
                      className="sm:w-32"
                    >
                      {row.submitting && <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden="true" />}
                      {row.submitting ? 'Asignando…' : 'Asignar'}
                      <span className="sr-only"> plan a {patient.firstName} {patient.lastName}</span>
                    </Button>
                  </div>

                  {row.serviceType === 'kinesiologia' ? (
                    <p className="text-xs text-muted-foreground">Kinesiología: dura hasta completar las sesiones (sin fecha de término ni renovación mensual).</p>
                  ) : (
                    <>
                      <PlanTermFields
                        compact
                        allowAnnual={user?.role === 'admin'}
                        term={row.term}
                        billingCycle={row.billingCycle}
                        onTermChange={(t) => handleTermChange(patient.id, t)}
                        onBillingCycleChange={(c) => handleBillingCycleChange(patient.id, c)}
                      />
                      <RenewsCheckbox
                        compact
                        id={`renews-${patient.id}`}
                        checked={row.renews}
                        onChange={(value) => handleRenewsChange(patient.id, value)}
                      />
                    </>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ClassifyPlans;
