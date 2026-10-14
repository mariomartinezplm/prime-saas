import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Download, Loader2, MoreHorizontal, Plus, RefreshCw, Search, TriangleAlert, UserPlus, Users, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { userService } from '@/services/userService';
import { clientPlanService } from '@/services/clientPlanService';
import { extraSessionService } from '@/services/extraSessionService';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import AirtableImportDialog from '@/components/admin/AirtableImportDialog';
import FounderBadge from '@/components/plans/FounderBadge';
import PlanLine from '@/components/patients/PlanLine';
import EmptyState from '@/components/shared/EmptyState';
import { ListSkeleton, SkeletonRegion } from '@/components/shared/Skeletons';
import PageHeader from '@/components/shared/PageHeader';
import { ActiveStatusBadge, InviteStatusBadge } from '@/components/shared/StatusBadge';
import { inviteStatusMeta } from '@/components/shared/statusMeta';
import type { ServiceType } from '@/config/planCatalog';
import { planInfoByPatient, type PatientPlanInfo, type PlanState } from '@/lib/patientPlan';
import { showApiError } from '@/lib/apiError';
import { notify } from '@/lib/notify';
import type { ClientPlan, InviteStatus, User } from '@/types';

type StatusFilter = 'all' | 'active' | 'inactive';
type PlanFilter = 'all' | 'with' | 'pending' | 'soon' | 'none';
type InviteFilter = 'all' | InviteStatus;
type SortKey = 'name' | 'recent' | 'planEnd';

// Sin tildes ni mayúsculas: "matias" encuentra a "Matías"
const normalize = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const digits = (text: string) => text.replace(/[^0-9kK]/g, '').toLowerCase();

const planFilterMatches = (filter: PlanFilter, state: PlanState) => {
  switch (filter) {
    case 'with':
      return state === 'active' || state === 'soon' || state === 'pending';
    case 'pending':
      return state === 'pending';
    case 'soon':
      return state === 'soon';
    case 'none':
      return state === 'none' || state === 'expired';
    default:
      return true;
  }
};

