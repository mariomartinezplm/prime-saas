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
import { toast } from 'sonner';
import { showApiError } from '@/lib/apiError';
import { CalendarPlus, AlertCircle, CheckCircle, Info, Ban, Clock, CalendarDays, Repeat, Calendar as CalendarIcon } from 'lucide-react';
import { format, addHours, isBefore, parseISO } from 'date-fns';
import type { User, SessionBalance, AvailableSlots } from '@/types';

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

  useEffect(() => {
    const fetchData = async () => {
      try {
        const allUsers = await userService.getAll({ role: 'admin' });
        const allProf = await userService.getAll({ role: 'professional' });
        const combined = [...allUsers.users, ...allProf.users];

        const allowedNames = ['mario', 'felipe', 'rafael', 'tomás', 'tomas'];
        const validProfessionals = combined.filter(p => allowedNames.includes(p.firstName.toLowerCase()));

        // Auto-select assigned professional
        if (user && user.role === 'patient') {
          if (user.assignedProfessional) {
            const targetName = user.assignedProfessional.toLowerCase().trim();
            const found = validProfessionals.find(p =>
              `${p.firstName} ${p.lastName}`.toLowerCase().includes(targetName) ||
              targetName.includes(p.lastName.toLowerCase())
            );

            if (found) {
              setProfessionals([found]);
              setSelectedProfessional(found);
            } else {
              setProfessionals([]);
            }
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
        toast.error('Error al cargar datos');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user]);

  // Fetch slots when date changes
  useEffect(() => {
    if (!selectedDate || !selectedProfessional) {
      setSlots(null);
      return;
    }
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    availabilityService.getSlots(selectedProfessional.id, dateStr).then(setSlots).catch(() => setSlots(null));
  }, [selectedDate, selectedProfessional]);

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

      await appointmentService.create({
        professional: selectedProfessional.id,
        date: format(selectedDate, 'yyyy-MM-dd'),
        startTime: selectedSlot,
        endTime,
        type: getSessionType(),
      });

      toast.success('Cita reservada exitosamente');
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
    return date >= start && date <= end;
  };

  const isWithin24Hours = (date: Date): boolean => {
    const now = new Date();
    return isBefore(date, addHours(now, 24));
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
    const canBook = balance.totalAvailable > 0;
    const extraNote = balance.extraSessionsAvailable > 0 ? ` + ${balance.extraSessionsAvailable} extra` : '';

    return {
      label: plan.serviceType === 'kinesiologia' ? '🏥 Kinesiología' : '💪 Entrenamiento',
      description: `${remaining} de ${plan.sessionsTotal} sesiones restantes${extraNote}`,
      sessionCounter: `${plan.sessionsUsed}/${plan.sessionsTotal} sesiones usadas`,
      canBook,
      blockMessage: !canBook ? 'Has completado todas tus sesiones. Contacta a Prime F&H para renovar tu plan.' : null,
      color: canBook
        ? (plan.serviceType === 'kinesiologia' ? 'border-teal-300 bg-teal-50' : 'border-blue-300 bg-blue-50')
        : 'border-red-300 bg-red-50',
      progressPercent: (plan.sessionsUsed / plan.sessionsTotal) * 100
    };
  };

  const planInfo = getPlanStatusInfo();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-secondary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Portal del Paciente</h1>
          <p className="text-muted-foreground mt-1">Reserva tus sesiones con tu kinesiólogo</p>
        </div>
      </div>

      {/* ─── Banner de Estado del Plan con Contador de Sesiones ─── */}
      {planInfo ? (
        <Card className={`border-2 ${planInfo.color}`}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                {planInfo.canBook ? (
                  <CheckCircle className="w-6 h-6 text-green-600" />
                ) : (
                  <Ban className="w-6 h-6 text-red-600" />
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
                    <div className="w-32 h-2 bg-gray-200 rounded-full mt-1 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${planInfo.progressPercent >= 80 ? 'bg-red-500' : planInfo.progressPercent >= 50 ? 'bg-yellow-500' : 'bg-green-500'
                          }`}
                        style={{ width: `${Math.min(planInfo.progressPercent, 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {planInfo.blockMessage && (
              <div className="mt-3 flex items-center gap-2 p-3 bg-red-100 rounded-lg text-red-700 text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {planInfo.blockMessage}
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card className="border-2 border-yellow-300 bg-yellow-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-6 h-6 text-yellow-600" />
              <div>
                <p className="font-semibold text-sm text-yellow-800">No tienes un plan activo</p>
                <p className="text-xs text-yellow-600">
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
        <Card className="border-2 border-red-300 bg-red-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-6 h-6 text-red-600" />
              <div>
                <p className="font-semibold text-sm text-red-800">No tienes un kinesiólogo asignado</p>
                <p className="text-xs text-red-600">
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
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setBookingMode('single')}
                  className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${bookingMode === 'single'
                    ? 'border-blue-500 bg-blue-50 shadow-sm'
                    : 'border-gray-200 hover:border-gray-300'
                    }`}
                >
                  <CalendarIcon className={`w-5 h-5 ${bookingMode === 'single' ? 'text-blue-600' : 'text-gray-400'}`} />
                  <div className="text-left">
                    <p className={`text-sm font-medium ${bookingMode === 'single' ? 'text-blue-700' : 'text-foreground'}`}>
                      Agendar una hora
                    </p>
                    <p className="text-xs text-muted-foreground">Elige día y hora específicos</p>
                  </div>
                </button>

                <button
                  onClick={() => {
                    setBookingMode('recurring');
                    if (balance?.hasActivePlan) setShowBulk(true);
                  }}
                  className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${bookingMode === 'recurring'
                    ? 'border-purple-500 bg-purple-50 shadow-sm'
                    : 'border-gray-200 hover:border-gray-300'
                    }`}
                >
                  <Repeat className={`w-5 h-5 ${bookingMode === 'recurring' ? 'text-purple-600' : 'text-gray-400'}`} />
                  <div className="text-left">
                    <p className={`text-sm font-medium ${bookingMode === 'recurring' ? 'text-purple-700' : 'text-foreground'}`}>
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
            <div className="grid gap-6 md:grid-cols-2">
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
                    disabledDate={(date) => {
                      if (isWithin24Hours(date)) return true;
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
                      ? `Horarios - ${format(selectedDate, 'dd/MM/yyyy')}`
                      : 'Selecciona una fecha'}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {slots ? (
                    <SlotGrid
                      slots={slots}
                      selectedSlot={selectedSlot}
                      onSelect={(slot) => {
                        if (planInfo && !planInfo.canBook) {
                          toast.error(planInfo.blockMessage || 'No puedes agendar en este momento');
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
          <Card className="border border-blue-200 bg-blue-50/50">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                <div className="space-y-1.5">
                  <p className="text-sm font-medium text-blue-800">Reglas de agendamiento</p>
                  <div className="flex flex-col gap-1 text-xs text-blue-700">
                    <div className="flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5" />
                      <span>Puedes agendar con un <strong>mínimo de 24 horas</strong> de anticipación</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Ban className="w-3.5 h-3.5" />
                      <span>Puedes cancelar hasta <strong>4 horas antes</strong> de tu sesión</span>
                    </div>
                    {balance?.plan && (
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
