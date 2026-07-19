import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { clientPlanService } from '@/services/clientPlanService';
import { userService } from '@/services/userService';
import { PLAN_CATALOG, SERVICE_TYPE_LABELS, type ServiceType } from '@/config/planCatalog';
import { toast } from 'sonner';
import { Loader2, Search, Plus, X, Dumbbell, Stethoscope } from 'lucide-react';
import { format, parseISO, differenceInCalendarDays } from 'date-fns';
import { cn } from '@/lib/utils';
import type { ClientPlan, User } from '@/types';

const SERVICE_ICON: Record<ServiceType, typeof Dumbbell> = {
  entrenamiento: Dumbbell,
  kinesiologia: Stethoscope,
};

function daysRemaining(endDate: string): number {
  return differenceInCalendarDays(parseISO(endDate), new Date());
}

function rowHighlightClass(plan: ClientPlan): string {
  if (plan.status === 'expired') return 'border-l-4 border-l-red-500 bg-red-500/10';
  const remaining = daysRemaining(plan.endDate);
  if (plan.status === 'active' && remaining <= 5) return 'border-l-4 border-l-yellow-500 bg-yellow-500/10';
  return '';
}

function statusBadge(plan: ClientPlan) {
  if (plan.status === 'expired') {
    return <Badge className="bg-red-500/20 text-red-400">Vencido</Badge>;
  }
  const remaining = daysRemaining(plan.endDate);
  if (remaining <= 5) {
    return <Badge className="bg-yellow-500/20 text-yellow-600">Vence pronto</Badge>;
  }
  return <Badge className="bg-green-500/20 text-green-400">Activo</Badge>;
}

