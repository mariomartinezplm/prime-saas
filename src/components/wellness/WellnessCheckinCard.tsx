import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ArrowLeft, CircleCheck, Sparkles, MessageCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { wellnessService } from '@/services/wellnessService';
import { getErrorMessage, showApiError } from '@/lib/apiError';
import { notify } from '@/lib/notify';
import { getWhatsAppUrl } from '@/config/contact';
import LoadErrorAlert from '@/components/shared/LoadErrorAlert';
import SubmitButton from '@/components/forms/SubmitButton';
import { useUnsavedChangesWarning } from '@/hooks/useUnsavedChangesWarning';
import ReadinessBars from './ReadinessBars';
import { readinessStatusOf, type ReadinessTodayStatus } from './readinessStatus';
import { RESERVED, SkeletonBones } from '@/components/dashboard/CardSkeleton';
import { HERO_SURFACE } from '@/components/dashboard/brand';
import { cn } from '@/lib/utils';
import { withTimeout } from '@/lib/withTimeout';
import { READINESS_QUESTIONS, METRIC_LABELS, STATUS_STYLES, formatScore } from './readinessConfig';
import type { WellnessCheckin, ReadinessKey } from '@/types';

interface WellnessCheckinCardProps {
  hasActivePlan: boolean;
  // Avisa si falta o ya se hizo el Readiness de hoy (el dashboard lo usa para «Para hoy»). Opcional: sin él, la tarjeta funciona igual.
  onStatusChange?: (status: ReadinessTodayStatus) => void;
  // Si el plan todavía se está consultando no se decide qué mostrar (se conserva el espacio); si la consulta falló NO se afirma que el plan
  // venció: se dice que no se pudo comprobar. Por defecto, el plan se da por conocido.
  planStatus?: 'loading' | 'ready' | 'error';
  onRetryPlan?: () => void;
  // Dashboard B: la pantalla de inicio es una fila compacta (no una tarjeta grande) y, sin plan vigente, no se muestra (la tarjeta protagonista ya lo dice)
  compact?: boolean;
}

const TOTAL = READINESS_QUESTIONS.length;
const NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

