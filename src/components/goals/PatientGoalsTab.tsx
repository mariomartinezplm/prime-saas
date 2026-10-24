import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, Plus, Target } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import BottomSheet from '@/components/premium/BottomSheet';
import EmptyGuide from '@/components/premium/EmptyGuide';
import LoadErrorAlert from '@/components/shared/LoadErrorAlert';
import { CardsSkeleton } from '@/components/shared/Skeletons';
import { BTN_FILL, CARD } from '@/components/dashboard/brand';
import GoalCard, { StatusPill } from '@/components/goals/GoalCard';
import GoalIcon from '@/components/goals/GoalIcon';
import CheckinSheet from '@/components/goals/CheckinSheet';
import TargetSheet from '@/components/goals/TargetSheet';
import { goalService, type GoalCatalog, type GoalSources, type GoalView, type IndicatorProgress } from '@/services/goalService';
import { activeGoals, paramsText } from '@/lib/goals';
import { notify } from '@/lib/notify';
import { showApiError } from '@/lib/apiError';
import { cn } from '@/lib/utils';

// Vista del profesional: los objetivos del paciente con su avance real, la validación de las metas clínicas, el cambio de
// metas con historial y el descarte con motivo. El administrador ve lo mismo pero solo un profesional valida metas clínicas.
const PatientGoalsTab = ({ patientId }: { patientId: string }) => {
  const { user } = useAuth();
  const [goals, setGoals] = useState<GoalView[]>([]);
  const [catalog, setCatalog] = useState<GoalCatalog | null>(null);
  const [sources, setSources] = useState<GoalSources | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [sheet, setSheet] = useState<{ kind: 'validate' | 'update_target'; goal: GoalView } | null>(null);
  const [checkin, setCheckin] = useState<{ goal: GoalView; indicator: IndicatorProgress } | null>(null);
  const [discard, setDiscard] = useState<GoalView | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [showClosed, setShowClosed] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      const [g, c] = await Promise.all([goalService.list(patientId), goalService.getCatalog()]);
      setGoals(g);
      setCatalog(c);
      goalService.sources(patientId).then(setSources).catch(() => setSources(null));
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [patientId]);
  useEffect(() => {
    load();
  }, [load]);

  const category = (g: GoalView) => catalog?.categories.find((c) => c.id === g.categoryId);
  const active = useMemo(() => activeGoals(goals), [goals]);
  const closed = useMemo(() => goals.filter((g) => g.status === 'paused' || g.status === 'achieved' || g.status === 'discarded'), [goals]);
  const replace = (updated: GoalView) => setGoals((list) => list.map((g) => (g.id === updated.id ? updated : g)));
  const canValidate = user?.role === 'professional';

  const act = async (goal: GoalView, action: 'pause' | 'resume') => {
    try {
      replace(await goalService.act(goal.id, { action }));
      notify.success(action === 'pause' ? 'Objetivo en pausa' : 'Objetivo reanudado');
      if (action === 'resume') load();
    } catch (err) {
      showApiError(err, 'No se pudo cambiar el objetivo');
    }
  };

  const confirmDiscard = async () => {
    if (!discard || busy) return;
    if (!reason.trim()) return notify.error('Indica el motivo para descartar el objetivo');
    setBusy(true);
    try {
      replace(await goalService.act(discard.id, { action: 'discard', note: reason.trim() }));
      notify.success('Objetivo descartado');
      setDiscard(null);
      setReason('');
    } catch (err) {
      showApiError(err, 'No se pudo descartar el objetivo');
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <CardsSkeleton count={2} bodyHeight="h-40" />;
  if (failed) return <LoadErrorAlert message="No se pudieron cargar los objetivos." onRetry={load} />;

  const staff = { canValidate, onValidate: (g: GoalView) => setSheet({ kind: 'validate', goal: g }), onEditTarget: (g: GoalView) => setSheet({ kind: 'update_target', goal: g }), onDiscard: (g: GoalView) => setDiscard(g) };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[14px] text-[#cdc6b6]">{active.length} de {catalog?.maxActiveGoals ?? 3} objetivos activos</p>
        {active.length < (catalog?.maxActiveGoals ?? 3) && (
          <Button asChild className={cn('min-h-[44px] rounded-xl font-bold', BTN_FILL)}>
            <Link to={`/app/admin/pacientes/${patientId}/objetivos/nuevo`}><Plus aria-hidden="true" />Proponer objetivo</Link>
          </Button>
        )}
      </div>

      {active.length === 0 && closed.length === 0 && (
        <EmptyGuide icon={Target} title="Sin objetivos todavía" description="El paciente aún no definió qué quiere mejorar. Puedes proponer uno y seguirlo con sus mismos registros." />
      )}

      {active.map((g) => (
        <GoalCard key={g.id} goal={g} category={category(g)} sources={sources} variant={g.slot === 1 ? 'primary' : 'secondary'} staff={staff} onCheckin={(goal, indicator) => setCheckin({ goal, indicator })} onPause={(goal) => act(goal, 'pause')} />
      ))}

      {closed.length > 0 && (
        <section aria-label="Objetivos pausados, conseguidos y descartados" className="space-y-2">
          <button type="button" aria-expanded={showClosed} onClick={() => setShowClosed((v) => !v)} className="flex min-h-[48px] w-full items-center justify-between gap-2 rounded-xl px-1 text-left text-base font-bold text-[#fff8e4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#fff8e4]">
            Pausados, conseguidos y descartados ({closed.length})
            <ChevronDown aria-hidden="true" className={cn('h-5 w-5 text-[#a8a295] transition-transform motion-reduce:transition-none', showClosed && 'rotate-180')} />
          </button>
          {showClosed && (
            <ul className="space-y-2">
              {closed.map((g) => (
                <li key={g.id} className={cn(CARD, 'flex items-center justify-between gap-3 p-3.5')}>
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#fff8e4]/15 text-[#cdc6b6]"><GoalIcon name={g.icon} className="h-4 w-4" /></span>
                    <div className="min-w-0">
                      <p className="truncate text-[14.5px] font-semibold text-[#fff8e4]">{paramsText(g.progress.indicators[0], category(g), sources) || g.categoryName}</p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-2">
                        {g.status === 'discarded' ? <span className="text-[12px] text-[#a8a295]">Descartado{g.discardReason ? `: ${g.discardReason}` : ''}</span> : <StatusPill goal={g} audience="staff" />}
                      </div>
                    </div>
                  </div>
                  {g.status === 'paused' && <Button type="button" variant="outline" onClick={() => act(g, 'resume')} className="min-h-[44px] shrink-0 rounded-xl border-[#398ca2] bg-transparent text-[#fff8e4] hover:bg-[#398ca2]/15 hover:text-[#fff8e4]">Reanudar</Button>}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {sheet && <TargetSheet goal={sheet.goal} category={category(sheet.goal)} mode={sheet.kind} onClose={() => setSheet(null)} onSaved={replace} />}
      {checkin && <CheckinSheet staff goal={checkin.goal} indicator={checkin.indicator} category={category(checkin.goal)} onClose={() => setCheckin(null)} onSaved={replace} />}
      {discard && (
        <BottomSheet open onOpenChange={(open) => { if (!open) { setDiscard(null); setReason(''); } }} title="Descartar objetivo" description={`${discard.categoryName}: el historial se conserva`}>
          <div className="space-y-3 pb-2">
            <label htmlFor="discard-reason" className="text-[13.5px] font-medium text-[#fff8e4]">Motivo (obligatorio)</label>
            <Textarea id="discard-reason" rows={3} maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} className="border-[#fff8e4]/20 bg-[#fff8e4]/[0.05] text-[#fff8e4]" />
            <Button type="button" onClick={confirmDiscard} disabled={busy} className={cn('min-h-[48px] w-full rounded-2xl text-base font-bold', BTN_FILL)}>{busy ? 'Descartando…' : 'Descartar objetivo'}</Button>
          </div>
        </BottomSheet>
      )}
    </div>
  );
};

export default PatientGoalsTab;
