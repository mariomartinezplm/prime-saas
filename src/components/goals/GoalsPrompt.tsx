import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Target } from 'lucide-react';
import BottomSheet from '@/components/premium/BottomSheet';
import { Button } from '@/components/ui/button';
import { BTN_FILL } from '@/components/dashboard/brand';
import { goalService } from '@/services/goalService';
import { GOALS_PROMPT_SNOOZE_DAYS, shouldPromptGoals, type GoalsPromptPref } from '@/lib/goals';
import { cn } from '@/lib/utils';

const key = (userId: string) => `prime.goals-prompt.${userId}`;
const readPref = (userId: string): GoalsPromptPref => {
  try {
    return JSON.parse(localStorage.getItem(key(userId)) ?? '{}') as GoalsPromptPref;
  } catch {
    return {};
  }
};
const writePref = (userId: string, pref: GoalsPromptPref) => {
  try {
    localStorage.setItem(key(userId), JSON.stringify(pref));
  } catch {
    // sin almacenamiento: simplemente se vuelve a preguntar la próxima vez
  }
};

// Pregunta una sola vez, al ingresar, qué quiere mejorar la persona que todavía no definió ningún objetivo.
const GoalsPrompt = ({ userId, enabled }: { userId: string; enabled: boolean }) => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    goalService
      .list(userId)
      .then((goals) => {
        if (!cancelled && shouldPromptGoals({ hasPlan: true, goalsLoaded: true, goalCount: goals.length, pref: readPref(userId), now: Date.now() })) setOpen(true);
      })
      .catch(() => undefined); // si no carga, no se molesta a la persona
    return () => {
      cancelled = true;
    };
  }, [userId, enabled]);

  const later = () => {
    writePref(userId, { snoozedUntil: Date.now() + GOALS_PROMPT_SNOOZE_DAYS * 86400000 });
    setOpen(false);
  };
  const never = () => {
    writePref(userId, { optOut: true });
    setOpen(false);
  };

  return (
    <BottomSheet open={open} onOpenChange={(o) => !o && later()} title="¿Qué te gustaría lograr?" description="Cuéntanos tu objetivo para seguir tu avance con tus propios registros.">
      <div className="space-y-4 pb-2 pt-1">
        <span aria-hidden="true" className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[#398ca2]/45 bg-[#398ca2]/15 text-[#8fd0e0]"><Target className="h-7 w-7" /></span>
        <p className="text-[14.5px] leading-relaxed text-[#cdc6b6]">Por ejemplo: aumentar tu fuerza, reducir un dolor, ganar movilidad o bajar de peso. Toma menos de un minuto y puedes cambiarlo cuando quieras.</p>
        <div className="space-y-2">
          <Button type="button" onClick={() => { setOpen(false); navigate('/app/objetivos/nuevo'); }} className={cn('min-h-[52px] w-full rounded-2xl text-base font-bold', BTN_FILL)}>Elegir mi objetivo</Button>
          <Button type="button" variant="ghost" onClick={later} className="min-h-[48px] w-full text-[#cdc6b6] hover:bg-[#fff8e4]/[0.06] hover:text-[#fff8e4]">Más tarde</Button>
          <Button type="button" variant="ghost" onClick={never} className="min-h-[44px] w-full text-[13px] text-[#a8a295] hover:bg-transparent hover:text-[#cdc6b6]">No quiero definir objetivos</Button>
        </div>
      </div>
    </BottomSheet>
  );
};

export default GoalsPrompt;
