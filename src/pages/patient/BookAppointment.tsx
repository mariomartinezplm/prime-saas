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
import { CalendarPlus } from 'lucide-react';
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
        // Get professionals (admin + professional roles)
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
        type: 'entrenamiento',
      });

      toast.success('Cita reservada exitosamente');
      setShowConfirmation(false);
      setSelectedSlot(null);
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
          <h1 className="text-2xl font-bold text-foreground">Reservar Hora</h1>
          <p className="text-muted-foreground">Selecciona profesional, fecha y horario</p>
        </div>
        {activePlan && selectedProfessional && (
          <Button variant="outline" onClick={() => setShowBulk(true)}>
            <CalendarPlus className="h-4 w-4 mr-2" />
            Reserva masiva
          </Button>
        )}
      </div>

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
