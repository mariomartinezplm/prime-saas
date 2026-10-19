import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Pause, Play, Repeat, Trash2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import LoadErrorAlert from '@/components/shared/LoadErrorAlert';
import LoadingState from '@/components/shared/LoadingState';
import SubmitButton from '@/components/forms/SubmitButton';
import { appointmentTypeLabels } from '@/components/shared/statusMeta';
import { availabilityService } from '@/services/availabilityService';
import { recurringSlotService } from '@/services/recurringSlotService';
import { showApiError } from '@/lib/apiError';
import { notify } from '@/lib/notify';
import { capitalizeFirst } from '@/lib/utils';
import type { Availability, RecurringSlot, RecurringSlotResult } from '@/types';

type SlotType = RecurringSlot['type'];

interface FixedScheduleDialogProps {
  open: boolean;
  onClose: () => void;
  professionalId: string;
  // Tipos de sesión para los que la persona tiene plan (el servidor lo vuelve a comprobar)
  allowedTypes: SlotType[];
  // Solo el personal: el paciente al que se le arma el horario. Sin esto, se usa el del propio paciente.
  patientId?: string;
  // Se avisa cuando se agendaron o cambiaron citas, para que la pantalla de fondo las recargue
  onChanged?: () => void;
}

const DAYS = [
  { value: 1, label: 'Lunes' },
  { value: 2, label: 'Martes' },
  { value: 3, label: 'Miércoles' },
  { value: 4, label: 'Jueves' },
  { value: 5, label: 'Viernes' },
  { value: 6, label: 'Sábado' },
];

const dayLabel = (dayOfWeek: number) => DAYS.find((d) => d.value === dayOfWeek)?.label ?? '';
const shortDate = (date: string) => capitalizeFirst(format(parseISO(date), "EEEE d 'de' MMMM", { locale: es }));

