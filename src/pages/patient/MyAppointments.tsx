import { useState, useEffect } from 'react';
import { appointmentService } from '@/services/appointmentService';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { format, parseISO, isBefore, addHours } from 'date-fns';
import { es } from 'date-fns/locale';
import { X, Loader2 } from 'lucide-react';
import type { Appointment } from '@/types';

const statusColors: Record<string, string> = {
  scheduled: 'bg-blue-500/20 text-blue-400',
  completed: 'bg-green-500/20 text-green-400',
  cancelled: 'bg-red-500/20 text-red-400',
  'no-show': 'bg-yellow-500/20 text-yellow-400',
};

const statusLabels: Record<string, string> = {
  scheduled: 'Programada',
  completed: 'Completada',
  cancelled: 'Cancelada',
  'no-show': 'No asistió',
};

const MyAppointments = () => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    fetchAppointments();
  }, []);

  const fetchAppointments = async () => {
    try {
      const data = await appointmentService.getAll();
      setAppointments(data);
    } catch {
      toast.error('Error al cargar citas');
    } finally {
      setLoading(false);
    }
  };

  const now = new Date();
  const upcoming = appointments.filter(
    (a) => a.status === 'scheduled' && !isBefore(parseISO(a.date), now)
  );
  const past = appointments.filter(
    (a) => a.status === 'completed' || (a.status === 'scheduled' && isBefore(parseISO(a.date), now))
  );
  const cancelled = appointments.filter((a) => a.status === 'cancelled');

  const canCancel = (apt: Appointment): boolean => {
    if (apt.status !== 'scheduled') return false;
    const aptDateTime = new Date(`${apt.date.split('T')[0]}T${apt.startTime}`);
    return isBefore(addHours(now, 24), aptDateTime);
  };

  const handleCancel = async () => {
    if (!cancellingId) return;
    setCancelling(true);
    try {
      await appointmentService.cancel(cancellingId, cancelReason);
      toast.success('Cita cancelada');
      setCancelDialogOpen(false);
      setCancelReason('');
      setCancellingId(null);
      fetchAppointments();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      toast.error(error.response?.data?.message || 'Error al cancelar');
    } finally {
      setCancelling(false);
    }
  };

  const AppointmentCard = ({ apt }: { apt: Appointment }) => {
    const professional = typeof apt.professional === 'object' ? apt.professional : null;
    return (
      <div className="flex items-center justify-between p-4 rounded-lg border border-border">
        <div>
          <p className="font-medium">
            {format(parseISO(apt.date), "EEEE d 'de' MMMM", { locale: es })}
          </p>
          <p className="text-sm text-muted-foreground">
            {apt.startTime} - {apt.endTime}
          </p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-muted-foreground capitalize">{apt.type}</span>
            {professional && (
              <span className="text-xs text-secondary">
                {professional.firstName} {professional.lastName}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge className={statusColors[apt.status]}>{statusLabels[apt.status]}</Badge>
          {canCancel(apt) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setCancellingId(apt._id);
                setCancelDialogOpen(true);
              }}
            >
              <X className="h-4 w-4 text-destructive" />
            </Button>
          )}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-secondary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Mis Citas</h1>
        <p className="text-muted-foreground">Gestiona tus sesiones</p>
      </div>

      <Tabs defaultValue="upcoming">
        <TabsList>
          <TabsTrigger value="upcoming">Próximas ({upcoming.length})</TabsTrigger>
          <TabsTrigger value="past">Historial ({past.length})</TabsTrigger>
          <TabsTrigger value="cancelled">Canceladas ({cancelled.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="upcoming" className="space-y-3 mt-4">
          {upcoming.length === 0 ? (
            <p className="text-muted-foreground text-sm">No tienes citas próximas</p>
          ) : (
            upcoming.map((apt) => <AppointmentCard key={apt._id} apt={apt} />)
          )}
        </TabsContent>

        <TabsContent value="past" className="space-y-3 mt-4">
          {past.length === 0 ? (
            <p className="text-muted-foreground text-sm">No tienes citas anteriores</p>
          ) : (
            past.map((apt) => <AppointmentCard key={apt._id} apt={apt} />)
          )}
        </TabsContent>

        <TabsContent value="cancelled" className="space-y-3 mt-4">
          {cancelled.length === 0 ? (
            <p className="text-muted-foreground text-sm">No tienes citas canceladas</p>
          ) : (
            cancelled.map((apt) => <AppointmentCard key={apt._id} apt={apt} />)
          )}
        </TabsContent>
      </Tabs>

      {/* Cancel dialog */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancelar Cita</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Las citas deben cancelarse con al menos 24 horas de anticipación.
            </p>
            <div className="space-y-2">
              <Label>Razón de cancelación (opcional)</Label>
              <Input
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Motivo..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelDialogOpen(false)}>
              Volver
            </Button>
            <Button variant="destructive" onClick={handleCancel} disabled={cancelling}>
              {cancelling ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Confirmar cancelación
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MyAppointments;
