import { useState } from 'react';
import { CalendarClock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MONDAY_NOTICE, santiagoDay, shouldShowMondayNotice } from '@/lib/mondayNotice';
import { cn } from '@/lib/utils';

const key = (userId: string) => `prime.monday-notice.${userId}`;
const read = (userId: string): string | null => {
  try {
    return localStorage.getItem(key(userId));
  } catch {
    return null;
  }
};

// Los lunes, al entrar: la regla de las 4 horas para cancelar o reagendar. Se cierra con «Entendido» y no vuelve hasta el lunes siguiente.
const MondayNotice = ({ userId, hasPlan, className }: { userId: string; hasPlan: boolean; className?: string }) => {
  const [dismissed, setDismissed] = useState<string | null>(() => read(userId));
  if (!shouldShowMondayNotice({ now: new Date(), hasPlan, dismissedDay: dismissed })) return null;

  const close = () => {
    const today = santiagoDay(new Date()).day;
    try {
      localStorage.setItem(key(userId), today);
    } catch {
      // sin almacenamiento: se oculta mientras la página siga abierta
    }
    setDismissed(today);
  };

  return (
    <section role="note" aria-label="Aviso de los lunes" className={cn('flex items-start gap-3 rounded-[22px] border border-[#398ca2]/45 bg-[#398ca2]/10 p-4', className)}>
      <span aria-hidden="true" className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#398ca2]/20 text-[#8fd0e0]"><CalendarClock className="h-5 w-5" /></span>
      <div className="min-w-0 flex-1 space-y-2">
        <p className="text-[15px] font-bold leading-snug text-[#fff8e4]">{MONDAY_NOTICE.title}</p>
        <p className="text-[14px] leading-relaxed text-[#cdc6b6]">{MONDAY_NOTICE.body}</p>
        <Button type="button" variant="ghost" onClick={close} className="-ml-3 min-h-[44px] px-3 font-semibold text-[#8fd0e0] hover:bg-[#fff8e4]/[0.06] hover:text-[#8fd0e0]">Entendido</Button>
      </div>
    </section>
  );
};

export default MondayNotice;