// «Horario fijo»: el mismo día y hora cada semana, agendado solo dentro de los días del plan. Al abrirse el plan del mes
// siguiente (y pagarse) el sistema agenda esas fechas sin que la persona haga nada.
const FixedScheduleDialog = ({ open, onClose, professionalId, allowedTypes, patientId, onChanged }: FixedScheduleDialogProps) => {
  const [slots, setSlots] = useState<RecurringSlot[] | null>(null);
  const [availability, setAvailability] = useState<Availability | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const [day, setDay] = useState('');
  const [time, setTime] = useState('');
  const [type, setType] = useState<SlotType>(allowedTypes[0] ?? 'entrenamiento');
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [result, setResult] = useState<RecurringSlotResult | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [removing, setRemoving] = useState<RecurringSlot | null>(null);
  // El personal arma el horario de otra persona: los textos hablan del paciente, no de «tú»
  const forPatient = !!patientId;

  const load = useCallback(async () => {
    setLoadFailed(false);
    try {
      const [list, schedule] = await Promise.all([recurringSlotService.list(patientId), availabilityService.get(professionalId)]);
      setSlots(list);
      setAvailability(schedule);
    } catch {
      setLoadFailed(true);
    }
  }, [patientId, professionalId]);

  useEffect(() => {
    if (open) load();
  }, [open, attempt, load]);

  const usedDays = useMemo(() => new Set((slots ?? []).map((s) => s.dayOfWeek)), [slots]);

  // Solo los días en que el profesional atiende y la persona todavía no tiene un horario fijo
  const dayOptions = useMemo(
    () => DAYS.filter((d) => !usedDays.has(d.value) && availability?.weeklySchedule?.some((w) => w.dayOfWeek === d.value && w.slots.length > 0)),
    [usedDays, availability]
  );

  const timeOptions = useMemo(() => {
    const schedule = availability?.weeklySchedule?.find((w) => w.dayOfWeek === Number(day));
    return [...new Set((schedule?.slots ?? []).map((s) => s.startTime))].sort();
  }, [availability, day]);

  const canAdd = !!day && !!time && !saving;

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canAdd || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      const created = await recurringSlotService.create({ dayOfWeek: Number(day), startTime: time, type, ...(patientId && { patient: patientId }) });
      setResult(created);
      setDay('');
      setTime('');
      await load();
      onChanged?.();
    } catch (err) {
      showApiError(err, 'No se pudo guardar el horario fijo');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const togglePause = async (slot: RecurringSlot) => {
    setBusyId(slot._id);
    try {
      const updated = await recurringSlotService.setActive(slot._id, !slot.active);
      setResult(slot.active ? null : updated);
      await load();
      if (!slot.active) onChanged?.();
    } catch (err) {
      showApiError(err, 'No se pudo actualizar el horario fijo');
    } finally {
      setBusyId(null);
    }
  };

  const confirmRemove = async () => {
    if (!removing) return;
    try {
      const message = await recurringSlotService.remove(removing._id);
      notify.success(message);
      setRemoving(null);
      setResult(null);
      await load();
    } catch (err) {
      showApiError(err, 'No se pudo eliminar el horario fijo');
      throw err;
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(next) => !next && !saving && onClose()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Repeat className="h-5 w-5" aria-hidden="true" />
              Horario fijo
            </DialogTitle>
            <DialogDescription>
              {forPatient
                ? 'Deja el día y la hora de cada semana del paciente. Agendamos sus sesiones solas dentro de los días de su plan, y cada mes nuevo, apenas empieza su plan. Puede tener hasta 3 días fijos.'
                : 'Deja tu día y tu hora de cada semana. Agendamos tus sesiones solas dentro de los días de tu plan, y cada mes nuevo, apenas empieza tu plan. Puedes tener hasta 3 días fijos.'}
            </DialogDescription>
          </DialogHeader>

          {slots === null && !loadFailed && <LoadingState label="Cargando tus horarios fijos…" className="py-8" />}
          {loadFailed && <LoadErrorAlert message="No se pudieron cargar los horarios fijos." onRetry={() => setAttempt((n) => n + 1)} />}

          {slots !== null && (
            <div className="space-y-5">
              {result && (
                <Alert>
                  <AlertDescription className="space-y-1" role="status">
                    {result.created.length > 0 && (
                      <p>
                        <strong>Agendamos {result.created.length} {result.created.length === 1 ? 'sesión' : 'sesiones'}:</strong>{' '}
                        {result.created.map(shortDate).join(', ')}.
                      </p>
                    )}
                    {result.created.length === 0 && result.skipped.length === 0 && result.pendingPayment === 0 && (
                      <p>Listo. No quedan fechas por agendar en tu plan actual; se agendarán solas cuando empiece el siguiente.</p>
                    )}
                    {result.skipped.length > 0 && (
                      <p>
                        No pudimos agendar: {result.skipped.map((s) => `${capitalizeFirst(s.label)}`).join(', ')}.{' '}
                        {forPatient ? 'Se puede agendar otra hora para esas fechas con «Agendar cita».' : 'Puedes elegir otra hora desde «Agendar una hora».'}
                      </p>
                    )}
                    {result.pendingPayment > 0 && (
                      <p>Algunas fechas se agendarán cuando se registre el pago de {forPatient ? 'la renovación' : 'tu renovación'}.</p>
                    )}
                  </AlertDescription>
                </Alert>
              )}

              <section aria-labelledby="mis-horarios-fijos" className="space-y-2">
                <h3 id="mis-horarios-fijos" className="text-sm font-semibold">
                  {forPatient ? 'Horarios fijos' : 'Tus horarios fijos'}
                </h3>
                {slots.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{forPatient ? 'Todavía no tiene ninguno.' : 'Todavía no tienes ninguno.'}</p>
                ) : (
                  <ul className="space-y-2">
                    {slots.map((slot) => (
                      <li key={slot._id} className="space-y-2 rounded-lg border border-border p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="text-sm font-medium">
                              Todos los {dayLabel(slot.dayOfWeek).toLowerCase()} · <span className="tabular-nums">{slot.startTime}</span>
                            </p>
                            <p className="text-xs text-muted-foreground">{appointmentTypeLabels[slot.type]}</p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant={slot.active ? 'success' : 'outline'}>{slot.active ? 'Activo' : 'En pausa'}</Badge>
                            <Button type="button" variant="outline" size="sm" disabled={busyId === slot._id} onClick={() => togglePause(slot)}>
                              {slot.active ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
                              {slot.active ? 'Pausar' : 'Reanudar'}
                            </Button>
                            <Button type="button" variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={() => setRemoving(slot)}>
                              <Trash2 aria-hidden="true" />
                              <span className="sr-only sm:not-sr-only">Quitar</span>
                              <span className="sr-only">horario fijo de los {dayLabel(slot.dayOfWeek)}</span>
                            </Button>
                          </div>
                        </div>
                        {slot.skipped.length > 0 && (
                          <p className="text-xs text-muted-foreground">
                            No se pudo agendar: {slot.skipped.map((s) => `${capitalizeFirst(s.label)} (${s.code === 'FULL' ? 'horario lleno' : 'sin atención'})`).join(', ')}.
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {slots.length < 3 && (
                <form onSubmit={handleAdd} className="space-y-3 rounded-lg border border-dashed border-border p-3">
                  <h3 className="text-sm font-semibold">Agregar un horario fijo</h3>
                  {dayOptions.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{forPatient ? 'El profesional no tiene más días con horario disponible para dejar fijos.' : 'Tu profesional no tiene más días con horario disponible para dejar fijos.'}</p>
                  ) : (
                    <>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1.5">
                          <Label htmlFor="fixed-day">Día de la semana</Label>
                          <Select
                            value={day}
                            onValueChange={(value) => {
                              setDay(value);
                              setTime('');
                            }}
                          >
                            <SelectTrigger id="fixed-day">
                              <SelectValue placeholder="Elige un día" />
                            </SelectTrigger>
                            <SelectContent>
                              {dayOptions.map((d) => (
                                <SelectItem key={d.value} value={String(d.value)}>
                                  {d.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="fixed-time">Hora</Label>
                          <Select value={time} onValueChange={setTime} disabled={!day}>
                            <SelectTrigger id="fixed-time">
                              <SelectValue placeholder={day ? 'Elige una hora' : 'Primero el día'} />
                            </SelectTrigger>
                            <SelectContent>
                              {timeOptions.map((t) => (
                                <SelectItem key={t} value={t}>
                                  {t}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      {allowedTypes.length > 1 && (
                        <div className="space-y-1.5">
                          <Label htmlFor="fixed-type">Tipo de sesión</Label>
                          <Select value={type} onValueChange={(value) => setType(value as SlotType)}>
                            <SelectTrigger id="fixed-type">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {allowedTypes.map((t) => (
                                <SelectItem key={t} value={t}>
                                  {appointmentTypeLabels[t]}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                      <SubmitButton loading={saving} loadingLabel="Guardando…" disabled={!canAdd}>
                        Guardar horario fijo
                      </SubmitButton>
                    </>
                  )}
                </form>
              )}
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!removing}
        onOpenChange={(next) => !next && setRemoving(null)}
        title="¿Quitar este horario fijo?"
        description={`Dejaremos de agendar esos días y se cancelarán las citas futuras de este horario que siguen agendadas; las sesiones descontadas se devuelven al plan.${forPatient ? '' : ' Las que empiecen en menos de 4 horas se conservan.'} Las citas que ya se realizaron no se tocan.`}
        confirmLabel="Sí, quitar"
        cancelLabel="Volver"
        destructive
        onConfirm={confirmRemove}
      />
    </>
  );
};

export default FixedScheduleDialog;
