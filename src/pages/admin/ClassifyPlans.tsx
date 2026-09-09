import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { userService } from '@/services/userService';
import { clientPlanService } from '@/services/clientPlanService';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PLAN_CATALOG, SERVICE_TYPE_LABELS, type ServiceType } from '@/config/planCatalog';
import { toast } from 'sonner';
import { ArrowLeft, Loader2, Dumbbell, Stethoscope, PartyPopper } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { User } from '@/types';

const KINESIOLOGIA_SESSIONS_FIJAS = 10;

const SERVICE_ICON: Record<ServiceType, typeof Dumbbell> = {
  entrenamiento: Dumbbell,
  kinesiologia: Stethoscope,
};

interface RowState {
  serviceType: ServiceType;
  sessionsTotal: number;
  submitting: boolean;
}

const ClassifyPlans = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isProfessional = user?.role === 'professional';

  const [patients, setPatients] = useState<User[]>([]);
  const [patientsWithoutPlan, setPatientsWithoutPlan] = useState<User[]>([]);
  const [rowState, setRowState] = useState<Record<string, RowState>>({});
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [patientsData, clientPlans] = await Promise.all([
        userService.getPatients(
          isProfessional && user
            ? { assignedProfessionalId: user.id, isActive: true, limit: 200 }
            : { isActive: true, limit: 200 }
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
            { serviceType: 'kinesiologia' as ServiceType, sessionsTotal: KINESIOLOGIA_SESSIONS_FIJAS, submitting: false },
          ])
        )
      );
    } catch {
      toast.error('Error al cargar los pacientes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isProfessional]);

  const handleServiceTypeChange = (patientId: string, type: ServiceType) => {
    setRowState((prev) => ({
      ...prev,
      [patientId]: {
        ...prev[patientId],
        serviceType: type,
        sessionsTotal: type === 'kinesiologia' ? KINESIOLOGIA_SESSIONS_FIJAS : PLAN_CATALOG.entrenamiento[0],
      },
    }));
  };

  const handleSessionsChange = (patientId: string, sessionsTotal: number) => {
    setRowState((prev) => ({ ...prev, [patientId]: { ...prev[patientId], sessionsTotal } }));
  };

  const handleAsignar = async (patient: User) => {
    const row = rowState[patient.id];
    if (!row) return;

    setRowState((prev) => ({ ...prev, [patient.id]: { ...prev[patient.id], submitting: true } }));
    try {
      await clientPlanService.create({
        patientId: patient.id,
        serviceType: row.serviceType,
        sessionsTotal: row.sessionsTotal,
      });
      toast.success(`Plan asignado a ${patient.firstName} ${patient.lastName}`);
      setPatientsWithoutPlan((prev) => prev.filter((p) => p.id !== patient.id));
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      toast.error(error.response?.data?.message || 'Error al asignar el plan');
      setRowState((prev) => ({ ...prev, [patient.id]: { ...prev[patient.id], submitting: false } }));
    }
  };

  const withPlanCount = useMemo(
    () => patients.length - patientsWithoutPlan.length,
    [patients, patientsWithoutPlan]
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/app/admin/planes')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Clasificar pacientes sin plan</h1>
          <p className="text-muted-foreground">
            Asigna el plan inicial a cada paciente que todavía no tiene uno activo.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-secondary" />
        </div>
      ) : patientsWithoutPlan.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
            <PartyPopper className="h-8 w-8 text-secondary" />
            <p className="font-medium">
              {patients.length === 0
                ? 'No tienes pacientes asignados todavía'
                : 'Todos tus pacientes ya tienen un plan asignado'}
            </p>
          </CardContent>
        </Card>
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
                    <div className="grid grid-cols-2 gap-2 flex-1">
                      {(Object.keys(PLAN_CATALOG) as ServiceType[]).map((type) => {
                        const Icon = SERVICE_ICON[type];
                        return (
                          <button
                            key={type}
                            type="button"
                            onClick={() => handleServiceTypeChange(patient.id, type)}
                            className={cn(
                              'p-2 rounded-lg border-2 text-left transition-all text-sm',
                              row.serviceType === type
                                ? 'border-secondary bg-secondary/10'
                                : 'border-gray-200 hover:border-gray-300'
                            )}
                          >
                            <Icon className="h-4 w-4 mb-1 text-secondary" />
                            {SERVICE_TYPE_LABELS[type]}
                          </button>
                        );
                      })}
                    </div>

                    {row.serviceType === 'entrenamiento' ? (
                      <Select
                        value={String(row.sessionsTotal)}
                        onValueChange={(v) => handleSessionsChange(patient.id, Number(v))}
                      >
                        <SelectTrigger className="sm:w-36"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {PLAN_CATALOG.entrenamiento.map((n) => (
                            <SelectItem key={n} value={String(n)}>{n} sesiones</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <span className="text-sm text-muted-foreground sm:w-36 text-center">
                        {KINESIOLOGIA_SESSIONS_FIJAS} sesiones (fijo)
                      </span>
                    )}

                    <Button onClick={() => handleAsignar(patient)} disabled={row.submitting} className="sm:w-28">
                      {row.submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Asignar
                    </Button>
                  </div>
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
