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

// Una preparación guardada: la más reciente se ve abierta; las demás, resumidas (para no alargar la ficha)
const PlanItem = ({ plan: p, startOpen, onEdit, onDelete }: { plan: TrainingPlan; startOpen: boolean; onEdit: () => void; onDelete: () => Promise<void> }) => {
  const [open, setOpen] = useState(startOpen);
  const exercises = p.blocks.reduce((n, b) => n + b.slots.length, 0);
  return (
    <li className="rounded-2xl border border-border p-3.5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 text-sm font-semibold">
            <span className="rounded-full border border-[#62b8cf]/50 bg-[#398ca2]/15 px-2 py-0.5 text-[11.5px] font-bold uppercase tracking-[0.1em] text-[#8fd0e0]">Planificado</span>
            <span className="first-letter:uppercase">{dayText(p.forDate)}</span>
            {p.title && <span className="text-muted-foreground">· {p.title}</span>}
          </p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
            <span>{p.blocks.length} {p.blocks.length === 1 ? 'bloque' : 'bloques'} · {exercises} {exercises === 1 ? 'ejercicio' : 'ejercicios'}</span>
            <span className="flex items-center gap-1">{p.visibleToPatient === false ? <><EyeOff className="h-3.5 w-3.5" aria-hidden="true" />Solo el equipo</> : <><Eye className="h-3.5 w-3.5" aria-hidden="true" />Visible para el paciente</>}</span>
          </p>
        </div>
        <RecordRowActions itemLabel="esta preparación" onEdit={onEdit} onDelete={onDelete} />
      </div>
      {open && (
        <>
          <div className="mt-3 rounded-xl bg-[#1f1c21] p-3"><PlanBlocksView blocks={p.blocks} /></div>
          {p.internalNotes && <p className="mt-2 text-xs text-muted-foreground"><b>Nota interna:</b> {p.internalNotes}</p>}
        </>
      )}
      <button type="button" aria-expanded={open} onClick={() => setOpen((v) => !v)} className="mt-1 flex min-h-[44px] items-center rounded-lg text-sm font-semibold text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        {open ? 'Ocultar ejercicios' : 'Ver ejercicios'}
      </button>
    </li>
  );
};

const dayText = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' });

// Portal del profesional: la acción protagonista del paciente («Preparar entrenamiento») y sus preparaciones guardadas, siempre
// marcadas como PLANIFICADO (distinto de lo realizado, que está más abajo en «Ejercicios registrados»).
const PreparationsCard = ({ patientId, patientName, openRequest = 0, onRequestHandled }: { patientId: string; patientName?: string; openRequest?: number; onRequestHandled?: () => void }) => {
  const [plans, setPlans] = useState<TrainingPlan[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<TrainingPlan | null>(null);

  const load = useCallback(() => {
    trainingPlanService.list(patientId).then(setPlans).catch(() => setPlans([])).finally(() => setLoaded(true));
  }, [patientId]);
  useEffect(load, [load]);

  // El botón del encabezado de la ficha pide abrir una preparación nueva
  useEffect(() => {
    if (openRequest > 0) {
      setEditing(null);
      setOpen(true);
      onRequestHandled?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openRequest]);

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
          <Button variant="outline" onClick={() => start(null)} className="min-h-[44px]"><Plus className="h-4 w-4" aria-hidden="true" />Nueva preparación</Button>
        </div>

        {loaded && plans.length > 0 && (
          <ul className="space-y-3">
            {plans.slice(0, 5).map((p, i) => (
              <PlanItem key={p.id} plan={p} startOpen={i === 0} onEdit={() => start(p)} onDelete={() => remove(p)} />
            ))}
            {plans.length > 5 && <li className="text-xs text-muted-foreground">Hay {plans.length - 5} preparaciones más antiguas.</li>}
          </ul>
        )}
      </CardContent>

      <PrepareTrainingDialog patientId={patientId} patientName={patientName} open={open} onOpenChange={setOpen} plan={editing} onSaved={load} />
    </Card>
  );
};

export default PreparationsCard;
