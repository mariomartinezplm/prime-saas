import { useState } from 'react';
import { format, isToday, isTomorrow, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { slotClosureService } from '@/services/slotClosureService';
import { showApiError } from '@/lib/apiError';
import { notify } from '@/lib/notify';
import type { SlotClosure } from '@/types';

const dayLabel = (date: string) => {
  const d = parseISO(date);
  if (isToday(d)) return 'Hoy';
  if (isTomorrow(d)) return 'Mañana';
  const text = format(d, "EEEE d 'de' MMMM", { locale: es });
  return text.charAt(0).toUpperCase() + text.slice(1);
};

interface ClosedSlotsListProps {
  closures: SlotClosure[];
  onChanged: () => void;
}

// Horas cerradas desde hoy, con un botón para reabrirlas. Los que ya están en esa hora se mantienen.
const ClosedSlotsList = ({ closures, onChanged }: ClosedSlotsListProps) => {
  const [busy, setBusy] = useState<string | null>(null);
  if (closures.length === 0) return null;

  const reopen = async (c: SlotClosure) => {
    if (busy) return;
    setBusy(c.id);
    try {
      await slotClosureService.reopen(c.id);
      notify.success(`Horario de las ${c.startTime} reabierto`);
      onChanged();
    } catch (err) {
      showApiError(err, 'No se pudo reabrir el horario');
    } finally {
      setBusy(null);
    }
  };

  return (
    <section aria-label="Horarios cerrados" className="rounded-lg border border-border bg-muted/40 p-3">
      <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
        <Lock className="h-4 w-4 shrink-0" aria-hidden="true" />
        Horarios cerrados
      </p>
      <p className="mb-2 text-xs text-muted-foreground">No se suman pacientes nuevos. Los que ya están se mantienen.</p>
      <ul className="divide-y divide-border">
        {closures.map((c) => (
          <li key={c.id} className="flex items-center justify-between gap-3 py-1.5">
            <span className="min-w-0 text-sm">
              <span className="font-medium">{dayLabel(c.date)} · {c.startTime}</span>
              <span className="block text-xs text-muted-foreground">
                {c.present === 0 ? 'Sin pacientes agendados' : c.present === 1 ? '1 persona se mantiene' : `${c.present} personas se mantienen`}
              </span>
            </span>
            <Button type="button" variant="outline" size="sm" disabled={busy === c.id} onClick={() => reopen(c)} aria-label={`Reabrir el horario de las ${c.startTime} (${dayLabel(c.date)})`}>
              Reabrir
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
};

export default ClosedSlotsList;
