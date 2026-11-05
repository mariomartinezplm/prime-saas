import { useEffect, useState } from 'react';
import { ClipboardList } from 'lucide-react';
import { Button } from '@/components/ui/button';
import PlanBlocksView from './PlanBlocksView';
import { trainingPlanService, type PlanBlock, type TrainingPlan } from '@/services/trainingPlanService';
import { CARD } from '@/components/dashboard/brand';
import { cn } from '@/lib/utils';

const dayText = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' });

// Lo que el kinesiólogo le dejó preparado al paciente. Siempre dice «planificado»: no es un entrenamiento realizado y no suma a su
// historial ni a sus gráficos. No hay obligación de hacerlo: con «Usar en mi entrenamiento» se carga como borrador editable en su
// sesión (nada queda guardado hasta que guarde cada bloque) y el entrenamiento libre sigue disponible.
const PlannedTrainingCard = ({ patientId, onUse, className }: { patientId: string; onUse?: (blocks: PlanBlock[]) => void; className?: string }) => {
  const [plan, setPlan] = useState<TrainingPlan | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    trainingPlanService
      .list(patientId)
      .then((plans) => !cancelled && setPlan(plans[0] ?? null))
      .catch(() => !cancelled && setPlan(null));
    return () => {
      cancelled = true;
    };
  }, [patientId]);

  if (!plan) return null;
  return (
    <section aria-label="Entrenamiento preparado por tu kinesiólogo" className={cn(CARD, 'space-y-3 p-4', className)}>
      <div>
        <p className="flex items-center gap-2 text-[11.5px] font-bold uppercase tracking-[0.14em] text-[#8fd0e0]"><ClipboardList className="h-4 w-4" aria-hidden="true" />Planificado por tu kinesiólogo</p>
        <h2 className="mt-1 text-[17px] font-bold text-[#fff8e4]">{plan.title ?? 'Tu próximo entrenamiento'}</h2>
        <p className="text-[13px] first-letter:uppercase text-[#a8a295]">{dayText(plan.forDate)} · aún no realizado</p>
      </div>
      <PlanBlocksView blocks={expanded ? plan.blocks : plan.blocks.slice(0, 2)} />
      {plan.blocks.length > 2 && (
        <button type="button" aria-expanded={expanded} onClick={() => setExpanded((v) => !v)} className="min-h-[44px] rounded-xl text-[13.5px] font-semibold text-[#8fd0e0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#fff8e4]">
          {expanded ? 'Ver menos' : `Ver los ${plan.blocks.length} bloques`}
        </button>
      )}
      {onUse && (
        <div>
          <Button type="button" onClick={() => onUse(plan.blocks)} className="min-h-[48px] w-full">Usar en mi entrenamiento</Button>
          <p className="mt-1.5 text-[12.5px] text-[#a8a295]">Se carga para que lo completes con tus valores reales. Puedes cambiarlo o entrenar libre: no es obligatorio.</p>
        </div>
      )}
    </section>
  );
};

export default PlannedTrainingCard;
