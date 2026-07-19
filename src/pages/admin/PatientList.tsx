import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { userService } from '@/services/userService';
import { clientPlanService } from '@/services/clientPlanService';
import { extraSessionService } from '@/services/extraSessionService';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, UserPlus, ChevronRight, RefreshCw, Plus, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { format, parseISO, differenceInCalendarDays } from 'date-fns';
import { SERVICE_TYPE_LABELS, type ServiceType } from '@/config/planCatalog';
import type { User, SessionBalance } from '@/types';

const PatientList = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isProfessional = user?.role === 'professional';

  const [patients, setPatients] = useState<User[]>([]);
  const [balances, setBalances] = useState<Record<string, SessionBalance>>({});
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  // Dialog "Agregar sesión extra"
  const [extraDialogOpen, setExtraDialogOpen] = useState(false);
  const [extraPatientId, setExtraPatientId] = useState('');
  const [extraServiceType, setExtraServiceType] = useState<ServiceType>('entrenamiento');
  const [extraReason, setExtraReason] = useState('');
  const [submittingExtra, setSubmittingExtra] = useState(false);

  const fetchPatients = async () => {
    setLoading(true);
    try {
      const data = await userService.getPatients(
        isProfessional && user ? { assignedProfessionalId: user.id } : undefined
      );
      setPatients(data);

      if (isProfessional && data.length > 0) {
        const entries = await Promise.all(
          data.map(async (p) => {
            try {
              return [p.id, await clientPlanService.getBalance(p.id)] as const;
            } catch {
              return [p.id, null] as const;
            }
          })
        );
        const map: Record<string, SessionBalance> = {};
        entries.forEach(([id, balance]) => {
          if (balance) map[id] = balance;
        });
        setBalances(map);
      }
    } catch (error) {
      console.error('Error fetching patients:', error);
      toast.error('Error al cargar la lista de pacientes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPatients();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isProfessional]);

  const handleSyncAirtable = async () => {
    setSyncing(true);
    try {
      const result = await userService.syncAirtable();
      toast.success(`Sincronización completa: ${result.syncedCount} pacientes creados/actualizados.`);
      // Refrescar la lista para mostrar los nuevos/actualizados
      await fetchPatients();
    } catch (error: any) {
      console.error('Error syncing Airtable:', error);
      toast.error(error.response?.data?.message || 'Error al conectar con Airtable');
    } finally {
      setSyncing(false);
    }
  };

  const filtered = patients.filter((p) => {
    const term = search.toLowerCase();
    return (
      p.firstName.toLowerCase().includes(term) ||
      p.lastName.toLowerCase().includes(term) ||
      p.email.toLowerCase().includes(term) ||
      (p.rut && p.rut.includes(term))
    );
  });

  const resetExtraDialog = () => {
    setExtraPatientId('');
    setExtraServiceType('entrenamiento');
    setExtraReason('');
  };

  const handleCreateExtraSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!extraPatientId) return;
    setSubmittingExtra(true);
    try {
      await extraSessionService.create({
        patientId: extraPatientId,
        serviceType: extraServiceType,
        reason: extraReason || undefined,
      });
      toast.success('Sesión extra otorgada exitosamente');
      setExtraDialogOpen(false);
      resetExtraDialog();
      await fetchPatients();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      toast.error(error.response?.data?.message || 'Error al otorgar la sesión extra');
    } finally {
      setSubmittingExtra(false);
    }
  };

  const planInfoFor = (patientId: string) => {
    const balance = balances[patientId];
    if (!balance) return null;

    if (!balance.hasActivePlan) {
      return <span className="text-xs text-red-400 font-medium">Sin plan activo / vencido</span>;
    }

    const plan = balance.plan!;
    const daysLeft = differenceInCalendarDays(parseISO(plan.endDate), new Date());
    const isSoon = daysLeft <= 5;

    return (
      <span className={`text-xs ${isSoon ? 'text-yellow-500' : 'text-muted-foreground'}`}>
        {SERVICE_TYPE_LABELS[plan.serviceType]} · {plan.sessionsTotal - plan.sessionsUsed} sesión(es) restante(s) · vence {format(parseISO(plan.endDate), 'dd/MM/yyyy')}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Pacientes</h1>
          <p className="text-muted-foreground">
            {patients.length} {isProfessional ? 'pacientes asignados' : 'pacientes registrados'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isProfessional && (
            <Button variant="outline" onClick={() => setExtraDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Agregar sesión extra
            </Button>
          )}
          <Button variant="outline" onClick={handleSyncAirtable} disabled={syncing}>
            <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
            Sincronizar Airtable
          </Button>
          <Button onClick={() => navigate('/app/admin/registro')}>
            <UserPlus className="h-4 w-4 mr-2" />
            Nuevo paciente
          </Button>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nombre, email o RUT..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-secondary" />
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((patient) => (
            <Card
              key={patient.id}
              className="cursor-pointer hover:border-secondary transition-colors"
              onClick={() => navigate(`/app/admin/pacientes/${patient.id}`)}
            >
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-secondary/20 flex items-center justify-center shrink-0">
                    <span className="text-secondary font-bold text-sm">
                      {patient.firstName[0]}{patient.lastName[0]}
                    </span>
                  </div>
                  <div>
                    <p className="font-medium">{patient.firstName} {patient.lastName}</p>
                    <p className="text-sm text-muted-foreground">{patient.email}</p>
                    {isProfessional && <div className="mt-0.5">{planInfoFor(patient.id)}</div>}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {patient.rut && (
                    <span className="text-sm text-muted-foreground hidden sm:inline">{patient.rut}</span>
                  )}
                  <Badge className={patient.isActive ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}>
                    {patient.isActive ? 'Activo' : 'Inactivo'}
                  </Badge>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          ))}
          {filtered.length === 0 && (
            <p className="text-muted-foreground text-sm text-center py-8">
              {isProfessional ? 'No tienes pacientes asignados todavía' : 'No se encontraron pacientes'}
            </p>
          )}
        </div>
      )}

      {/* Dialog: Agregar sesión extra */}
      <Dialog
        open={extraDialogOpen}
        onOpenChange={(open) => {
          setExtraDialogOpen(open);
          if (!open) resetExtraDialog();
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Agregar sesión extra</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateExtraSession} className="space-y-4">
            <div className="space-y-2">
              <Label>Paciente</Label>
              <Select value={extraPatientId} onValueChange={setExtraPatientId}>
                <SelectTrigger><SelectValue placeholder="Selecciona un paciente" /></SelectTrigger>
                <SelectContent>
                  {patients.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.firstName} {p.lastName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Tipo de servicio</Label>
              <Select key={extraServiceType} value={extraServiceType} onValueChange={(v) => setExtraServiceType(v as ServiceType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="entrenamiento">Entrenamiento</SelectItem>
                  <SelectItem value="kinesiologia">Kinesiología</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Motivo (opcional)</Label>
              <Textarea
                value={extraReason}
                onChange={(e) => setExtraReason(e.target.value)}
                placeholder="Ej: compensación por cancelación del centro"
              />
            </div>

            <DialogFooter>
              <Button type="submit" disabled={!extraPatientId || submittingExtra} className="w-full">
                {submittingExtra && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Confirmar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PatientList;