const WellnessCheckinCard = ({ hasActivePlan, onStatusChange, planStatus = 'ready', onRetryPlan, compact = false }: WellnessCheckinCardProps) => {
  const { user } = useAuth();
  const [checkin, setCheckin] = useState<WellnessCheckin | null>(null);
  const [history, setHistory] = useState<WellnessCheckin[]>([]);
  const [loading, setLoading] = useState(true);
  // Si no se pudo saber si ya respondió hoy NO se muestra el cuestionario como si no lo hubiera hecho
  const [loadFailed, setLoadFailed] = useState(false);
  const [historyFailed, setHistoryFailed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  // null = pantalla de inicio; 0..TOTAL-1 = pregunta; TOTAL = notas
  const [step, setStep] = useState<number | null>(null);
  // Lo que la persona tocó en el teclado, sin invertir
  const [pressed, setPressed] = useState<Partial<Record<ReadinessKey, number>>>({});
  const [notes, setNotes] = useState('');
  // Verdadero solo si ESTA persona acaba de guardar y el servidor lo confirmó (no al abrir la app con el check-in ya hecho)
  const [justSaved, setJustSaved] = useState(false);
  const confirmRef = useRef<HTMLParagraphElement | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);
  // Si el guardado falla, el foco vuelve al botón (al quedar bloqueado «Guardando…» el navegador lo suelta)
  const refocusSubmit = useRef(false);
  // Aviso de error del último intento: al reintentar se retira (así no queda un «error» viejo en pantalla junto al resultado nuevo)
  const errorToastId = useRef<string | null>(null);

  const loadHistory = useCallback(() => {
    if (!user) return;
    setHistoryFailed(false);
    wellnessService.getPatientCheckins(user.id).then(setHistory).catch(() => setHistoryFailed(true));
  }, [user]);

  const loadToday = useCallback(() => {
    setLoading(true);
    setLoadFailed(false);
    // Si el servidor no responde nunca, la tarjeta pasa a «no pudimos comprobar» con su «Reintentar» en vez de esperar sin fin
    withTimeout(wellnessService.getToday())
      .then((today) => {
        setCheckin(today);
        if (today) loadHistory();
      })
      .catch(() => setLoadFailed(true))
      .finally(() => setLoading(false));
  }, [loadHistory]);

  useEffect(() => {
    loadToday();
  }, [loadToday]);

  // Comunica el estado que la tarjeta ya conoce (sin pedirlo otra vez): al cargar, al fallar, al reintentar y al completar
  useEffect(() => {
    onStatusChange?.(readinessStatusOf({ loading, loadFailed, checkin }));
  }, [loading, loadFailed, checkin, onStatusChange]);

  const handlePress = (value: number) => {
    if (step === null || step >= TOTAL) return;
    setPressed((prev) => ({ ...prev, [READINESS_QUESTIONS[step].key]: value }));
    setStep(step + 1);
  };

  // Un check-in a medio responder se pierde si se sale: se pregunta antes
  useUnsavedChangesWarning(step !== null && !checkin && !submitting);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    if (errorToastId.current) notify.dismiss(errorToastId.current);
    try {
      // Fatiga, dolor y estrés se guardan invertidos: en la base 9 siempre es "bien"
      const answers = Object.fromEntries(
        READINESS_QUESTIONS.map((q) => [q.key, q.invert ? 10 - (pressed[q.key] ?? 5) : (pressed[q.key] ?? 5)])
      ) as Record<ReadinessKey, number>;

      const created = await wellnessService.create({ ...answers, notes: notes.trim() || undefined });
      setCheckin(created);
      setStep(null);
      setJustSaved(true);
      loadHistory();
    } catch (err: unknown) {
      // Las respuestas y las notas se conservan: la persona puede reintentar sin volver a empezar
      refocusSubmit.current = true;
      errorToastId.current = `error:${getErrorMessage(err, 'Error al registrar el check-in')}`;
      showApiError(err, 'Error al registrar el check-in');
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  // Guardado confirmado: el botón de envío desaparece, así que el foco pasa a la confirmación (una sola vez, sin región «en vivo»
  // aparte: al recibir el foco, el lector de pantalla lee esa confirmación y no la repite)
  useEffect(() => {
    if (justSaved) confirmRef.current?.focus();
  }, [justSaved]);

  useEffect(() => {
    if (!submitting && refocusSubmit.current) {
      refocusSubmit.current = false;
      formRef.current?.querySelector<HTMLButtonElement>('button[type="submit"]')?.focus();
    }
  }, [submitting]);

  if (loading || planStatus === 'loading') {
    if (compact) {
      return (
        <div className="min-h-[4.75rem] rounded-2xl border border-[#fff8e4]/10 bg-[#fff8e4]/[0.04] p-4">
          <SkeletonBones label="Cargando tu Readiness" lines={[45, 30]} />
        </div>
      );
    }
    // Mismo espacio que la tarjeta ya cargada: al llegar el dato nada se desplaza
    return (
      <Card className={RESERVED.readiness}>
        <CardContent className="pt-6">
          <SkeletonBones label="Cargando tu Readiness" lines={[40, 100, 60]} />
        </CardContent>
      </Card>
    );
  }

  const header = (
    <CardHeader className="flex flex-row items-center gap-2 pb-2">
      <Sparkles className="h-4 w-4 text-secondary" />
      <CardTitle className="text-base font-semibold">Readiness de hoy</CardTitle>
    </CardHeader>
  );

  if (loadFailed) {
    return (
      <Card>
        {header}
        <CardContent>
          <LoadErrorAlert message="No pudimos comprobar tu check-in de hoy." onRetry={loadToday} />
        </CardContent>
      </Card>
    );
  }

  // --- Ya respondió hoy: resultado ---
  if (checkin) {
    const { readiness } = checkin;
    const style = STATUS_STYLES[readiness.status];
    const flagged = readiness.flags.map((k) => METRIC_LABELS[k]);

    return (
      <Card
        className={`border-2 border-secondary/30 bg-secondary/5 ${
          justSaved ? 'animate-in fade-in-0 slide-in-from-bottom-1 [animation-duration:220ms] motion-reduce:animate-none' : ''
        }`}
      >
        {header}
        <CardContent className="space-y-4">
          {justSaved && (
            <p
              ref={confirmRef}
              tabIndex={-1}
              className="flex w-fit max-w-full items-center gap-2 rounded-md text-sm font-medium text-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <CircleCheck className="h-4 w-4" aria-hidden="true" />
              Guardado. Tu Readiness de hoy quedó registrado.
              <span className="sr-only">
                {' '}
                Resultado: {formatScore(readiness.score)} de 9, {style.headline}.
              </span>
            </p>
          )}
          <div className="flex items-center gap-4">
            <p className={`text-5xl font-bold leading-none ${style.text}`}>{formatScore(readiness.score)}</p>
            <div className="space-y-1">
              <span className={`inline-block rounded-full border px-3 py-0.5 text-xs font-semibold ${style.badge}`}>
                {style.label} · {style.headline}
              </span>
              <p className="text-xs text-muted-foreground">Puntaje de 1 a 9</p>
            </div>
          </div>

          <p className="text-sm text-foreground">{readiness.message}</p>
          <p className="text-xs text-muted-foreground">
            Basado en lo que tú respondiste hoy: es un autorreporte, no una medición médica ni un diagnóstico.
          </p>
          {flagged.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Ojo con: {flagged.join(', ')}. Una respuesta muy baja no deja el semáforo en verde.
            </p>
          )}

          <div className="grid grid-cols-5 gap-2 text-center">
            {(Object.keys(METRIC_LABELS) as ReadinessKey[]).map((key) => (
              <div key={key}>
                <p className="text-lg font-bold text-secondary">{checkin[key]}</p>
                <p className="text-[11px] text-muted-foreground">{METRIC_LABELS[key]}</p>
              </div>
            ))}
          </div>

          {checkin.notes && <p className="text-sm text-muted-foreground italic">"{checkin.notes}"</p>}

          {historyFailed && <LoadErrorAlert message="No se pudieron cargar tus últimos días." onRetry={loadHistory} />}
          {history.length > 1 && (
            <div className="space-y-1 pt-2">
              <p className="text-xs font-medium text-muted-foreground">Tus últimos días</p>
              <ReadinessBars checkins={history} />
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // --- No se pudo comprobar el plan (no se afirma que venció) ---
  if (planStatus === 'error') {
    return (
      <Card>
        {header}
        <CardContent>
          <LoadErrorAlert message="No pudimos comprobar tu plan para tu Readiness." onRetry={() => onRetryPlan?.()} />
        </CardContent>
      </Card>
    );
  }

  // --- Plan vencido ---
  if (!hasActivePlan && compact) return null;
  if (!hasActivePlan) {
    return (
      <Card className={cn('rounded-[24px] border', HERO_SURFACE)}>
        {header}
        <CardContent className="space-y-3">
          <p className="text-sm font-medium text-[#fff8e4]/85">
            Para registrar tu check-in necesitas un plan activo. Contacta a Prime F&H para activarlo o renovarlo.
          </p>
          <Button
            className="bg-[#25D366] hover:bg-[#20BD5C] text-background"
            size="sm"
            onClick={() => window.open(getWhatsAppUrl('Hola, quiero renovar mi plan en Prime F&H'), '_blank')}
          >
            <MessageCircle className="h-4 w-4 mr-2" />
            Renovar por WhatsApp
          </Button>
        </CardContent>
      </Card>
    );
  }

  // --- Pantalla de inicio ---
  if (step === null && compact) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-[#fff8e4]/10 bg-[#fff8e4]/[0.04] p-3 pl-4">
        <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#398ca2]/45 bg-[#398ca2]/15 text-[#fff8e4]">
          <Sparkles className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold leading-tight text-[#fff8e4]">Readiness de hoy</p>
          <p className="hidden text-xs text-[#fff8e4]/70 min-[360px]:block">{TOTAL} preguntas · 1 min</p>
        </div>
        <Button
          variant="outline"
          className="min-h-11 shrink-0 border-[#398ca2] bg-transparent px-3 min-[360px]:px-4 text-[#fff8e4] hover:bg-[#398ca2]/15 hover:text-[#fff8e4]"
          onClick={() => { setPressed({}); setNotes(''); setStep(0); }}
        >
          Empezar
        </Button>
      </div>
    );
  }
  if (step === null) {
    return (
      <Card className={cn('rounded-[24px] border', HERO_SURFACE)}>
        {header}
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Responde {TOTAL} preguntas rápidas (menos de un minuto). Con eso calculamos tu Readiness y te
            decimos si hoy conviene entrenar normal, con precaución o recuperarte.
          </p>
          <Button className="w-full" onClick={() => { setPressed({}); setNotes(''); setStep(0); }}>
            Empezar
          </Button>
        </CardContent>
      </Card>
    );
  }

  // --- Última pantalla: notas y guardar ---
  if (step >= TOTAL) {
    return (
      <Card className={cn('rounded-[24px] border', HERO_SURFACE)}>
        {header}
        <CardContent>
         <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
          <Button type="button" variant="ghost" size="sm" className="-ml-2" onClick={() => setStep(TOTAL - 1)} disabled={submitting}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Atrás
          </Button>
          <div className="space-y-1.5">
            <Label htmlFor="checkin-notes" className="text-sm">¿Algo más que quieras contarnos? (opcional)</Label>
            <Textarea
              id="checkin-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={500}
              placeholder="Ej: me duele la rodilla izquierda al subir escaleras"
              rows={3}
            />
          </div>
          <SubmitButton loading={submitting} loadingLabel="Guardando…" className="w-full">
            Guardar y ver mi Readiness
          </SubmitButton>
         </form>
        </CardContent>
      </Card>
    );
  }

  // --- Una pregunta con teclado 1-9 ---
  const question = READINESS_QUESTIONS[step];
  const current = pressed[question.key];

  return (
    <Card className={cn('rounded-[24px] border', HERO_SURFACE)}>
      {header}
      <CardContent className="space-y-5">
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            className="-ml-2"
            onClick={() => setStep(step === 0 ? null : step - 1)}
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Atrás
          </Button>
          <div role="img" className="flex items-center gap-1.5" aria-label={`Pregunta ${step + 1} de ${TOTAL}`}>
            {READINESS_QUESTIONS.map((q, i) => (
              <span
                key={q.key}
                className={`h-1.5 w-6 rounded-full ${i <= step ? 'bg-[#398ca2]' : 'bg-[#fff8e4]/15'}`}
              />
            ))}
          </div>
        </div>

        <h3 className="text-center text-2xl font-extrabold leading-tight tracking-tight text-[#fff8e4]">{question.title}</h3>

        <div className="mx-auto grid max-w-xs grid-cols-3 gap-y-3">
          {NUMBERS.map((n) => (
            <div key={n} className="flex flex-col items-center">
              <button
                type="button"
                onClick={() => handlePress(n)}
                className={`flex h-16 w-full items-center justify-center rounded-2xl border text-4xl font-light transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#fff8e4] ${
                  current === n ? 'border-[#398ca2] bg-[#398ca2]/25 text-[#fff8e4]' : 'border-transparent text-[#fff8e4] hover:bg-[#fff8e4]/[0.06] active:bg-[#398ca2]/20'
                }`}
                aria-label={`${n}${n === 1 ? ` — ${question.atOne}` : n === 9 ? ` — ${question.atNine}` : ''}`}
              >
                {n}
              </button>
              <span className="mt-0.5 h-4 text-center text-[11px] leading-none text-muted-foreground">
                {n === 1 ? question.atOne : n === 9 ? question.atNine : ''}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default WellnessCheckinCard;
