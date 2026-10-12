import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { userService } from '@/services/userService';
import { appointmentService } from '@/services/appointmentService';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import EmptyState from '@/components/shared/EmptyState';
import LoadingState from '@/components/shared/LoadingState';
import PageHeader from '@/components/shared/PageHeader';
import { appointmentTypeLabels } from '@/components/shared/statusMeta';
import WellnessTrendsSummary from '@/components/wellness/WellnessTrendsSummary';
import { todayLocal } from '@/lib/evolutionDate';
import { capitalizeFirst } from '@/lib/utils';
import { CalendarDays, CalendarX, CalendarClock, TriangleAlert, UserPlus, Users } from 'lucide-react';
import { addDays, format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import type { Appointment, User } from '@/types';

// Las fechas de cita vienen como medianoche UTC del día calendario: se usan solo los 10 primeros caracteres.
const dayOf = (apt: Appointment) => apt.date.slice(0, 10);

const personName = (value: User | string, fallback: string) =>
  typeof value === 'object' && value ? `${value.firstName} ${value.lastName}` : fallback;

const personId = (value: User | string) =>
  typeof value === 'object' && value ? (value.id ?? (value as { _id?: string })._id) : undefined;

const timeRange = (apt: Appointment) => `${apt.startTime} – ${apt.endTime}`;

const StatCard = ({
  to,
  title,
  value,
  hint,
  icon: Icon,
  className,
}: {
  to: string;
  title: string;
  value: string;
  hint: string;
  icon: typeof Users;
  className?: string;
}) => (
  <Link
    to={to}
    className={`group block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${className ?? ''}`}
  >
    <Card className="h-full transition-colors group-hover:bg-accent/40">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-2 sm:p-6 sm:pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
      </CardHeader>
      <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
        <p className="text-2xl font-semibold tracking-tight sm:text-3xl">{value}</p>
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  </Link>
);

const AdminDashboard = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [patients, setPatients] = useState<{ total: number; active: number } | null>(null);
  // null = no se pudo cargar (se distingue de "0 citas")
  const [appointments, setAppointments] = useState<Appointment[] | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const from = todayLocal();
    const to = format(addDays(new Date(), 7), 'yyyy-MM-dd');
    // El servidor limita cada respuesta al alcance de quien pregunta (profesional: sus pacientes y sus citas).
    const [all, active, upcoming] = await Promise.allSettled([
      userService.getAll({ role: 'patient', limit: 1 }),
      userService.getAll({ role: 'patient', isActive: true, limit: 1 }),
      appointmentService.getAll({ status: 'scheduled', from, to }),
    ]);
    setPatients(all.status === 'fulfilled' && active.status === 'fulfilled' ? { total: all.value.total, active: active.value.total } : null);
    setAppointments(upcoming.status === 'fulfilled' ? upcoming.value : null);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <LoadingState label="Cargando tu panel…" />;

  const today = todayLocal();
  const todayList = appointments?.filter((a) => dayOf(a) === today) ?? [];
  const nextDays = appointments?.filter((a) => dayOf(a) > today) ?? [];
  const failed = patients === null || appointments === null;

  const todayLabel = format(new Date(), "EEEE d 'de' MMMM", { locale: es });

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Hola, ${user?.firstName ?? ''}`}
        description={capitalizeFirst(todayLabel)}
        actions={
          <>
            <Button asChild variant="outline">
              <Link to="/app/admin/calendario">
                <CalendarDays aria-hidden="true" />
                Ver calendario
              </Link>
            </Button>
            <Button asChild>
              <Link to="/app/admin/registro">
                <UserPlus aria-hidden="true" />
                Registrar paciente
              </Link>
            </Button>
          </>
        }
      />

      {failed && (
        <Alert variant="warning">
          <TriangleAlert className="h-4 w-4" aria-hidden="true" />
          <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
            <span>No se pudieron cargar algunos datos del panel.</span>
            <Button variant="outline" size="sm" onClick={load}>
              Reintentar
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
        <StatCard
          to="/app/admin/pacientes"
          title={isAdmin ? 'Pacientes' : 'Mis pacientes'}
          value={patients ? String(patients.total) : '—'}
          hint={patients ? `${patients.active} activos` : 'Sin datos'}
          icon={Users}
          className="col-span-2 sm:col-span-1"
        />
        <StatCard
          to="/app/admin/calendario"
          title="Citas de hoy"
          value={appointments ? String(todayList.length) : '—'}
          hint={appointments ? 'programadas' : 'Sin datos'}
          icon={CalendarDays}
        />
        <StatCard
          to="/app/admin/calendario"
          title="Próximos 7 días"
          value={appointments ? String(nextDays.length) : '—'}
          hint={appointments ? 'citas, sin contar hoy' : 'Sin datos'}
          icon={CalendarClock}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-lg">Agenda de hoy</CardTitle>
          </CardHeader>
          <CardContent>
            {appointments === null ? (
              <p className="text-sm text-muted-foreground">No se pudo cargar la agenda.</p>
            ) : todayList.length === 0 ? (
              <EmptyState
                icon={CalendarX}
                title="No hay citas programadas para hoy"
                action={
                  <Button asChild variant="outline" size="sm">
                    <Link to="/app/admin/calendario">Ver calendario</Link>
                  </Button>
                }
              />
            ) : (
              <ul className="space-y-2">
                {todayList.map((apt) => {
                  const id = personId(apt.patient);
                  const name = personName(apt.patient, 'Paciente');
                  return (
                    <li key={apt._id} className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {id ? (
                            <Link to={`/app/admin/pacientes/${id}`} className="hover:underline">
                              {name}
                            </Link>
                          ) : (
                            name
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {appointmentTypeLabels[apt.type]}
                          {isAdmin && ` · con ${personName(apt.professional, 'profesional')}`}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <p className="text-sm font-semibold tabular-nums">{timeRange(apt)}</p>
                        {apt.outsideCapacity && <Badge variant="accent">Sobre cupo</Badge>}
                        {apt.overbooked && <Badge variant="warning">Sobrecupo</Badge>}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">Próximos días</CardTitle>
          </CardHeader>
          <CardContent>
            {appointments === null ? (
              <p className="text-sm text-muted-foreground">No se pudieron cargar las próximas citas.</p>
            ) : nextDays.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay citas programadas en los próximos 7 días.</p>
            ) : (
              <ul className="divide-y divide-border">
                {nextDays.slice(0, 6).map((apt) => (
                  <li key={apt._id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{personName(apt.patient, 'Paciente')}</p>
                      <p className="text-xs text-muted-foreground">
                        {capitalizeFirst(format(parseISO(dayOf(apt)), "EEE d 'de' MMM", { locale: es }))}
                      </p>
                    </div>
                    <p className="shrink-0 text-sm tabular-nums text-muted-foreground">{apt.startTime}</p>
                  </li>
                ))}
              </ul>
            )}
            {nextDays.length > 6 && (
              <Button asChild variant="link" size="sm" className="mt-2 h-auto p-0">
                <Link to="/app/admin/calendario">Ver las {nextDays.length} citas en el calendario</Link>
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      <WellnessTrendsSummary />
    </div>
  );
};

export default AdminDashboard;
