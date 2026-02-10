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
import { CalendarPlus, AlertCircle, CheckCircle, Info, Ban } from 'lucide-react';
import { format, addHours, isBefore, parseISO } from 'date-fns';
import type { User, Plan, AvailableSlots } from '@/types';

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

  useEffect(() => {
    const fetchData = async () => {
      try {
        const allUsers = await userService.getAll({ role: 'admin' });
        const allProf = await userService.getAll({ role: 'professional' });
        const combined = [...allUsers.users, ...allProf.users];
        setProfessionals(combined);

        if (user) {
          const plan = await planService.getActive(user.id);
          setActivePlan(plan);
        }
      } catch {
        toast.error('Error al cargar datos');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user]);

  useEffect(() => {
    if (selectedProfessional && selectedDate) {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      availabilityService.getSlots(selectedProfessional.id, dateStr)
        .then(setSlots)
        .catch(() => toast.error('Error al cargar horarios'));
    } else {
      setSlots(null);
    }
    setSelectedSlot(null);
  }, [selectedProfessional, selectedDate]);

  // Determinar tipo de sesión basado en el plan activo
  const getSessionType = (): 'kinesiologia' | 'entrenamiento' | 'evaluacion' => {
    if (!activePlan) return 'entrenamiento';
    if (activePlan.planType === 'kinesiologia') return 'kinesiologia';
    return 'entrenamiento';
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

      // Refrescar plan (en caso de que se hayan actualizado las sesiones usadas)
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

  // ─── Calcular info del plan para mostrar ───────────────────────────────
  const getPlanStatusInfo = () => {
    if (!activePlan) return null;

    if (activePlan.planType === 'kinesiologia') {
      const remaining = activePlan.totalSessions - activePlan.sessionsUsed;
      const canBook = remaining > 0;
      return {
        label: '🏥 Kinesiología',
        description: `${remaining} de ${activePlan.totalSessions} sesiones restantes`,
        canBook,
        blockMessage: remaining <= 0 ? 'Has completado todas tus sesiones de kinesiología. Contacta al equipo para renovar tu bono.' : null,
        color: canBook ? 'border-teal-300 bg-teal-50' : 'border-red-300 bg-red-50'
      };
    }

    const sessionsPerWeek = activePlan.planType === 'entrenamiento-2x' ? 2 : 3;
    return {
      label: activePlan.planType === 'entrenamiento-2x' ? '💪 Entrenamiento 2x/semana' : '🔥 Entrenamiento 3x/semana',
      description: `Puedes agendar ${sessionsPerWeek} veces por semana`,
      canBook: true, // El backend valida el límite real
      blockMessage: null,
      color: 'border-blue-300 bg-blue-50'
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
        {activePlan && selectedProfessional && (
          <Button variant="outline" onClick={() => setShowBulk(true)}>
            <CalendarPlus className="h-4 w-4 mr-2" />
            Reserva masiva
          </Button>
        )}
      </div>

      {/* ─── Banner de Estado del Plan ─────────────────────────────── */}
      {planInfo ? (
        <Card className={`border-2 ${planInfo.color}`}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
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
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Info className="w-4 h-4" />
                <span>Mínimo 24h de anticipación • Cancela hasta 4h antes</span>
              </div>
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
      <ProfessionalSelector
        professionals={professionals}
        selected={selectedProfessional}
        onSelect={setSelectedProfessional}
      />

      {selectedProfessional && (
        <div className="grid gap-6 md:grid-cols-2">
          {/* Step 2: Calendar */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Seleccionar Fecha</CardTitle>
            </CardHeader>
            <CardContent>
              <CalendarView
                selectedDate={selectedDate}
                onSelect={setSelectedDate}
                disabledDate={(date) => {
                  if (isWithin24Hours(date)) return true;
                  if (activePlan && !isDateInPlanRange(date)) return true;
                  return false;
                }}
              />
            </CardContent>
          </Card>

          {/* Step 3: Time slots */}
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
          onClose={() => setShowBulk(false)}
          professional={selectedProfessional}
          plan={activePlan}
        />
      )}
    </div>
  );
};

export default BookAppointment;
