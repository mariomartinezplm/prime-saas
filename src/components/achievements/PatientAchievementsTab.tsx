import { useCallback, useEffect, useRef, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { PauseCircle, Trash2, Trophy } from 'lucide-react';
import { achievementApi, type AchievementHistoryEntry, type BodyGoalDirection, type PatientAchievements, type WeeklyGoal } from '@/services/achievementService';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import BodyGoalForm from './BodyGoalForm';
import { FormField } from '@/components/forms/FormField';
import SubmitButton from '@/components/forms/SubmitButton';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import EmptyState from '@/components/shared/EmptyState';
import LoadErrorAlert from '@/components/shared/LoadErrorAlert';
import LoadingState from '@/components/shared/LoadingState';
import { useUnsavedChangesWarning } from '@/hooks/useUnsavedChangesWarning';
import { showApiError } from '@/lib/apiError';
import { notify } from '@/lib/notify';
import { capitalizeFirst } from '@/lib/utils';
import { formatDay, formatNumber } from './format';

const STATUS_LABELS = {
  earned: 'Conseguido',
  in_progress: 'En curso',
  available: 'Disponible',
  locked: 'Bloqueado',
  pending: 'Pendiente',
} as const;

const monthLabel = (periodKey: string) => format(parseISO(`${periodKey}-01`), "MMMM 'de' yyyy", { locale: es });
const isPeriodMonth = (periodKey: string) => /^\d{4}-\d{2}$/.test(periodKey);

interface PatientAchievementsTabProps {
  patientId: string;
}

// Vista del personal: qué logros tiene la persona, con qué datos se respaldaron, y los dos ajustes que el
// personal puede hacer (pausas autorizadas y meta de peso). Nada se borra: una corrección deja el logro "en revisión".
const PatientAchievementsTab = ({ patientId }: PatientAchievementsTabProps) => {
  const [data, setData] = useState<PatientAchievements | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setFailed(false);
    achievementApi
      .getForPatient(patientId)
      .then(setData)
      // Un fallo de carga no debe verse como "todavía no tiene logros"
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  }, [patientId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading && !data) return <LoadingState label="Cargando logros…" className="py-8" />;
  // Sin datos que mostrar: el error ocupa la pestaña. Con datos (p. ej. falló solo el refresco tras guardar), se
  // conservan a la vista para no esconder lo recién guardado.
  if (!data) return <LoadErrorAlert message="No se pudieron cargar los logros del paciente." onRetry={load} />;

  return (
    <div className="space-y-4">
      {failed && <LoadErrorAlert message="No se pudo actualizar la información; lo que ves puede estar desactualizado." onRetry={load} />}
      <SummaryCard data={data} />
      <ProgressCard data={data} />
      <HistoryCard history={data.history} />
      <WeeklyGoalStaffCard patientId={patientId} weekly={data.weekly} onChanged={load} />
      <PausesCard patientId={patientId} pauses={data.pauses} onChanged={load} />
      <GoalCard patientId={patientId} goal={data.goal} onChanged={(goal) => setData((prev) => (prev ? { ...prev, goal } : prev))} />
    </div>
  );
};

const SummaryCard = ({ data }: { data: PatientAchievements }) => (
  <Card>
    <CardHeader>
      <CardTitle className="text-lg">Logros del paciente</CardTitle>
      <CardDescription>
        Son un reconocimiento a hábitos, no una evaluación clínica. El paciente solo ve los suyos; aquí ves además el respaldo de cada uno.
      </CardDescription>
    </CardHeader>
    <CardContent className="space-y-3">
      <p className="text-sm">
        <span className="text-2xl font-semibold tabular-nums">{data.summary.earned}</span>{' '}
        <span className="text-muted-foreground">{data.summary.earned === 1 ? 'logro conseguido' : 'logros conseguidos'}</span>
      </p>
      {data.reviewCount > 0 && (
        <Alert variant="warning">
          <AlertDescription>
            {data.reviewCount === 1 ? '1 logro quedó en revisión' : `${data.reviewCount} logros quedaron en revisión`}: los datos que lo respaldaban
            cambiaron (por ejemplo, una cita se corrigió). Sigue visible para el paciente; revisa el detalle en el historial.
          </AlertDescription>
        </Alert>
      )}
    </CardContent>
  </Card>
);

