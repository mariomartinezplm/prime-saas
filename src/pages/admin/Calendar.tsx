import { useState, useEffect, useCallback } from 'react';
import { Calendar as BigCalendar, dateFnsLocalizer, Views } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { useAuth } from '@/contexts/AuthContext';
import { appointmentService } from '@/services/appointmentService';
import { userService } from '@/services/userService';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import type { Appointment, User } from '@/types';
import 'react-big-calendar/lib/css/react-big-calendar.css';

const locales = { es };
const localizer = dateFnsLocalizer({ format, parse, startOfWeek, getDay, locales });

interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  resource: Appointment;
}

const AdminCalendar = () => {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [professionals, setProfessionals] = useState<User[]>([]);
  const [selectedProfessional, setSelectedProfessional] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProfessionals = async () => {
      try {
        const [admins, profs] = await Promise.all([
          userService.getAll({ role: 'admin' }),
          userService.getAll({ role: 'professional' }),
        ]);
        setProfessionals([...admins.users, ...profs.users]);
      } catch {
        // ignore
      }
    };
    fetchProfessionals();
  }, []);

  useEffect(() => {
    const fetchAppointments = async () => {
      setLoading(true);
      try {
        const params: Record<string, string> = {};
        if (selectedProfessional !== 'all') {
          params.professional = selectedProfessional;
        }
        const data = await appointmentService.getAll(params);
        setAppointments(data);
      } catch {
        toast.error('Error al cargar citas');
      } finally {
        setLoading(false);
      }
    };
    fetchAppointments();
  }, [selectedProfessional]);

  const events: CalendarEvent[] = appointments.map((apt) => {
    const patient = typeof apt.patient === 'object' ? apt.patient : null;
    const dateStr = apt.date.split('T')[0];
    const [startH, startM] = apt.startTime.split(':').map(Number);
    const [endH, endM] = apt.endTime.split(':').map(Number);

    const start = new Date(dateStr);
    start.setHours(startH, startM, 0);
    const end = new Date(dateStr);
    end.setHours(endH, endM, 0);

    return {
      id: apt._id,
      title: patient ? `${patient.firstName} ${patient.lastName} - ${apt.type}` : apt.type,
      start,
      end,
      resource: apt,
    };
  });

  const eventStyleGetter = (event: CalendarEvent) => {
    const status = event.resource.status;
    let backgroundColor = 'hsl(194 45% 44%)'; // secondary/teal
    if (status === 'cancelled') backgroundColor = '#ef4444';
    if (status === 'completed') backgroundColor = '#22c55e';
    if (status === 'no-show') backgroundColor = '#f59e0b';

    return {
      style: {
        backgroundColor,
        borderRadius: '4px',
        opacity: 0.9,
        color: 'white',
        border: 'none',
        fontSize: '12px',
      },
    };
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Calendario</h1>
          <p className="text-muted-foreground">Vista de citas por profesional</p>
        </div>
        <Select value={selectedProfessional} onValueChange={setSelectedProfessional}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Todos los profesionales" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {professionals.map((prof) => (
              <SelectItem key={prof.id} value={prof.id}>
                {prof.firstName} {prof.lastName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="h-[600px] [&_.rbc-toolbar]:mb-4 [&_.rbc-toolbar_button]:text-foreground [&_.rbc-header]:bg-muted/30 [&_.rbc-today]:bg-secondary/10">
            <BigCalendar
              localizer={localizer}
              events={events}
              defaultView={Views.WEEK}
              views={[Views.WEEK, Views.DAY, Views.MONTH]}
              min={new Date(2024, 0, 1, 7, 0)}
              max={new Date(2024, 0, 1, 21, 0)}
              eventPropGetter={eventStyleGetter}
              messages={{
                today: 'Hoy',
                previous: 'Anterior',
                next: 'Siguiente',
                month: 'Mes',
                week: 'Semana',
                day: 'Día',
                noEventsInRange: 'No hay citas en este rango',
              }}
              culture="es"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminCalendar;
