import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { userService } from '@/services/userService';
import { availabilityService } from '@/services/availabilityService';
import { appointmentService } from '@/services/appointmentService';
import { planService } from '@/services/planService';
import ProfessionalSelector from '@/components/booking/ProfessionalSelector';
import CalendarView from '@/components/booking/CalendarView';
import SlotGrid from '@/components/booking/SlotGrid';
import BookingConfirmation from '@/components/booking/BookingConfirmation';
import BulkBookingDialog from '@/components/booking/BulkBookingDialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { CalendarPlus, AlertCircle, CheckCircle, Info, Ban, Clock, CalendarDays, Repeat, Calendar as CalendarIcon } from 'lucide-react';
import { format, addHours, isBefore, parseISO } from 'date-fns';
import type { User, Plan, AvailableSlots } from '@/types';

type BookingMode = 'single' | 'recurring';

const BookAppointment = () => {
  const { user } = useAuth();
  const [professionals, setProfessionals] = useState<User[]>([]);
  const [selectedProfessional, setSelectedProfessional] = useState<User | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [slots, setSlots] = useState<AvailableSlots | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [activePlan, setActivePlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(true);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [booking, setBooking] = useState(false);
  const [bookingMode, setBookingMode] = useState<BookingMode>('single');
  const [monthlyUsed, setMonthlyUsed] = useState(0);

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
          const plan = await planService.getActive(user.id);
          setActivePlan(plan);

          // Fetch monthly usage from plan-info endpoint
          try {
            const { default: api } = await import('@/lib/api');
            const resp = await api.get(`/appointments/plan-info/${user.id}`);
            const restrictions = resp.data?.data?.restrictions;
            if (restrictions) {
              if (restrictions.monthlyUsed !== undefined) {
                setMonthlyUsed(restrictions.monthlyUsed);
              } else if (restrictions.sessionsUsed !== undefined) {
                setMonthlyUsed(restrictions.sessionsUsed);
              }
            }
          } catch {
            // Silently fail — plan info is supplementary
          }
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
    if (!activePlan) return 'entrenamiento';
    if (activePlan.planType === 'kinesiologia') return 'kinesiologia';
    return 'entrenamiento';
  };

  // Calendar months to show (1 for entrenamiento, 2 for kinesiología)
  const getCalendarMonths = (): number => {
    if (!activePlan) return 1;
    return activePlan.planType === 'kinesiologia' ? 2 : 1;
  };

  // Monthly session limit for current plan
  const getMonthlyLimit = (): number => {
    if (!activePlan) return 12;
    if (activePlan.planType === 'kinesiologia') return activePlan.totalSessions || 10;
    if (activePlan.planType === 'entrenamiento-2x') return 8;
    if (activePlan.planType === 'entrenamiento-3x') return 12;
    return activePlan.sessionsPerMonth || 12;
  };

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
      setMonthlyUsed(prev => prev + 1);

      // Refrescar plan
      if (user) {
        const plan = await planService.getActive(user.id);
        setActivePlan(plan);
      }

      // Refresh slots
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      const newSlots = await availabilityService.getSlots(selectedProfessional.id, dateStr);
      setSlots(newSlots);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      toast.error(error.response?.data?.message || 'Error al reservar');
    } finally {
      setBooking(false);
    }
  };

  const isDateInPlanRange = (date: Date): boolean => {
    if (!activePlan) return true;
    const start = parseISO(activePlan.startDate);
    const end = parseISO(activePlan.endDate);
    return date >= start && date <= end;
  };

  const isWithin24Hours = (date: Date): boolean => {
    const now = new Date();
    return isBefore(date, addHours(now, 24));
  };

  // ─── Plan status info ───────────────────────────────────────────────
  const getPlanStatusInfo = () => {
    const monthlyLimit = getMonthlyLimit();

    if (activePlan) {
      if (activePlan.planType === 'kinesiologia') {
        const remaining = activePlan.totalSessions - activePlan.sessionsUsed;
        const canBook = remaining > 0;
        return {
          label: '🏥 Kinesiología',
          description: `${remaining} de ${activePlan.totalSessions} sesiones restantes`,
          sessionCounter: `${activePlan.sessionsUsed}/${activePlan.totalSessions} sesiones usadas`,
          canBook,
          blockMessage: remaining <= 0 ? 'Has completado todas tus sesiones de kinesiología. Contacta al equipo para renovar tu bono.' : null,
          color: canBook ? 'border-teal-300 bg-teal-50' : 'border-red-300 bg-red-50',
          progressPercent: (activePlan.sessionsUsed / activePlan.totalSessions) * 100
        };
      }

      const canBook = monthlyUsed < monthlyLimit;
      return {
        label: activePlan.planType === 'entrenamiento-2x' ? '💪 Entrenamiento 2x/semana' : '🔥 Entrenamiento 3x/semana',
        description: `${monthlyLimit - monthlyUsed} sesiones restantes este mes`,
        sessionCounter: `${monthlyUsed}/${monthlyLimit} sesiones este mes`,
        canBook,
        blockMessage: !canBook ? `Has agotado tus ${monthlyLimit} sesiones de este mes. Espera al próximo mes o contacta al equipo.` : null,
        color: canBook ? 'border-blue-300 bg-blue-50' : 'border-red-300 bg-red-50',
        progressPercent: (monthlyUsed / monthlyLimit) * 100
      };
    }

    // Si NO tiene plan formal, verificamos status del usuario
    if (user?.isActive) {
      return {
        label: '✅ Plan Activo',
        description: 'Usuario habilitado para agendar',
        sessionCounter: null,
        canBook: true,
        blockMessage: null,
        color: 'border-green-300 bg-green-50',
        progressPercent: 0
      };
    }

    return null;
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
                    if (activePlan) setShowBulk(true);
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
                    {activePlan?.planType === 'kinesiologia' && (
                      <span className="text-xs font-normal text-muted-foreground ml-auto">Vista de 2 meses</span>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <CalendarView
                    selectedDate={selectedDate}
                    onSelect={setSelectedDate}
                    numberOfMonths={getCalendarMonths()}
                    disabledDate={(date) => {
                      if (isWithin24Hours(date)) return true;
                      if (activePlan && !isDateInPlanRange(date)) return true;
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
                    {activePlan && (
                      <div className="flex items-center gap-2">
                        <CalendarDays className="w-3.5 h-3.5" />
                        <span>
                          {activePlan.planType === 'kinesiologia'
                            ? `Máximo ${activePlan.totalSessions || 10} sesiones por bono`
                            : `Máximo ${getMonthlyLimit()} sesiones por mes`}
                        </span>
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
      {showBulk && selectedProfessional && activePlan && (
        <BulkBookingDialog
          open={showBulk}
          onClose={() => {
            setShowBulk(false);
            setBookingMode('single');
          }}
          professional={selectedProfessional}
          plan={activePlan}
        />
      )}
    </div>
  );
};

export default BookAppointment;
