import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { userService } from '@/services/userService';
import { availabilityService } from '@/services/availabilityService';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { Plus, Trash2, Save, Loader2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import type { User, Availability, DaySchedule, TimeSlot } from '@/types';

const DAYS = [
  { value: 1, label: 'Lunes' },
  { value: 2, label: 'Martes' },
  { value: 3, label: 'Miércoles' },
  { value: 4, label: 'Jueves' },
  { value: 5, label: 'Viernes' },
  { value: 6, label: 'Sábado' },
];

const DEFAULT_SLOTS: TimeSlot[] = [
  { startTime: '07:00', endTime: '08:00' },
  { startTime: '07:30', endTime: '08:30' },
  { startTime: '08:00', endTime: '09:00' },
  { startTime: '08:30', endTime: '09:30' },
  { startTime: '09:00', endTime: '10:00' },
  { startTime: '09:30', endTime: '10:30' },
  { startTime: '10:00', endTime: '11:00' },
  { startTime: '10:30', endTime: '11:30' },
  { startTime: '11:00', endTime: '12:00' },
  { startTime: '11:30', endTime: '12:30' },
  { startTime: '12:00', endTime: '13:00' },
  { startTime: '12:30', endTime: '13:30' },
  { startTime: '13:00', endTime: '14:00' },
  { startTime: '13:30', endTime: '14:30' },
  { startTime: '14:00', endTime: '15:00' },
  { startTime: '14:30', endTime: '15:30' },
  { startTime: '15:00', endTime: '16:00' },
  { startTime: '15:30', endTime: '16:30' },
  { startTime: '16:00', endTime: '17:00' },
  { startTime: '16:30', endTime: '17:30' },
  { startTime: '17:00', endTime: '18:00' },
  { startTime: '17:30', endTime: '18:30' },
  { startTime: '18:00', endTime: '19:00' },
  { startTime: '18:30', endTime: '19:30' },
  { startTime: '19:00', endTime: '20:00' },
  { startTime: '19:30', endTime: '20:30' },
];

const AdminAvailability = () => {
  const { user } = useAuth();
  const [professionals, setProfessionals] = useState<User[]>([]);
  const [selectedProfessional, setSelectedProfessional] = useState<string>('');
  const [availability, setAvailability] = useState<Availability | null>(null);
  const [schedule, setSchedule] = useState<DaySchedule[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Block date form
  const [blockDate, setBlockDate] = useState('');
  const [blockAllDay, setBlockAllDay] = useState(true);
  const [blockReason, setBlockReason] = useState('');

  useEffect(() => {
    const fetchProfessionals = async () => {
      try {
        const [admins, profs] = await Promise.all([
          userService.getAll({ role: 'admin' }),
          userService.getAll({ role: 'professional' }),
        ]);
        const all = [...admins.users, ...profs.users];
        setProfessionals(all);
        if (all.length > 0 && user) {
          setSelectedProfessional(user.id);
        }
      } catch {
        // ignore
      }
    };
    fetchProfessionals();
  }, [user]);

  useEffect(() => {
    if (!selectedProfessional) return;
    setLoading(true);
    availabilityService.get(selectedProfessional).then((avail) => {
      setAvailability(avail);
      setSchedule(avail?.weeklySchedule || []);
    }).catch(() => {
      setSchedule([]);
    }).finally(() => setLoading(false));
  }, [selectedProfessional]);

  const toggleDaySlot = (dayOfWeek: number, slot: TimeSlot) => {
    setSchedule((prev) => {
      const dayIdx = prev.findIndex((d) => d.dayOfWeek === dayOfWeek);
      if (dayIdx === -1) {
        return [...prev, { dayOfWeek, slots: [slot] }];
      }
      const day = prev[dayIdx];
      const slotExists = day.slots.some(
        (s) => s.startTime === slot.startTime && s.endTime === slot.endTime
      );
      const newSlots = slotExists
        ? day.slots.filter((s) => s.startTime !== slot.startTime)
        : [...day.slots, slot].sort((a, b) => a.startTime.localeCompare(b.startTime));
      const newSchedule = [...prev];
      newSchedule[dayIdx] = { ...day, slots: newSlots };
      return newSchedule;
    });
  };

  const isSlotActive = (dayOfWeek: number, slot: TimeSlot): boolean => {
    const day = schedule.find((d) => d.dayOfWeek === dayOfWeek);
    return !!day?.slots.some((s) => s.startTime === slot.startTime);
  };

  const handleSaveSchedule = async () => {
    if (!selectedProfessional) return;
    setSaving(true);
    try {
      await availabilityService.updateSchedule(selectedProfessional, schedule);
      toast.success('Horario guardado exitosamente');
    } catch {
      toast.error('Error al guardar horario');
    } finally {
      setSaving(false);
    }
  };

  const handleBlockDate = async () => {
    if (!selectedProfessional || !blockDate) return;
    try {
      const result = await availabilityService.blockDate(selectedProfessional, {
        date: blockDate,
        allDay: blockAllDay,
        reason: blockReason,
      });
      setAvailability(result);
      toast.success('Fecha bloqueada');
      setBlockDate('');
      setBlockReason('');
    } catch {
      toast.error('Error al bloquear fecha');
    }
  };

  const handleUnblock = async (blockId: string) => {
    if (!selectedProfessional) return;
    try {
      const result = await availabilityService.unblockDate(selectedProfessional, blockId);
      setAvailability(result);
      toast.success('Bloqueo eliminado');
    } catch {
      toast.error('Error al eliminar bloqueo');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Disponibilidad</h1>
          <p className="text-muted-foreground">Gestiona horarios y bloqueos</p>
        </div>
        <Select value={selectedProfessional} onValueChange={setSelectedProfessional}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Seleccionar profesional" />
          </SelectTrigger>
          <SelectContent>
            {professionals.map((prof) => (
              <SelectItem key={prof.id} value={prof.id}>
                {prof.firstName} {prof.lastName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-secondary" />
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Weekly schedule editor */}
          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Horario Semanal</CardTitle>
              <Button size="sm" onClick={handleSaveSchedule} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                Guardar
              </Button>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      <th className="text-left py-2 pr-4 text-muted-foreground">Hora</th>
                      {DAYS.map((day) => (
                        <th key={day.value} className="text-center py-2 px-1 text-muted-foreground">
                          {day.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {DEFAULT_SLOTS.map((slot) => (
                      <tr key={slot.startTime}>
                        <td className="py-1 pr-4 text-muted-foreground text-xs">
                          {slot.startTime}
                        </td>
                        {DAYS.map((day) => (
                          <td key={day.value} className="text-center py-1 px-1">
                            <Checkbox
                              checked={isSlotActive(day.value, slot)}
                              onCheckedChange={() => toggleDaySlot(day.value, slot)}
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Block dates */}
          <Card>
            <CardHeader>
              <CardTitle>Bloquear Fechas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Fecha</Label>
                <Input
                  type="date"
                  value={blockDate}
                  onChange={(e) => setBlockDate(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={blockAllDay}
                  onCheckedChange={(v) => setBlockAllDay(!!v)}
                  id="allDay"
                />
                <Label htmlFor="allDay">Todo el día</Label>
              </div>
              <div className="space-y-2">
                <Label>Razón (opcional)</Label>
                <Input
                  value={blockReason}
                  onChange={(e) => setBlockReason(e.target.value)}
                  placeholder="Vacaciones, ausencia..."
                />
              </div>
              <Button onClick={handleBlockDate} className="w-full" disabled={!blockDate}>
                <Plus className="h-4 w-4 mr-2" />
                Bloquear
              </Button>

              {/* Blocked dates list */}
              {availability?.blockedDates && availability.blockedDates.length > 0 && (
                <div className="mt-4 space-y-2">
                  <h4 className="text-sm font-medium">Fechas bloqueadas</h4>
                  {availability.blockedDates.map((block) => (
                    <div
                      key={block._id}
                      className="flex items-center justify-between p-2 rounded border border-border text-sm"
                    >
                      <div>
                        <p>{format(parseISO(block.date), 'dd/MM/yyyy')}</p>
                        {block.reason && (
                          <p className="text-xs text-muted-foreground">{block.reason}</p>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => block._id && handleUnblock(block._id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default AdminAvailability;
