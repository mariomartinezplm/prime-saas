import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { userService } from '@/services/userService';
import { availabilityService } from '@/services/availabilityService';
import { appointmentService } from '@/services/appointmentService';
import { clientPlanService } from '@/services/clientPlanService';
import ProfessionalSelector from '@/components/booking/ProfessionalSelector';
import CalendarView from '@/components/booking/CalendarView';
import SlotGrid from '@/components/booking/SlotGrid';
import BookingConfirmation from '@/components/booking/BookingConfirmation';
import BulkBookingDialog from '@/components/booking/BulkBookingDialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { notify } from '@/lib/notify';
import { showApiError } from '@/lib/apiError';
import { AlertCircle, CheckCircle, Info, Ban, Clock, CalendarDays, Repeat, Calendar as CalendarIcon } from 'lucide-react';
import { format, addHours, isBefore, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { SERVICE_TYPE_LABELS, formatPlanUsage } from '@/config/planCatalog';
import { MIN_BOOKING_AHEAD_HOURS, PATIENT_CANCEL_AHEAD_HOURS } from '@/config/bookingRules';
import { capitalizeFirst } from '@/lib/utils';
import LoadingState from '@/components/shared/LoadingState';
import { CardsSkeleton, PageSkeleton } from '@/components/shared/Skeletons';
import PageHeader from '@/components/shared/PageHeader';
import type { User, SessionBalance, AvailableSlots } from '@/types';
import PaymentPendingBanner from '@/components/plans/PaymentPendingBanner';

type BookingMode = 'single' | 'recurring';

const BookAppointment = () => {
  const { user } = useAuth();
  const [professionals, setProfessionals] = useState<User[]>([]);
  const [selectedProfessional, setSelectedProfessional] = useState<User | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [slots, setSlots] = useState<AvailableSlots | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [balance, setBalance] = useState<SessionBalance | null>(null);
  const [loading, setLoading] = useState(true);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [booking, setBooking] = useState(false);
  const [bookingMode, setBookingMode] = useState<BookingMode>('single');
  const [slotsStatus, setSlotsStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [slotsRetry, setSlotsRetry] = useState(0);
  // Días de la semana en que atiende el profesional (los que tienen horarios configurados); null = aún no se sabe
  const [workingWeekdays, setWorkingWeekdays] = useState<number[] | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const allUsers = await userService.getAll({ role: 'admin' });
        const allProf = await userService.getAll({ role: 'professional' });
        const combined = [...allUsers.users, ...allProf.users];

        const allowedNames = ['mario', 'felipe', 'rafael', 'tomás', 'tomas'];
        const validProfessionals = combined.filter(p => allowedNames.includes(p.firstName.toLowerCase()));

        // Auto-select assigned professional. `assignedProfessionalId` es la
        // referencia real (Paso 04 de BLUEPRINT.md) — antes esto comparaba
        // por nombre contra `assignedProfessional`, el texto histórico de la
        // migración de Airtable que la API de sesión (login/me) nunca llegó
        // a devolver: todo paciente veía "no tienes un kinesiólogo asignado"
        // sin importar si de verdad tenía uno.
        if (user && user.role === 'patient') {
          const assignedId =
            typeof user.assignedProfessionalId === 'object'
              ? user.assignedProfessionalId?.id
              : user.assignedProfessionalId;
          const found = assignedId ? combined.find(p => p.id === assignedId) : undefined;

          if (found) {
            setProfessionals([found]);
            setSelectedProfessional(found);
          } else {
            setProfessionals([]);
          }
        } else {
          setProfessionals(validProfessionals);
        }

        if (user) {
          const bal = await clientPlanService.getBalance(user.id);
          setBalance(bal);
        }
      } catch {
        notify.error('Error al cargar datos');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user]);

  // Los días habilitados del calendario salen de los horarios que configuró el profesional
  useEffect(() => {
    setWorkingWeekdays(null);
    if (!selectedProfessional) return;
    let active = true;
    availabilityService
      .get(selectedProfessional.id)
      .then((availability) => {
        if (!active) return;
        const days = (availability?.weeklySchedule ?? []).filter((d) => d.slots.length > 0).map((d) => d.dayOfWeek);
        setWorkingWeekdays(days.length > 0 ? days : null);
      })
      // Si no se pueden leer, no se bloquea ningún día: los horarios de cada día igual lo dirán
      .catch(() => active && setWorkingWeekdays(null));
    return () => {
      active = false;
    };
  }, [selectedProfessional]);

  // Si el día elegido deja de estar habilitado (cambió el profesional), se limpia la selección
  useEffect(() => {
    if (selectedDate && workingWeekdays && !workingWeekdays.includes(selectedDate.getDay())) {
      setSelectedDate(undefined);
      setSelectedSlot(null);
    }
  }, [workingWeekdays, selectedDate]);

  // Fetch slots when date changes
  useEffect(() => {
    if (!selectedDate || !selectedProfessional) {
      setSlots(null);
      setSlotsStatus('idle');
      return;
    }
    // Si se cambia de día rápido, la respuesta del día anterior se descarta
    let active = true;
    setSlotsStatus('loading');
    availabilityService
      .getSlots(selectedProfessional.id, format(selectedDate, 'yyyy-MM-dd'))
      .then((result) => {
        if (!active) return;
        setSlots(result);
        setSlotsStatus('idle');
      })
      .catch(() => {
        if (!active) return;
        setSlots(null);
        setSlotsStatus('error');
      });
    return () => {
      active = false;
    };
  }, [selectedDate, selectedProfessional, slotsRetry]);

  // Determine session type from plan
  const getSessionType = (): 'kinesiologia' | 'entrenamiento' | 'evaluacion' => {
    return balance?.plan?.serviceType || 'entrenamiento';
  };

  // Vista de 2 meses siempre: el ciclo del plan (30 días) casi siempre cruza
  // un mes calendario, sin importar el tipo de servicio.
  const getCalendarMonths = (): number => 2;

  const handleBook = async () => {
    if (!selectedProfessional || !selectedDate || !selectedSlot) return;

    setBooking(true);
    try {
      const [startH, startM] = selectedSlot.split(':').map(Number);
      const endTime = `${String(startH + 1).padStart(2, '0')}:${String(startM).padStart(2, '0')}`;

      const newAppointment = await appointmentService.create({
        professional: selectedProfessional.id,
        date: format(selectedDate, 'yyyy-MM-dd'),
        startTime: selectedSlot,
        endTime,
        type: getSessionType(),
      });

      notify.success('Cita reservada exitosamente', {
        action: {
          label: 'Agregar a mi calendario',
          onClick: () => appointmentService.downloadICS(newAppointment._id),
        },
      });
      setShowConfirmation(false);
      setSelectedSlot(null);

      // Refrescar saldo de sesiones
      if (user) {
        const bal = await clientPlanService.getBalance(user.id);
        setBalance(bal);
      }

      // Refresh slots
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      const newSlots = await availabilityService.getSlots(selectedProfessional.id, dateStr);
      setSlots(newSlots);
    } catch (err: unknown) {
      showApiError(err, 'Error al reservar');
    } finally {
      setBooking(false);
    }
  };

  const isDateInPlanRange = (date: Date): boolean => {
    if (!balance?.plan) return true;
    const start = parseISO(balance.plan.startDate);
    const end = parseISO(balance.plan.endDate);
    // Con la renovación pendiente de pago, solo se agenda dentro del plazo de pago
    if (balance.plan.paymentPending && balance.plan.paymentDueBy && date >= parseISO(balance.plan.paymentDueBy)) return false;
    return date >= start && date <= end;
  };

  // Un horario puntual (fecha + hora) está "muy pronto" si cae dentro de las
  // 4h de anticipación mínima. Antes esto se evaluaba contra la fecha del día
  // completo a medianoche (00:00) en vez de la hora real del slot — como
  // "medianoche" siempre es anterior a "ahora + 4h", el día de hoy quedaba
  // bloqueado por completo sin importar si ya eran las 8am o las 8pm. Ahora se
  // evalúa por horario individual, con la misma regla que ya aplica el backend.
  const isSlotTooSoon = (date: Date, time: string): boolean => {
    const [hours, minutes] = time.split(':').map(Number);
    const slotDateTime = new Date(date);
    slotDateTime.setHours(hours, minutes, 0, 0);
    return isBefore(slotDateTime, addHours(new Date(), MIN_BOOKING_AHEAD_HOURS));
  };

  // ─── Plan status info ───────────────────────────────────────────────
  // ClientPlan es la única fuente de verdad (Paso 15/16 de BLUEPRINT.md): sin
  // un plan activo no se puede agendar, sin excepción — antes había un atajo
  // que dejaba agendar a cualquier usuario activo sin plan, contradiciendo esa
  // regla (el backend ya lo rechazaba con 403, pero la pantalla lo insinuaba).
  const getPlanStatusInfo = () => {
    if (!balance?.hasActivePlan || !balance.plan) return null;

    const plan = balance.plan;
    const remaining = plan.sessionsTotal - plan.sessionsUsed;
    const unlimited = !!plan.unlimited;
    const canBook = balance.totalAvailable > 0;
    const extraNote = balance.extraSessionsAvailable > 0 ? ` + ${balance.extraSessionsAvailable} extra` : '';

    return {
      label: SERVICE_TYPE_LABELS[plan.serviceType],
      description: unlimited
        ? `Sesiones ilimitadas${extraNote}`
        : `${remaining} de ${plan.sessionsTotal} sesiones restantes${extraNote}`,
      sessionCounter: formatPlanUsage(plan),
      canBook,
      blockMessage: !canBook ? 'Has completado todas tus sesiones. Contacta a Prime F&H para renovar tu plan.' : null,
      color: canBook
        ? (plan.serviceType === 'kinesiologia' ? 'border-primary/40 bg-primary/10' : 'border-info/40 bg-info/10')
        : 'border-destructive/40 bg-destructive/10',
      progressPercent: unlimited ? 0 : (plan.sessionsUsed / plan.sessionsTotal) * 100
    };
  };

  const planInfo = getPlanStatusInfo();

  if (loading) {
    return (
      <PageSkeleton label="Cargando…">
        <CardsSkeleton count={2} bodyHeight="h-48" />
      </PageSkeleton>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Reservar hora" description="Reserva tus sesiones con tu kinesiólogo" />

      {balance?.paymentPending && balance.paymentDueBy && (
        <PaymentPendingBanner paymentDueBy={balance.paymentDueBy} />
      )}

      {/* ─── Banner de Estado del Plan con Contador de Sesiones ─── */}
      {planInfo ? (
        <Card className={`border-2 ${planInfo.color}`}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                {planInfo.canBook ? (
                  <CheckCircle className="w-6 h-6 text-success" />
                ) : (
                  <Ban className="w-6 h-6 text-destructive" />
                )}
                <div>
                  <p className="font-semibold text-sm">{planInfo.label}</p>
                  <p className="text-xs text-muted-foreground">{planInfo.description}</p>
                </div>
              </div>

              {/* Session counter with progress bar */}
              {planInfo.sessionCounter && (
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-xs font-medium text-muted-foreground">{planInfo.sessionCounter}</p>
                    <div
                      className="w-32 h-2 bg-muted rounded-full mt-1 overflow-hidden"
                      role="progressbar"
                      aria-label="Sesiones usadas del plan"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={Math.round(Math.min(planInfo.progressPercent, 100))}
                    >
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${planInfo.progressPercent >= 80 ? 'bg-destructive' : planInfo.progressPercent >= 50 ? 'bg-warning' : 'bg-success'
                          }`}
                        style={{ width: `${Math.min(planInfo.progressPercent, 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {planInfo.blockMessage && (
              <div className="mt-3 flex items-center gap-2 p-3 bg-destructive/10 rounded-lg text-destructive text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {planInfo.blockMessage}
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card className="border-2 border-warning/40 bg-warning/10">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-6 h-6 text-warning" />
              <div>
                <p className="font-semibold text-sm text-warning">No tienes un plan activo</p>
                <p className="text-xs text-warning">
                  Contacta al equipo de Prime F&H para activar tu plan y poder agendar sesiones.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 1: Professional */}
      {professionals.length > 0 ? (
        <ProfessionalSelector
          professionals={professionals}
          selected={selectedProfessional}
          onSelect={setSelectedProfessional}
        />
      ) : (
        <Card className="border-2 border-destructive/40 bg-destructive/10">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-6 h-6 text-destructive" />
              <div>
                <p className="font-semibold text-sm text-destructive">No tienes un kinesiólogo asignado</p>
                <p className="text-xs text-destructive">
                  Debes tener un profesional asignado (desde tu ingreso en recepción) para poder agendar. Contacta al equipo de Prime F&H.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {selectedProfessional && (
        <>
          {/* ─── Booking Mode Toggle ─── */}
          <Card>
            <CardContent className="p-4">
              <p className="text-sm font-semibold mb-3">¿Cómo quieres agendar?</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  aria-pressed={bookingMode === 'single'}
                  onClick={() => setBookingMode('single')}
                  className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${bookingMode === 'single'
                    ? 'border-primary bg-primary/10 shadow-sm'
                    : 'border-border hover:border-muted-foreground/40'
                    }`}
                >
                  <CalendarIcon className={`w-5 h-5 ${bookingMode === 'single' ? 'text-secondary' : 'text-muted-foreground'}`} aria-hidden="true" />
                  <div className="text-left">
                    <p className="text-sm font-medium text-foreground">
                      Agendar una hora
                    </p>
                    <p className="text-xs text-muted-foreground">Elige día y hora específicos</p>
                  </div>
                </button>

                <button
                  type="button"
                  aria-pressed={bookingMode === 'recurring'}
                  onClick={() => {
                    setBookingMode('recurring');
                    if (balance?.hasActivePlan) setShowBulk(true);
                  }}
                  className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${bookingMode === 'recurring'
                    ? 'border-primary bg-primary/10 shadow-sm'
                    : 'border-border hover:border-muted-foreground/40'
                    }`}
                >
                  <Repeat className={`w-5 h-5 ${bookingMode === 'recurring' ? 'text-secondary' : 'text-muted-foreground'}`} aria-hidden="true" />
                  <div className="text-left">
                    <p className="text-sm font-medium text-foreground">
                      Horario predeterminado
                    </p>
                    <p className="text-xs text-muted-foreground">Fija tu hora para siempre</p>
                  </div>
                </button>
              </div>
            </CardContent>
          </Card>

          {/* ─── Single Booking Mode: Calendar + Slots ─── */}
          {bookingMode === 'single' && (
            <div className="grid items-start gap-6 md:grid-cols-2">
              {/* Calendar */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <CalendarDays className="w-5 h-5" />
                    Seleccionar Fecha
                    <span className="text-xs font-normal text-muted-foreground ml-auto">Vista de 2 meses</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <CalendarView
                    selectedDate={selectedDate}
                    onSelect={setSelectedDate}
                    numberOfMonths={getCalendarMonths()}
                    workingWeekdays={workingWeekdays}
                    disabledDate={(date) => {
                      if (balance?.plan && !isDateInPlanRange(date)) return true;
                      return false;
                    }}
                  />
                </CardContent>
              </Card>

              {/* Time slots */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">
                    {selectedDate
                      ? `Horarios · ${capitalizeFirst(format(selectedDate, "EEEE d 'de' MMMM", { locale: es }))}`
                      : 'Selecciona una fecha'}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {slotsStatus === 'loading' ? (
                    <LoadingState className="py-8" label="Cargando horarios…" />
                  ) : slotsStatus === 'error' ? (
                    <div className="flex flex-col items-center gap-3 py-8 text-center">
                      <p className="text-sm text-muted-foreground">No se pudieron cargar los horarios.</p>
                      <Button variant="outline" size="sm" onClick={() => setSlotsRetry((n) => n + 1)}>
                        Reintentar
                      </Button>
                    </div>
                  ) : slots ? (
                    <SlotGrid
                      slots={{
                        ...slots,
                        availableSlots: slots.availableSlots.filter(
                          (slot) => !selectedDate || !isSlotTooSoon(selectedDate, slot)
                        ),
                      }}
                      tooSoonSlots={
                        selectedDate
                          ? slots.availableSlots.filter((slot) => isSlotTooSoon(selectedDate, slot))
                          : []
                      }
                      selectedSlot={selectedSlot}
                      onSelect={(slot) => {
                        if (planInfo && !planInfo.canBook) {
                          notify.error(planInfo.blockMessage || 'No puedes agendar en este momento');
                          return;
                        }
                        setSelectedSlot(slot);
                        setShowConfirmation(true);
                      }}
                    />
                  ) : (
                    <p className="text-muted-foreground text-sm text-center py-8">
                      Selecciona una fecha para ver los horarios disponibles
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* ─── Rules Info Card ─── */}
          <Card className="border border-primary/30 bg-primary/5">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <Info className="w-5 h-5 text-secondary flex-shrink-0 mt-0.5" aria-hidden="true" />
                <div className="space-y-1.5">
                  <p className="text-sm font-medium text-foreground">Reglas de agendamiento</p>
                  <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5" />
                      <span>Puedes agendar con un <strong>mínimo de {MIN_BOOKING_AHEAD_HOURS} horas</strong> de anticipación</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Ban className="w-3.5 h-3.5" />
                      <span>Cancela hasta <strong>{PATIENT_CANCEL_AHEAD_HOURS} horas antes</strong> y la sesión vuelve a tu plan</span>
                    </div>
                    {balance?.plan && !balance.plan.unlimited && (
                      <div className="flex items-center gap-2">
                        <CalendarDays className="w-3.5 h-3.5" />
                        <span>Máximo {balance.plan.sessionsTotal} sesiones por bono</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Confirmation dialog */}
      {showConfirmation && selectedProfessional && selectedDate && selectedSlot && (
        <BookingConfirmation
          open={showConfirmation}
          onClose={() => setShowConfirmation(false)}
          onConfirm={handleBook}
          professional={selectedProfessional}
          date={selectedDate}
          time={selectedSlot}
          loading={booking}
        />
      )}

      {/* Bulk booking dialog */}
      {showBulk && selectedProfessional && balance?.plan && (
        <BulkBookingDialog
          open={showBulk}
          onClose={() => {
            setShowBulk(false);
            setBookingMode('single');
          }}
          professional={selectedProfessional}
          plan={balance.plan}
        />
      )}
    </div>
  );
};

export default BookAppointment;
