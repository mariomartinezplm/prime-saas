import { useCallback, useEffect, useState } from 'react';
import { Views, type View } from 'react-big-calendar';
import { TriangleAlert } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { appointmentService } from '@/services/appointmentService';
import { userService } from '@/services/userService';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import AgendaList from '@/components/calendar/AgendaList';
import AppointmentCalendar from '@/components/calendar/AppointmentCalendar';
import AppointmentDetailDialog from '@/components/calendar/AppointmentDetailDialog';
import StatusLegend from '@/components/calendar/StatusLegend';
import { toEvents } from '@/components/calendar/calendarUtils';
import { BlockSkeleton, SkeletonRegion } from '@/components/shared/Skeletons';
import PageHeader from '@/components/shared/PageHeader';
import { notify } from '@/lib/notify';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import type { Appointment, User } from '@/types';

const AdminCalendar = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  // En móvil la semana en 7 columnas no cabe: se muestra como lista por día
  const isMobile = useMediaQuery('(max-width: 767px)');
  const [view, setView] = useState<View>(Views.WEEK);
  const [date, setDate] = useState(() => new Date());
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [professionals, setProfessionals] = useState<User[]>([]);
  const [selectedProfessional, setSelectedProfessional] = useState('all');
  const [selected, setSelected] = useState<Appointment | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  // El filtro por profesional solo lo respeta el servidor para el admin
  useEffect(() => {
    if (!isAdmin) return;
    Promise.all([userService.getAll({ role: 'admin' }), userService.getAll({ role: 'professional' })])
      .then(([admins, profs]) => setProfessionals([...admins.users, ...profs.users]))
      // El calendario sigue funcionando; solo falta el filtro, y se dice
      .catch(() => notify.error('No se pudo cargar la lista de profesionales: el filtro solo muestra "Todos". Recarga la página para intentarlo de nuevo.'));
  }, [isAdmin]);

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      const params: Record<string, string> = {};
      if (isAdmin && selectedProfessional !== 'all') params.professional = selectedProfessional;
      setAppointments(await appointmentService.getAll(params));
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [isAdmin, selectedProfessional]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Calendario"
        description="Toca una cita para ver el detalle, sincronizarla o cambiar su estado."
        actions={
          isAdmin && (
            <Select value={selectedProfessional} onValueChange={setSelectedProfessional}>
              <SelectTrigger className="w-[220px]" aria-label="Filtrar por profesional">
                <SelectValue placeholder="Todos los profesionales" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los profesionales</SelectItem>
                {professionals.map((prof) => (
                  <SelectItem key={prof.id} value={prof.id}>
                    {prof.firstName} {prof.lastName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )
        }
      />

      <StatusLegend />

      {failed && (
        <Alert variant="warning">
          <TriangleAlert className="h-4 w-4" aria-hidden="true" />
          <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
            <span>No se pudieron cargar las citas.</span>
            <Button variant="outline" size="sm" onClick={load}>
              Reintentar
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {loading ? (
        <SkeletonRegion label="Cargando citas…">
          <BlockSkeleton className="h-[520px]" />
        </SkeletonRegion>
      ) : isMobile ? (
        <AgendaList appointments={appointments} date={date} onNavigate={setDate} onSelect={setSelected} />
      ) : (
        <Card>
          <CardContent className="p-4">
            <AppointmentCalendar
              events={toEvents(appointments)}
              date={date}
              view={view}
              onNavigate={setDate}
              onView={setView}
              onSelectEvent={(event) => setSelected(event.resource)}
            />
          </CardContent>
        </Card>
      )}

      <AppointmentDetailDialog appointment={selected} onClose={() => setSelected(null)} onChanged={load} />
    </div>
  );
};

export default AdminCalendar;