const Plans = () => {
  const [clientPlans, setClientPlans] = useState<ClientPlan[]>([]);
  const [patients, setPatients] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  // Dialog "Registrar pago"
  const [dialogOpen, setDialogOpen] = useState(false);
  const [patientSearch, setPatientSearch] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<User | null>(null);
  const [serviceType, setServiceType] = useState<ServiceType>('entrenamiento');
  const [sessionsTotal, setSessionsTotal] = useState<number>(PLAN_CATALOG.entrenamiento[0]);
  const [submitting, setSubmitting] = useState(false);

  // Confirmación de reemplazo de plan activo
  const [conflictPlan, setConflictPlan] = useState<ClientPlan | null>(null);

  const fetchClientPlans = async () => {
    try {
      const data = await clientPlanService.getAll();
      setClientPlans(data);
    } catch {
      toast.error('Error al cargar los planes');
    }
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [plans, patientsData] = await Promise.all([
          clientPlanService.getAll(),
          userService.getPatients(),
        ]);
        setClientPlans(plans);
        setPatients(patientsData);
      } catch {
        toast.error('Error al cargar los datos');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const filteredPatients = useMemo(() => {
    const term = patientSearch.toLowerCase();
    if (!term) return patients;
    return patients.filter(
      (p) =>
        p.firstName.toLowerCase().includes(term) ||
        p.lastName.toLowerCase().includes(term) ||
        p.email.toLowerCase().includes(term)
    );
  }, [patients, patientSearch]);

  const resetDialog = () => {
    setSelectedPatient(null);
    setPatientSearch('');
    setServiceType('entrenamiento');
    setSessionsTotal(PLAN_CATALOG.entrenamiento[0]);
    setConflictPlan(null);
  };

  const handleServiceTypeChange = (type: ServiceType) => {
    setServiceType(type);
    setSessionsTotal(PLAN_CATALOG[type][0]);
  };

  const submitPlan = async (replaceExisting: boolean) => {
    if (!selectedPatient) return;
    setSubmitting(true);
    try {
      await clientPlanService.create({
        patientId: selectedPatient.id,
        serviceType,
        sessionsTotal,
        replaceExisting,
      });
      toast.success('Plan registrado exitosamente');
      setConflictPlan(null);
      setDialogOpen(false);
      resetDialog();
      await fetchClientPlans();
    } catch (err: unknown) {
      const error = err as { response?: { status?: number; data?: { message?: string; data?: { existingPlan?: ClientPlan } } } };
      if (error.response?.status === 409 && error.response.data?.data?.existingPlan) {
        setConflictPlan(error.response.data.data.existingPlan);
      } else {
        toast.error(error.response?.data?.message || 'Error al registrar el plan');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submitPlan(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Planes</h1>
          <p className="text-muted-foreground">Gestión de planes y sesiones de pacientes</p>
        </div>
        <Button onClick={() => setDialogOpen(true)} className="w-full sm:w-auto">
          <Plus className="h-4 w-4 mr-2" />
          Registrar pago
        </Button>
      </div>

      {/* Catálogo de planes (referencia) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {(Object.keys(PLAN_CATALOG) as ServiceType[]).map((type) => {
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
                  {PLAN_CATALOG[type].map((n) => (
                    <span
                      key={n}
                      className="px-3 py-1 rounded-full text-sm bg-secondary/10 text-secondary border border-secondary/30"
                    >
                      {n} sesiones
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Lista de planes activos/vencidos */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-3">Planes de pacientes</h2>
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-secondary" />
          </div>
        ) : clientPlans.length === 0 ? (
          <p className="text-muted-foreground text-sm">No hay planes registrados todavía</p>
        ) : (
          <div className="space-y-3">
            {clientPlans.map((plan) => {
              const patient = typeof plan.patient === 'object' ? plan.patient : null;
              const remaining = daysRemaining(plan.endDate);
              return (
                <Card key={plan._id} className={cn('transition-colors', rowHighlightClass(plan))}>
                  <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <p className="font-medium">
                        {patient ? `${patient.firstName} ${patient.lastName}` : 'Paciente'}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {SERVICE_TYPE_LABELS[plan.serviceType]} · {plan.sessionsUsed}/{plan.sessionsTotal} sesiones usadas
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {format(parseISO(plan.startDate), 'dd/MM/yyyy')} → {format(parseISO(plan.endDate), 'dd/MM/yyyy')}
                        {plan.status === 'active' && (
                          <> · {remaining >= 0 ? `${remaining} día(s) restante(s)` : 'vencido'}</>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 sm:flex-col sm:items-end">
                      {statusBadge(plan)}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
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
            <DialogTitle>Registrar pago</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Paso 1: Paciente */}
            <div className="space-y-2">
              <Label>Paciente</Label>
              {selectedPatient ? (
                <div className="flex items-center justify-between p-2 rounded-md border bg-secondary/10">
                  <span className="text-sm font-medium">
                    {selectedPatient.firstName} {selectedPatient.lastName}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => setSelectedPatient(null)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por nombre o email..."
                      value={patientSearch}
                      onChange={(e) => setPatientSearch(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <div className="max-h-40 overflow-y-auto space-y-1 border rounded-md p-1">
                    {filteredPatients.length === 0 ? (
                      <p className="text-xs text-muted-foreground p-2">Sin resultados</p>
                    ) : (
                      filteredPatients.map((p) => (
                        <button
                          type="button"
                          key={p.id}
                          onClick={() => setSelectedPatient(p)}
                          className="w-full text-left p-2 rounded-md hover:bg-secondary/10 text-sm"
                        >
                          <span className="font-medium">{p.firstName} {p.lastName}</span>
                          <span className="text-muted-foreground ml-2 text-xs">{p.email}</span>
                        </button>
                      ))
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Paso 2: Tipo de plan */}
            <div className="space-y-2">
              <Label>Tipo de plan</Label>
              <div className="grid grid-cols-2 gap-3">
                {(Object.keys(PLAN_CATALOG) as ServiceType[]).map((type) => {
                  const Icon = SERVICE_ICON[type];
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => handleServiceTypeChange(type)}
                      className={cn(
                        'p-3 rounded-lg border-2 text-left transition-all',
                        serviceType === type
                          ? 'border-secondary bg-secondary/10 shadow-sm'
                          : 'border-gray-200 hover:border-gray-300'
                      )}
                    >
                      <Icon className="h-4 w-4 mb-1 text-secondary" />
                      <p className="text-sm font-semibold">{SERVICE_TYPE_LABELS[type]}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Paso 3: Sesiones */}
            <div className="space-y-2">
              <Label>Sesiones del plan</Label>
              <Select
                key={serviceType}
                value={String(sessionsTotal)}
                onValueChange={(v) => setSessionsTotal(Number(v))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PLAN_CATALOG[serviceType].map((n) => (
                    <SelectItem key={n} value={String(n)}>{n} sesiones</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Ciclo de 30 días desde hoy ({format(new Date(), 'dd/MM/yyyy')}).
              </p>
            </div>

            <DialogFooter>
              <Button type="submit" disabled={!selectedPatient || submitting} className="w-full">
                {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Confirmar pago
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Confirmación de reemplazo de plan activo */}
      <AlertDialog open={!!conflictPlan} onOpenChange={(open) => !open && setConflictPlan(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Este paciente ya tiene un plan activo</AlertDialogTitle>
            <AlertDialogDescription>
              {conflictPlan && (
                <>
                  Plan actual: {SERVICE_TYPE_LABELS[conflictPlan.serviceType]} — {conflictPlan.sessionsUsed}/{conflictPlan.sessionsTotal} sesiones usadas,
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