const ProgressCard = ({ data }: { data: PatientAchievements }) => (
  <Card>
    <CardHeader>
      <CardTitle className="text-lg">Progreso por categoría</CardTitle>
    </CardHeader>
    <CardContent className="space-y-5">
      {data.categories.map((category) => (
        <section key={category.key} aria-labelledby={`cat-${category.key}`} className="space-y-2">
          <h3 id={`cat-${category.key}`} className="text-sm font-semibold">
            {category.label}
          </h3>
          <ul className="divide-y divide-border rounded-lg border border-border">
            {category.items.map((item) => (
              <li key={item.key} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-3 py-2 text-sm">
                <span className="font-medium">{item.title}</span>
                <span className="text-xs text-muted-foreground">
                  {STATUS_LABELS[item.status]}
                  {item.progress && item.status !== 'locked' && item.status !== 'pending' && (
                    <>
                      {' · '}
                      {formatNumber(item.progress.current)} de {formatNumber(item.progress.target)} {item.progress.label}
                    </>
                  )}
                  {item.status === 'locked' && ' · sin meta de peso (opcional)'}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </CardContent>
  </Card>
);

const HistoryCard = ({ history }: { history: AchievementHistoryEntry[] }) => (
  <Card>
    <CardHeader>
      <CardTitle className="text-lg">Historial y respaldo</CardTitle>
    </CardHeader>
    <CardContent>
      {history.length === 0 ? (
        <EmptyState
          icon={Trophy}
          title="Todavía no hay logros"
          description="Aparecerán aquí cuando el paciente cumpla un reto, con los datos que lo respaldan."
          className="border-0 py-4"
        />
      ) : (
        <ol className="space-y-3">
          {history.map((entry) => {
            const underReview = entry.status === 'under_review';
            return (
              <li key={entry.id} className="space-y-1 rounded-lg border border-border p-3 text-sm">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <p className="font-medium">
                    {entry.title}
                    {isPeriodMonth(entry.periodKey) && <span className="font-normal text-muted-foreground"> · {monthLabel(entry.periodKey)}</span>}
                  </p>
                  <p className="text-xs text-muted-foreground">{formatDay(entry.awardedAt)}</p>
                </div>
                <p className="text-xs text-muted-foreground">
                  {entry.categoryLabel} · {entry.source === 'manual' ? 'otorgado manualmente' : 'otorgado automáticamente'}
                  {underReview && <span className="font-medium text-foreground"> · en revisión</span>}
                </p>
                {entry.evidence?.summary && <p className="text-xs">Respaldo: {entry.evidence.summary}</p>}
                {entry.detail && !entry.evidence?.summary && <p className="text-xs">{entry.detail}</p>}
                {entry.reason && <p className="text-xs">Motivo: {entry.reason}</p>}
                {underReview && entry.reviewNote && <p className="text-xs">Nota de revisión: {entry.reviewNote}</p>}
              </li>
            );
          })}
        </ol>
      )}
    </CardContent>
  </Card>
);

interface PausesCardProps {
  patientId: string;
  pauses: PatientAchievements['pauses'];
  onChanged: () => void;
}

const PausesCard = ({ patientId, pauses, onChanged }: PausesCardProps) => {
  const [month, setMonth] = useState('');
  const [reason, setReason] = useState('');
  const [monthError, setMonthError] = useState<string | undefined>();
  const [reasonError, setReasonError] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);
  const [toRemove, setToRemove] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const submittingRef = useRef(false);

  useUnsavedChangesWarning((month !== '' || reason.trim() !== '') && !saving);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingRef.current) return;
    const badMonth = isPeriodMonth(month) ? undefined : 'Elige el mes de la pausa';
    const badReason = reason.trim() ? undefined : 'Indica el motivo de la pausa';
    setMonthError(badMonth);
    setReasonError(badReason);
    if (badMonth || badReason) {
      requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
      return;
    }

    submittingRef.current = true;
    setSaving(true);
    try {
      await achievementApi.createPause(patientId, month, reason.trim());
      notify.success('Pausa autorizada guardada');
      setMonth('');
      setReason('');
      onChanged();
    } catch (err) {
      showApiError(err, 'No se pudo guardar la pausa');
    } finally {
      submittingRef.current = false;
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!toRemove) return;
    try {
      await achievementApi.deletePause(patientId, toRemove);
      notify.success('Pausa eliminada');
      setToRemove(null);
      onChanged();
    } catch (err) {
      // El diálogo queda abierto para poder reintentar
      showApiError(err, 'No se pudo eliminar la pausa');
      throw err;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Pausas autorizadas</CardTitle>
        <CardDescription>
          Un mes en pausa (lesión, vacaciones, motivos personales) no rompe ni suma a la racha de constancia. Quitarla puede dejar un logro en revisión.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {pauses.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay pausas autorizadas.</p>
        ) : (
          <ul className="space-y-2">
            {pauses.map((pause) => (
              <li key={pause._id} className="flex items-start justify-between gap-3 rounded-lg border border-border p-3 text-sm">
                <div className="min-w-0 space-y-0.5">
                  <p className="flex items-center gap-2 font-medium">
                    <PauseCircle className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    {capitalizeFirst(monthLabel(pause.periodKey))}
                  </p>
                  <p className="break-words text-xs text-muted-foreground">{pause.reason}</p>
                  {pause.createdBy && (
                    <p className="text-xs text-muted-foreground">
                      Registrada por {pause.createdBy.firstName} {pause.createdBy.lastName}
                    </p>
                  )}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Quitar la pausa de ${monthLabel(pause.periodKey)}`}
                  onClick={() => setToRemove(pause.periodKey)}
                >
                  <Trash2 aria-hidden="true" />
                </Button>
              </li>
            ))}
          </ul>
        )}

        <form ref={formRef} onSubmit={submit} noValidate className="space-y-3 border-t border-border pt-4">
          <p className="text-sm font-medium">Autorizar una pausa</p>
          <div className="grid gap-3 sm:grid-cols-[12rem_1fr]">
            <FormField label="Mes" required error={monthError}>
              {(c) => (
                <Input
                  {...c}
                  type="month"
                  value={month}
                  disabled={saving}
                  onChange={(e) => {
                    setMonth(e.target.value);
                    setMonthError(undefined);
                  }}
                />
              )}
            </FormField>
            <FormField label="Motivo" required error={reasonError}>
              {(c) => (
                <Input
                  {...c}
                  value={reason}
                  maxLength={300}
                  disabled={saving}
                  placeholder="Ej: lesión de rodilla, vacaciones"
                  onChange={(e) => {
                    setReason(e.target.value);
                    setReasonError(undefined);
                  }}
                />
              )}
            </FormField>
          </div>
          <SubmitButton loading={saving} loadingLabel="Guardando…">
            Autorizar pausa
          </SubmitButton>
        </form>
      </CardContent>

      <ConfirmDialog
        open={toRemove !== null}
        onOpenChange={(open) => !open && setToRemove(null)}
        title="¿Quitar esta pausa?"
        description={
          toRemove
            ? `${capitalizeFirst(monthLabel(toRemove))} volverá a contar para la racha de constancia. Si ya se había concedido una racha apoyada en este mes, quedará en revisión (no se borra).`
            : undefined
        }
        confirmLabel="Quitar pausa"
        destructive
        onConfirm={remove}
      />
    </Card>
  );
};

interface GoalCardProps {
  patientId: string;
  goal: PatientAchievements['goal'];
  onChanged: (goal: PatientAchievements['goal']) => void;
}

const GoalCard = ({ patientId, goal, onChanged }: GoalCardProps) => {
  const change = async (changes: { direction?: BodyGoalDirection | null; targetKg?: number | null; enabled?: boolean }, message: string) => {
    try {
      onChanged(await achievementApi.updatePatientBodyGoal(patientId, changes));
      notify.success(message);
    } catch (err) {
      showApiError(err, 'No se pudo guardar la meta');
      throw err;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Meta de peso</CardTitle>
        <CardDescription>
          Solo si el peso es un objetivo del paciente: él o ella elige bajar o subir y cuántos kg (también puede hacerlo en su Configuración). Sin meta no
          existe ningún trofeo de peso. Se concede al confirmarlo con dos mediciones separadas por al menos 14 días.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <BodyGoalForm
          goal={goal}
          audience="staff"
          idPrefix="patient-body-goal"
          onSave={({ direction, targetKg }) => change({ direction, targetKg }, direction === null ? 'Meta quitada' : 'Meta guardada')}
          onToggleEnabled={(enabled) => change({ enabled }, enabled ? 'Reconocimientos activados' : 'Reconocimientos desactivados')}
        />
      </CardContent>
    </Card>
  );
};

interface WeeklyGoalStaffCardProps {
  patientId: string;
  weekly?: WeeklyGoal;
  onChanged: () => void;
}

// Objetivo semanal de entrenamiento: por defecto sesiones del plan ÷ 4; el profesional puede fijar otro número (1 a 7)
const WeeklyGoalStaffCard = ({ patientId, weekly, onChanged }: WeeklyGoalStaffCardProps) => {
  const [saving, setSaving] = useState(false);
  if (!weekly) return null;

  const save = async (sessions: number | null) => {
    if (saving) return;
    setSaving(true);
    try {
      await achievementApi.updatePatientWeeklyGoal(patientId, sessions);
      notify.success(sessions === null ? 'Objetivo semanal por defecto' : 'Objetivo semanal guardado');
      onChanged();
    } catch (err) {
      showApiError(err, 'No se pudo guardar el objetivo semanal');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Objetivo semanal de entrenamiento</CardTitle>
        <CardDescription>
          Por defecto son las sesiones del plan del mes divididas en 4 semanas (8 al mes = 2 por semana). Puedes fijar otro número para este paciente; nunca
          supera las sesiones de su plan. No aplica a planes ilimitados ni de kinesiología, y se oculta en los meses con pausa autorizada.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {weekly.state === 'active' ? (
          <>
            <p className="text-sm">
              Objetivo actual: <strong>{weekly.target}</strong> {weekly.target === 1 ? 'sesión' : 'sesiones'} por semana
              {weekly.source === 'professional' ? ' (fijado por el profesional)' : ` (por defecto del plan)`}.
            </p>
            <div role="group" aria-label="Sesiones por semana" className="flex flex-wrap gap-2">
              {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                <Button key={n} type="button" size="sm" variant={weekly.target === n && weekly.source === 'professional' ? 'default' : 'outline'} disabled={saving} aria-pressed={weekly.target === n && weekly.source === 'professional'} onClick={() => save(n)} className="min-h-[44px] min-w-[44px]">
                  {n}
                </Button>
              ))}
            </div>
            {weekly.source === 'professional' && (
              <Button type="button" variant="ghost" size="sm" disabled={saving} onClick={() => save(null)}>
                Volver al valor por defecto ({weekly.defaultTarget})
              </Button>
            )}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            {weekly.state === 'paused' ? 'Este mes tiene una pausa autorizada: el objetivo semanal está oculto para el paciente.' : 'Sin objetivo semanal: el paciente no tiene un plan de entrenamiento vigente con sesiones definidas.'}
          </p>
        )}
      </CardContent>
    </Card>
  );
};

export default PatientAchievementsTab;
