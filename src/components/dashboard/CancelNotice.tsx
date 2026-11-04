import { useState } from 'react';
import { CalendarClock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CANCEL_NOTICE, shouldShowCancelNotice } from '@/lib/cancelNotice';
import { cn } from '@/lib/utils';
import type { Appointment } from '@/types';

const key = (userId: string) => `prime.cancel-notice.${userId}`;
const read = (userId: string): boolean => {
  try {
    return sessionStorage.getItem(key(userId)) === '1';
  } catch {
    return false;
  }
};

// Cada vez que entra a la app: la regla de las 3 horas para cancelar o cambiar el horario. «Entendido» lo cierra hasta la próxima vez
// que abra la app. No sale en pleno horario de entrenamiento.
const CancelNotice = ({ userId, hasPlan, appointments, appointmentsLoading, className }: { userId: string; hasPlan: boolean; appointments: Appointment[] | null; appointmentsLoading: boolean; className?: string }) => {
  const [dismissed, setDismissed] = useState<boolean>(() => read(userId));
  if (!shouldShowCancelNotice({ now: new Date(), hasPlan, appointments, appointmentsLoading, dismissed })) return null;

  const close = () => {
    try {
      sessionStorage.setItem(key(userId), '1');
    } catch {
      // sin almacenamiento: se oculta mientras la página siga abierta
    }
    setDismissed(true);
  };

  return (
    <section role="note" aria-label="Aviso de cancelación" className={cn('flex items-start gap-3 rounded-[22px] border border-[#398ca2]/45 bg-[#398ca2]/10 p-4', className)}>
      <span aria-hidden="true" className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#398ca2]/20 text-[#8fd0e0]"><CalendarClock className="h-5 w-5" /></span>
      <div className="min-w-0 flex-1 space-y-2">
        <p className="text-[15px] font-bold leading-snug text-[#fff8e4]">{CANCEL_NOTICE.title}</p>
        <p className="text-[14px] leading-relaxed text-[#cdc6b6]">{CANCEL_NOTICE.body}</p>
        <Button type="button" variant="ghost" onClick={close} className="-ml-3 min-h-[44px] px-3 font-semibold text-[#8fd0e0] hover:bg-[#fff8e4]/[0.06] hover:text-[#8fd0e0]">Entendido</Button>
      </div>
    </section>
  );
};

export default CancelNotice;