const PatientList = () => {
  const { user } = useAuth();
  const isProfessional = user?.role === 'professional';
  const isAdmin = user?.role === 'admin';

  const [patients, setPatients] = useState<User[]>([]);
  // null = no se pudieron cargar los planes (la lista igual funciona, sin esa información)
  const [planInfo, setPlanInfo] = useState<Map<string, PatientPlanInfo> | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [planFilter, setPlanFilter] = useState<PlanFilter>('all');
  const [inviteFilter, setInviteFilter] = useState<InviteFilter>('all');
  const [sort, setSort] = useState<SortKey>('name');

  const [importOpen, setImportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Sesión extra
  const [extraOpen, setExtraOpen] = useState(false);
  const [extraPatientId, setExtraPatientId] = useState('');
  const [extraServiceType, setExtraServiceType] = useState<ServiceType>('entrenamiento');
  const [extraReason, setExtraReason] = useState('');
  const [submittingExtra, setSubmittingExtra] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      // El servidor limita ambas listas al alcance de quien pregunta (profesional: sus pacientes)
      const [list, plans] = await Promise.allSettled([userService.getAllPatients(), clientPlanService.getAll()]);
      if (list.status === 'rejected') throw list.reason;
      setPatients(list.value);
      setPlanInfo(plans.status === 'fulfilled' ? planInfoByPatient(plans.value as ClientPlan[]) : null);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleExportCSV = async () => {
    setExporting(true);
    try {
      await userService.exportCSV();
    } catch (err) {
      showApiError(err, 'No se pudo exportar el CSV');
    } finally {
      setExporting(false);
    }
  };

  const filtersActive = search !== '' || status !== 'all' || planFilter !== 'all' || inviteFilter !== 'all';
  const clearFilters = () => {
    setSearch('');
    setStatus('all');
    setPlanFilter('all');
    setInviteFilter('all');
  };

  const visible = useMemo(() => {
    const term = normalize(search.trim());
    const termDigits = digits(search);
    const infoOf = (p: User) => planInfo?.get(p.id);

    const filtered = patients.filter((p) => {
      if (status === 'active' && !p.isActive) return false;
      if (status === 'inactive' && p.isActive) return false;
      if (planInfo && planFilter !== 'all' && !planFilterMatches(planFilter, infoOf(p)?.state ?? 'none')) return false;
      if (inviteFilter !== 'all' && p.inviteStatus !== inviteFilter) return false;
      if (!term) return true;
      return (
        normalize(`${p.firstName} ${p.lastName}`).includes(term) ||
        normalize(p.email).includes(term) ||
        (termDigits.length >= 3 && !!p.rut && digits(p.rut).includes(termDigits))
      );
    });

    const byName = (a: User, b: User) => a.lastName.localeCompare(b.lastName, 'es') || a.firstName.localeCompare(b.firstName, 'es');
    return [...filtered].sort((a, b) => {
      if (sort === 'recent') return (b.createdAt ?? '').localeCompare(a.createdAt ?? '') || byName(a, b);
      if (sort === 'planEnd') {
        const endA = infoOf(a)?.plan?.endDate ?? '9999';
        const endB = infoOf(b)?.plan?.endDate ?? '9999';
        return endA.localeCompare(endB) || byName(a, b);
      }
      return byName(a, b);
    });
  }, [patients, planInfo, search, status, planFilter, inviteFilter, sort]);

  const resetExtra = () => {
    setExtraPatientId('');
    setExtraServiceType('entrenamiento');
    setExtraReason('');
  };

  const handleCreateExtra = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!extraPatientId || submittingExtra) return;
    setSubmittingExtra(true);
    try {
      await extraSessionService.create({ patientId: extraPatientId, serviceType: extraServiceType, reason: extraReason.trim() || undefined });
      notify.success('Sesión extra otorgada');
      setExtraOpen(false);
      resetExtra();
      load();
    } catch (err) {
      showApiError(err, 'No se pudo otorgar la sesión extra');
    } finally {
      setSubmittingExtra(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pacientes"
        description={loading ? undefined : `${patients.length} ${patients.length === 1 ? 'paciente' : 'pacientes'}`}
        actions={
          <>
            <Button asChild>
              <Link to="/app/admin/registro">
                <UserPlus aria-hidden="true" />
                Nuevo paciente
              </Link>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" aria-label="Más acciones">
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {isProfessional && (
                  <DropdownMenuItem onSelect={() => setExtraOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
                    Agregar sesión extra
                  </DropdownMenuItem>
                )}
                {isAdmin && (
                  <>
                    <DropdownMenuItem onSelect={handleExportCSV} disabled={exporting}>
                      {exporting ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                      ) : (
                        <Download className="mr-2 h-4 w-4" aria-hidden="true" />
                      )}
                      Exportar CSV
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => setImportOpen(true)}>
                      <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
                      Importar de Airtable
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      />

      <div className="space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            type="search"
            aria-label="Buscar paciente"
            placeholder="Buscar por nombre, correo o RUT"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
          <Select value={status} onValueChange={(v) => setStatus(v as StatusFilter)}>
            <SelectTrigger className="w-full sm:w-[140px]" aria-label="Filtrar por estado">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="active">Activos</SelectItem>
              <SelectItem value="inactive">Inactivos</SelectItem>
            </SelectContent>
          </Select>
          {planInfo && (
            <Select value={planFilter} onValueChange={(v) => setPlanFilter(v as PlanFilter)}>
              <SelectTrigger className="w-full sm:w-[200px]" aria-label="Filtrar por plan">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Cualquier plan</SelectItem>
                <SelectItem value="with">Con plan activo</SelectItem>
                <SelectItem value="pending">Pendiente de pago</SelectItem>
                <SelectItem value="soon">Vence pronto</SelectItem>
                <SelectItem value="none">Sin plan o vencido</SelectItem>
              </SelectContent>
            </Select>
          )}
          {patients.some((p) => p.inviteStatus) && (
            <Select value={inviteFilter} onValueChange={(v) => setInviteFilter(v as InviteFilter)}>
              <SelectTrigger className="w-full sm:w-[200px]" aria-label="Filtrar por invitación">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Cualquier invitación</SelectItem>
                {(Object.keys(inviteStatusMeta) as InviteStatus[]).map((s) => (
                  <SelectItem key={s} value={s}>
                    {inviteStatusMeta[s].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <div className="col-span-2 sm:col-span-1">
            <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
            <SelectTrigger className="w-full sm:w-[210px]" aria-label="Ordenar por">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name">Orden: apellido A–Z</SelectItem>
              <SelectItem value="recent">Orden: registro reciente</SelectItem>
              {planInfo && <SelectItem value="planEnd">Orden: plan que vence antes</SelectItem>}
            </SelectContent>
          </Select>
          </div>
          {filtersActive && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <X aria-hidden="true" />
              Limpiar filtros
            </Button>
          )}
        </div>
      </div>

      {planInfo === null && !loading && !failed && (
        <Alert variant="warning">
          <TriangleAlert className="h-4 w-4" aria-hidden="true" />
          <AlertDescription>No se pudo cargar la información de planes; la lista se muestra sin ella.</AlertDescription>
        </Alert>
      )}

      {loading ? (
        <SkeletonRegion label="Cargando pacientes…">
          <ListSkeleton rows={7} />
        </SkeletonRegion>
      ) : failed ? (
        <Alert variant="warning">
          <TriangleAlert className="h-4 w-4" aria-hidden="true" />
          <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
            <span>No se pudo cargar la lista de pacientes.</span>
            <Button variant="outline" size="sm" onClick={load}>
              Reintentar
            </Button>
          </AlertDescription>
        </Alert>
      ) : visible.length === 0 ? (
        filtersActive ? (
          <EmptyState
            icon={Search}
            title="Ningún paciente coincide"
            description="Prueba con otro nombre o quita algún filtro."
            action={
              <Button variant="outline" size="sm" onClick={clearFilters}>
                Limpiar filtros
              </Button>
            }
          />
        ) : (
          <EmptyState
            icon={Users}
            title={isProfessional ? 'Todavía no tienes pacientes asignados' : 'Todavía no hay pacientes'}
            action={
              <Button asChild size="sm">
                <Link to="/app/admin/registro">Registrar paciente</Link>
              </Button>
            }
          />
        )
      ) : (
        <>
          {filtersActive && (
            <p className="text-sm text-muted-foreground" aria-live="polite">
              {visible.length} de {patients.length}
            </p>
          )}
          <ul className="space-y-2">
            {visible.map((patient) => (
              <li key={patient.id}>
                <Link
                  to={`/app/admin/pacientes/${patient.id}`}
                  className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  <Card className="flex items-center gap-3 p-4 transition-colors hover:border-secondary hover:bg-accent/30">
                    <span
                      aria-hidden="true"
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary/15 text-sm font-semibold text-secondary"
                    >
                      {patient.firstName[0]}
                      {patient.lastName[0]}
                    </span>
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-medium">
                        <span>
                          {patient.firstName} {patient.lastName}
                        </span>
                        {patient.isFounder && <FounderBadge compact />}
                        {patient.exemptFromCapacity && <Badge variant="accent">Sobre cupo</Badge>}
                        {patient.inviteStatus && <InviteStatusBadge status={patient.inviteStatus} />}
                      </p>
                      <p className="truncate text-sm text-muted-foreground">{patient.email}</p>
                      {planInfo && <PlanLine info={planInfo.get(patient.id)} className="block" />}
                    </div>
                    <ActiveStatusBadge isActive={patient.isActive} className="shrink-0 self-start" />
                    <ChevronRight className="hidden h-4 w-4 shrink-0 text-muted-foreground sm:block" aria-hidden="true" />
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}

      <Dialog
        open={extraOpen}
        onOpenChange={(open) => {
          setExtraOpen(open);
          if (!open) resetExtra();
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Agregar sesión extra</DialogTitle>
            <DialogDescription>Otorga una sesión adicional a un paciente, fuera de su plan.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateExtra} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="extra-patient">Paciente</Label>
              <Select value={extraPatientId} onValueChange={setExtraPatientId}>
                <SelectTrigger id="extra-patient">
                  <SelectValue placeholder="Selecciona un paciente" />
                </SelectTrigger>
                <SelectContent>
                  {[...patients]
                    .sort((a, b) => a.lastName.localeCompare(b.lastName, 'es'))
                    .map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.firstName} {p.lastName}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="extra-type">Tipo de servicio</Label>
              <Select value={extraServiceType} onValueChange={(v) => setExtraServiceType(v as ServiceType)}>
                <SelectTrigger id="extra-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="entrenamiento">Entrenamiento</SelectItem>
                  <SelectItem value="kinesiologia">Kinesiología</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="extra-reason">Motivo (opcional)</Label>
              <Textarea
                id="extra-reason"
                value={extraReason}
                onChange={(e) => setExtraReason(e.target.value)}
                maxLength={300}
                placeholder="Ej: compensación por cancelación del centro"
              />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={!extraPatientId || submittingExtra} className="w-full">
                {submittingExtra && <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden="true" />}
                Otorgar sesión
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {isAdmin && <AirtableImportDialog open={importOpen} onOpenChange={setImportOpen} onImported={load} />}
    </div>
  );
};

export default PatientList;
