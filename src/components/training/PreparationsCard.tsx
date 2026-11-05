import { useCallback, useEffect, useState } from 'react';
import { ClipboardList, Eye, EyeOff, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import RecordRowActions from '@/components/records/RecordRowActions';
import PrepareTrainingDialog from './PrepareTrainingDialog';
import PlanBlocksView from './PlanBlocksView';
import { trainingPlanService, type TrainingPlan } from '@/services/trainingPlanService';
import { notify } from '@/lib/notify';
import { showApiError } from '@/lib/apiError';

const dayText = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' });

// Portal del profesional: la acción protagonista del paciente («Preparar entrenamiento») y sus preparaciones guardadas, siempre
// marcadas como PLANIFICADO (distinto de lo realizado, que está más abajo en «Ejercicios registrados»).
const PreparationsCard = ({ patientId, patientName }: { patientId: string; patientName?: string }) => {
  const [plans, setPlans] = useState<TrainingPlan[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<TrainingPlan | null>(null);

  const load = useCallback(() => {
    trainingPlanService.list(patientId).then(setPlans).catch(() => setPlans([])).finally(() => setLoaded(true));
  }, [patientId]);
  useEffect(load, [load]);

  const start = (plan: TrainingPlan | null) => {
    setEditing(plan);
    setOpen(true);
  };
  const remove = async (plan: TrainingPlan) => {
    try {
      await trainingPlanService.remove(plan.id);
      notify.success('Preparación eliminada');
      load();
    } catch (err) {
      showApiError(err, 'No se pudo eliminar la preparación');
      throw err;
    }
  };

  return (
    <Card>
      <CardContent className="space-y-4 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold"><ClipboardList className="h-5 w-5 text-secondary" aria-hidden="true" />Preparar entrenamiento</h2>
            <p className="text-sm text-muted-foreground">Deja armada la próxima sesión (o reutiliza la última). Es lo planificado: no cuenta como realizado.</p>
          </div>
          <Button onClick={() => start(null)} className="min-h-[48px] px-5"><Plus className="h-4 w-4" aria-hidden="true" />Preparar entrenamiento</Button>
        </div>

        {loaded && plans.length > 0 && (
          <ul className="space-y-3">
            {plans.slice(0, 3).map((p) => (
              <li key={p.id} className="rounded-2xl border border-border p-3.5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                      <span className="rounded-full border border-[#62b8cf]/50 bg-[#398ca2]/15 px-2 py-0.5 text-[11.5px] font-bold uppercase tracking-[0.1em] text-[#8fd0e0]">Planificado</span>
                      <span className="first-letter:uppercase">{dayText(p.forDate)}</span>
                      {p.title && <span className="text-muted-foreground">· {p.title}</span>}
                    </p>
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">{p.visibleToPatient === false ? <><EyeOff className="h-3.5 w-3.5" aria-hidden="true" />Solo el equipo</> : <><Eye className="h-3.5 w-3.5" aria-hidden="true" />Visible para el paciente</>}</p>
                  </div>
                  <RecordRowActions itemLabel="esta preparación" onEdit={() => start(p)} onDelete={() => remove(p)} />
                </div>
                <div className="mt-3 rounded-xl bg-[#1f1c21] p-3"><PlanBlocksView blocks={p.blocks} /></div>
                {p.internalNotes && <p className="mt-2 text-xs text-muted-foreground"><b>Nota interna:</b> {p.internalNotes}</p>}
              </li>
            ))}
            {plans.length > 3 && <li className="text-xs text-muted-foreground">Hay {plans.length - 3} preparaciones más antiguas.</li>}
          </ul>
        )}
      </CardContent>

      <PrepareTrainingDialog patientId={patientId} patientName={patientName} open={open} onOpenChange={setOpen} plan={editing} onSaved={load} />
    </Card>
  );
};

export default PreparationsCard;
