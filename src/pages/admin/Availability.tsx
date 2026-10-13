import { useCallback, useEffect, useMemo, useState } from 'react';
import { format, getDay, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Copy, Loader2, Plus, Save, Trash2, TriangleAlert, Undo2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { userService } from '@/services/userService';
import { availabilityService } from '@/services/availabilityService';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import EmptyState from '@/components/shared/EmptyState';
import LoadingState from '@/components/shared/LoadingState';
import LoadErrorAlert from '@/components/shared/LoadErrorAlert';
import PageHeader from '@/components/shared/PageHeader';
import { dayKey, parseDay } from '@/lib/appointments';
import { showApiError } from '@/lib/apiError';
import { todayLocal } from '@/lib/evolutionDate';
import { notify } from '@/lib/notify';
import { capitalizeFirst, cn } from '@/lib/utils';
import type { Availability, BlockedDate, DaySchedule, TimeSlot, User } from '@/types';

const DAYS = [
  { value: 1, label: 'Lunes', short: 'Lun' },
  { value: 2, label: 'Martes', short: 'Mar' },
  { value: 3, label: 'Miércoles', short: 'Mié' },
  { value: 4, label: 'Jueves', short: 'Jue' },
  { value: 5, label: 'Viernes', short: 'Vie' },
  { value: 6, label: 'Sábado', short: 'Sáb' },
];

const toTime = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

// Horas de inicio posibles: cada 30 minutos de 07:00 a 19:30; cada sesión dura 60 minutos.
const ALL_SLOTS: TimeSlot[] = Array.from({ length: 26 }, (_, i) => {
  const start = 7 * 60 + i * 30;
  return { startTime: toTime(start), endTime: toTime(start + 60) };
});

const byStart = (a: TimeSlot, b: TimeSlot) => a.startTime.localeCompare(b.startTime);

const slotsOf = (schedule: DaySchedule[], day: number): TimeSlot[] => schedule.find((d) => d.dayOfWeek === day)?.slots ?? [];

const withDay = (schedule: DaySchedule[], day: number, slots: TimeSlot[]): DaySchedule[] => {
  const rest = schedule.filter((d) => d.dayOfWeek !== day);
  return slots.length > 0 ? [...rest, { dayOfWeek: day, slots }].sort((a, b) => a.dayOfWeek - b.dayOfWeek) : rest;
};

// Para comparar lo guardado con lo editado: un día sin horarios equivale a no tener el día.
const normalize = (schedule: DaySchedule[]) =>
  JSON.stringify(
    schedule
      .filter((d) => d.slots.length > 0)
      .map((d) => ({ dayOfWeek: d.dayOfWeek, slots: [...d.slots].sort(byStart).map((s) => [s.startTime, s.endTime]) }))
      .sort((a, b) => a.dayOfWeek - b.dayOfWeek)
  );

const SlotChip = ({ time, active, onToggle }: { time: string; active: boolean; onToggle: () => void }) => (
  <button
    type="button"
    aria-pressed={active}
    onClick={onToggle}
    className={cn(
      'rounded-md border px-2 py-2.5 text-sm font-medium tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
      active ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-muted/40 text-muted-foreground hover:bg-accent hover:text-foreground'
    )}
  >
    {time}
  </button>
);

const AdminAvailability = () => {
  const { user } = useAuth();
  const [professionals, setProfessionals] = useState<User[]>([]);
  const [selectedProfessional, setSelectedProfessional] = useState('');
  const [pendingProfessional, setPendingProfessional] = useState<string | null>(null);
  const [availability, setAvailability] = useState<Availability | null>(null);
  const [schedule, setSchedule] = useState<DaySchedule[]>([]);
  const [savedSchedule, setSavedSchedule] = useState<DaySchedule[]>([]);
  const [day, setDay] = useState(1);
  const [loading, setLoading] = useState(false);
  // Si el horario no se pudo cargar NO se muestra el editor: un "Guardar" con la lista vacía borraría el horario real.
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);

  // Bloqueos
  const [blockDate, setBlockDate] = useState('');
  const [blockAllDay, setBlockAllDay] = useState(true);
  const [blockSlots, setBlockSlots] = useState<string[]>([]);
  const [blockReason, setBlockReason] = useState('');
  const [blocking, setBlocking] = useState(false);
  const [unblocking, setUnblocking] = useState<BlockedDate | null>(null);

  const dirty = useMemo(() => normalize(schedule) !== normalize(savedSchedule), [schedule, savedSchedule]);

  // Sin la lista de profesionales no hay horario que editar: si falla se avisa (antes quedaba un editor vacío)
  const [professionalsError, setProfessionalsError] = useState(false);

  const loadProfessionals = useCallback(() => {
    setProfessionalsError(false);
    Promise.all([userService.getAll({ role: 'admin' }), userService.getAll({ role: 'professional' })])
      .then(([admins, profs]) => {
        const all = [...admins.users, ...profs.users];
        setProfessionals(all);
        if (all.length > 0 && user) setSelectedProfessional(user.id);
      })
      .catch(() => setProfessionalsError(true));
  }, [user]);

  useEffect(() => {
    loadProfessionals();
  }, [loadProfessionals]);

  const loadAvailability = useCallback(async () => {
    if (!selectedProfessional) return;
    setLoading(true);
    setLoadError(false);
    try {
      const avail = await availabilityService.get(selectedProfessional);
      const loaded = avail?.weeklySchedule ?? [];
      setAvailability(avail);
      setSchedule(loaded);
      setSavedSchedule(loaded);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [selectedProfessional]);

  useEffect(() => {
    loadAvailability();
  }, [loadAvailability]);

  const requestProfessional = (id: string) => {
    if (id === selectedProfessional) return;
    if (dirty) setPendingProfessional(id);
    else setSelectedProfessional(id);
  };

  const toggleSlot = (slot: TimeSlot) => {
    setSchedule((prev) => {
      const current = slotsOf(prev, day);
      const exists = current.some((s) => s.startTime === slot.startTime);
      const next = exists ? current.filter((s) => s.startTime !== slot.startTime) : [...current, slot].sort(byStart);
      return withDay(prev, day, next);
    });
  };

  const copyDayTo = (targets: number[]) => {
    const source = slotsOf(schedule, day);
    setSchedule((prev) => targets.reduce((acc, target) => withDay(acc, target, source), prev));
    notify.info('Horario copiado. Revisa y pulsa "Guardar cambios" para aplicarlo.');
  };

  const handleSave = async () => {
    if (!selectedProfessional) return;
    setSaving(true);
    try {
      const toSave = schedule.filter((d) => d.slots.length > 0);
      await availabilityService.updateSchedule(selectedProfessional, toSave);
      setSchedule(toSave);
      setSavedSchedule(toSave);
      notify.success('Horario guardado');
    } catch (err) {
      showApiError(err, 'No se pudo guardar el horario');
    } finally {
      setSaving(false);
    }
  };

  // Horas del día elegido para el bloqueo: las que el profesional tiene configuradas ese día de la semana
  const blockDayOptions = blockDate ? slotsOf(savedSchedule, getDay(parseISO(blockDate))) : [];
  const canBlock = !!blockDate && (blockAllDay || blockSlots.length > 0);

  const handleBlockDate = async () => {
    if (!selectedProfessional || !canBlock) return;
    setBlocking(true);
    try {
      const result = await availabilityService.blockDate(selectedProfessional, {
        date: blockDate,
        allDay: blockAllDay,
        slots: blockAllDay ? [] : ALL_SLOTS.filter((s) => blockSlots.includes(s.startTime)),
        reason: blockReason.trim() || undefined,
      });
      setAvailability(result);
      notify.success(blockAllDay ? 'Día bloqueado' : 'Horarios bloqueados');
      setBlockDate('');
      setBlockSlots([]);
      setBlockReason('');
      setBlockAllDay(true);
    } catch (err) {
      showApiError(err, 'No se pudo bloquear la fecha');
    } finally {
      setBlocking(false);
    }
  };

  const confirmUnblock = async () => {
    if (!selectedProfessional || !unblocking?._id) return;
    try {
      setAvailability(await availabilityService.unblockDate(selectedProfessional, unblocking._id));
      notify.success('Bloqueo eliminado');
    } catch (err) {
      showApiError(err, 'No se pudo eliminar el bloqueo');
      throw err;
    }
  };

  const blocked = [...(availability?.blockedDates ?? [])].sort((a, b) => dayKey(a.date).localeCompare(dayKey(b.date)));
  const today = todayLocal();
  const dayCount = (d: number) => slotsOf(schedule, d).length;
  const copyTargets = DAYS.filter((d) => d.value !== day);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Disponibilidad"
        description="Elige las horas en que atiendes cada día y bloquea fechas puntuales."
        actions={
          professionals.length > 1 && (
            <Select value={selectedProfessional} onValueChange={requestProfessional}>
              <SelectTrigger className="w-[220px]" aria-label="Profesional">
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
          )
        }
      />

      {professionalsError ? (
        <LoadErrorAlert message="No se pudo cargar la lista de profesionales, por eso no se muestra el horario." onRetry={loadProfessionals} />
      ) : loading ? (
        <LoadingState label="Cargando horario…" />
      ) : loadError ? (
        <Alert variant="warning">
          <TriangleAlert className="h-4 w-4" aria-hidden="true" />
          <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
            <span>No se pudo cargar el horario, por eso no se muestra el editor (así no se pisa el horario guardado).</span>
            <Button variant="outline" size="sm" onClick={loadAvailability}>
              Reintentar
            </Button>
          </AlertDescription>
        </Alert>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Horario semanal</CardTitle>
              <CardDescription>
                Cada botón es una hora de inicio (la sesión dura 60 minutos). Los cambios se aplican al pulsar “Guardar cambios”.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Tabs value={String(day)} onValueChange={(v) => setDay(Number(v))}>
                <TabsList className="grid h-auto w-full grid-cols-6">
                  {DAYS.map((d) => (
                    <TabsTrigger key={d.value} value={String(d.value)} className="flex flex-col gap-0.5 px-1 py-1.5">
                      <span className="sm:hidden">{d.short}</span>
                      <span className="hidden sm:inline">{d.label}</span>
                      <span className={cn('text-[10px] font-normal', dayCount(d.value) === 0 && 'text-muted-foreground')}>
                        {dayCount(d.value) === 0 ? 'sin horario' : `${dayCount(d.value)} horas`}
                      </span>
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>

              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setSchedule((prev) => withDay(prev, day, ALL_SLOTS))}>
                  Seleccionar todas
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => setSchedule((prev) => withDay(prev, day, []))} disabled={dayCount(day) === 0}>
                  Limpiar día
                </Button>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button type="button" variant="outline" size="sm" disabled={dayCount(day) === 0}>
                      <Copy aria-hidden="true" />
                      Copiar a otros días
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64 space-y-3">
                    <p className="text-sm font-medium">Copiar el horario de {DAYS.find((d) => d.value === day)?.label}</p>
                    <CopyDayForm targets={copyTargets} onCopy={copyDayTo} />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6" role="group" aria-label={`Horas de ${DAYS.find((d) => d.value === day)?.label}`}>
                {ALL_SLOTS.map((slot) => (
                  <SlotChip
                    key={slot.startTime}
                    time={slot.startTime}
                    active={slotsOf(schedule, day).some((s) => s.startTime === slot.startTime)}
                    onToggle={() => toggleSlot(slot)}
                  />
                ))}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
                <p className={cn('text-sm', dirty ? 'font-medium text-warning' : 'text-muted-foreground')} aria-live="polite">
                  {dirty ? 'Tienes cambios sin guardar' : 'Todo guardado'}
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setSchedule(savedSchedule)} disabled={!dirty || saving}>
                    <Undo2 aria-hidden="true" />
                    Descartar
                  </Button>
                  <Button onClick={handleSave} disabled={!dirty || saving}>
                    {saving ? <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <Save aria-hidden="true" />}
                    Guardar cambios
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Bloquear fechas</CardTitle>
              <CardDescription>Vacaciones, ausencias o un par de horas puntuales.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="block-date">Fecha</Label>
                <Input
                  id="block-date"
                  type="date"
                  min={today}
                  value={blockDate}
                  onChange={(e) => {
                    setBlockDate(e.target.value);
                    setBlockSlots([]);
                  }}
                />
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="block-all-day" checked={blockAllDay} onCheckedChange={(v) => setBlockAllDay(!!v)} />
                <Label htmlFor="block-all-day">Todo el día</Label>
              </div>

              {!blockAllDay && blockDate && (
                <div className="space-y-2">
                  <Label>Horas a bloquear</Label>
                  {blockDayOptions.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Ese día de la semana no tiene horario configurado.</p>
                  ) : (
                    <div className="grid grid-cols-3 gap-2" role="group" aria-label="Horas a bloquear">
                      {blockDayOptions.map((slot) => (
                        <SlotChip
                          key={slot.startTime}
                          time={slot.startTime}
                          active={blockSlots.includes(slot.startTime)}
                          onToggle={() =>
                            setBlockSlots((prev) => (prev.includes(slot.startTime) ? prev.filter((t) => t !== slot.startTime) : [...prev, slot.startTime]))
                          }
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="block-reason">Motivo (opcional)</Label>
                <Input id="block-reason" value={blockReason} onChange={(e) => setBlockReason(e.target.value)} placeholder="Vacaciones, ausencia…" maxLength={120} />
              </div>
              <Button onClick={handleBlockDate} className="w-full" disabled={!canBlock || blocking}>
                {blocking ? <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <Plus aria-hidden="true" />}
                Bloquear
              </Button>

              <div className="space-y-2 border-t border-border pt-4">
                <h3 className="text-sm font-medium">Fechas bloqueadas</h3>
                {blocked.length === 0 ? (
                  <EmptyState title="Sin bloqueos" description="Las fechas que bloquees aparecerán aquí." className="border-0 px-0 py-4" />
                ) : (
                  <ul className="space-y-2">
                    {blocked.map((block) => {
                      const isPast = dayKey(block.date) < today;
                      return (
                        <li
                          key={block._id ?? block.date}
                          className={cn('flex items-start justify-between gap-2 rounded-lg border border-border p-3 text-sm', isPast && 'opacity-60')}
                        >
                          <div className="min-w-0 space-y-1">
                            <p className="font-medium">{capitalizeFirst(format(parseDay(block.date), "EEEE d 'de' MMMM yyyy", { locale: es }))}</p>
                            <p className="text-xs text-muted-foreground">
                              {block.allDay ? 'Todo el día' : `${block.slots?.length ?? 0} horas: ${(block.slots ?? []).map((s) => s.startTime).join(', ')}`}
                            </p>
                            {block.reason && <p className="text-xs text-muted-foreground">{block.reason}</p>}
                            {isPast && <Badge variant="neutral">Pasado</Badge>}
                          </div>
                          <Button variant="ghost" size="icon" aria-label="Quitar bloqueo" onClick={() => setUnblocking(block)}>
                            <Trash2 className="text-destructive" aria-hidden="true" />
                          </Button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <ConfirmDialog
        open={!!unblocking}
        onOpenChange={(open) => !open && setUnblocking(null)}
        title="¿Quitar este bloqueo?"
        description="Esas horas volverán a estar disponibles para que los pacientes reserven."
        confirmLabel="Sí, quitar bloqueo"
        cancelLabel="Volver"
        destructive
        onConfirm={confirmUnblock}
      />

      <ConfirmDialog
        open={pendingProfessional !== null}
        onOpenChange={(open) => !open && setPendingProfessional(null)}
        title="Tienes cambios sin guardar"
        description="Si cambias de profesional, los cambios que hiciste en este horario se perderán."
        confirmLabel="Cambiar y descartar"
        cancelLabel="Seguir editando"
        onConfirm={() => {
          if (pendingProfessional) setSelectedProfessional(pendingProfessional);
          setPendingProfessional(null);
        }}
      />
    </div>
  );
};

const CopyDayForm = ({ targets, onCopy }: { targets: typeof DAYS; onCopy: (days: number[]) => void }) => {
  const [chosen, setChosen] = useState<number[]>([]);
  return (
    <>
      <div className="space-y-2">
        {targets.map((d) => (
          <div key={d.value} className="flex items-center gap-2">
            <Checkbox
              id={`copy-${d.value}`}
              checked={chosen.includes(d.value)}
              onCheckedChange={(v) => setChosen((prev) => (v ? [...prev, d.value] : prev.filter((x) => x !== d.value)))}
            />
            <Label htmlFor={`copy-${d.value}`}>{d.label}</Label>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">Reemplaza los horarios de los días elegidos. No se guarda hasta que pulses “Guardar cambios”.</p>
      <Button size="sm" className="w-full" disabled={chosen.length === 0} onClick={() => onCopy(chosen)}>
        Copiar
      </Button>
    </>
  );
};

export default AdminAvailability;
