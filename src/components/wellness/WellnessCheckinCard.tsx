import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Loader2, Sparkles, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { wellnessService } from '@/services/wellnessService';
import { showApiError } from '@/lib/apiError';
import { getWhatsAppUrl } from '@/config/contact';
import ReadinessBars from './ReadinessBars';
import { READINESS_QUESTIONS, METRIC_LABELS, STATUS_STYLES, formatScore } from './readinessConfig';
import type { WellnessCheckin, ReadinessKey } from '@/types';

interface WellnessCheckinCardProps {
  hasActivePlan: boolean;
}

const TOTAL = READINESS_QUESTIONS.length;
const NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

const WellnessCheckinCard = ({ hasActivePlan }: WellnessCheckinCardProps) => {
  const { user } = useAuth();
  const [checkin, setCheckin] = useState<WellnessCheckin | null>(null);
  const [history, setHistory] = useState<WellnessCheckin[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  // null = pantalla de inicio; 0..TOTAL-1 = pregunta; TOTAL = notas
  const [step, setStep] = useState<number | null>(null);
  // Lo que la persona tocó en el teclado, sin invertir
  const [pressed, setPressed] = useState<Partial<Record<ReadinessKey, number>>>({});
  const [notes, setNotes] = useState('');

  const loadHistory = useCallback(() => {
    if (!user) return;
    wellnessService.getPatientCheckins(user.id).then(setHistory).catch(() => {});
  }, [user]);

  useEffect(() => {
    wellnessService.getToday()
      .then((today) => {
        setCheckin(today);
        if (today) loadHistory();
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [loadHistory]);

  const handlePress = (value: number) => {
    if (step === null || step >= TOTAL) return;
    setPressed((prev) => ({ ...prev, [READINESS_QUESTIONS[step].key]: value }));
    setStep(step + 1);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      // Fatiga, dolor y estrés se guardan invertidos: en la base 9 siempre es "bien"
      const answers = Object.fromEntries(
        READINESS_QUESTIONS.map((q) => [q.key, q.invert ? 10 - (pressed[q.key] ?? 5) : (pressed[q.key] ?? 5)])
      ) as Record<ReadinessKey, number>;

      const created = await wellnessService.create({ ...answers, notes: notes.trim() || undefined });
      setCheckin(created);
      setStep(null);
      loadHistory();
      toast.success('¡Listo! Gracias por contarnos cómo estás.');
    } catch (err: unknown) {
      showApiError(err, 'Error al registrar el check-in');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const header = (
    <CardHeader className="flex flex-row items-center gap-2 pb-2">
      <Sparkles className="h-4 w-4 text-teal-600" />
      <CardTitle className="text-base font-semibold">Readiness de hoy</CardTitle>
    </CardHeader>
  );

  // --- Ya respondió hoy: resultado ---
  if (checkin) {
    const { readiness } = checkin;
    const style = STATUS_STYLES[readiness.status];
    const flagged = readiness.flags.map((k) => METRIC_LABELS[k]);

    return (
      <Card className="border-2 border-secondary/30 bg-secondary/5">
        {header}
        <CardContent className="space-y-4">
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
          {flagged.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Ojo con: {flagged.join(', ')}. Una respuesta muy baja no deja el semáforo en verde.
            </p>
          )}

          <div className="grid grid-cols-5 gap-2 text-center">
            {(Object.keys(METRIC_LABELS) as ReadinessKey[]).map((key) => (
              <div key={key}>
                <p className="text-lg font-bold text-teal-600">{checkin[key]}</p>
                <p className="text-[11px] text-muted-foreground">{METRIC_LABELS[key]}</p>
              </div>
            ))}
          </div>

          {checkin.notes && <p className="text-sm text-muted-foreground italic">"{checkin.notes}"</p>}

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

  // --- Plan vencido ---
  if (!hasActivePlan) {
    return (
      <Card className="border-2 border-secondary/30 bg-secondary/5">
        {header}
        <CardContent className="space-y-3">
          <p className="text-sm text-red-400 font-medium">
            Tu plan venció. Contacta a Prime F&H para renovar y poder registrar tu check-in.
          </p>
          <Button
            className="bg-[#25D366] hover:bg-[#20BD5C] text-white"
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
  if (step === null) {
    return (
      <Card className="border-2 border-secondary/30 bg-secondary/5">
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
      <Card className="border-2 border-secondary/30 bg-secondary/5">
        {header}
        <CardContent className="space-y-4">
          <Button variant="ghost" size="sm" className="-ml-2" onClick={() => setStep(TOTAL - 1)} disabled={submitting}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Atrás
          </Button>
          <div className="space-y-1.5">
            <Label className="text-sm">¿Algo más que quieras contarnos? (opcional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={500}
              placeholder="Ej: me duele la rodilla izquierda al subir escaleras"
              rows={3}
            />
          </div>
          <Button onClick={handleSubmit} disabled={submitting} className="w-full">
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Guardar y ver mi Readiness
          </Button>
        </CardContent>
      </Card>
    );
  }

  // --- Una pregunta con teclado 1-9 ---
  const question = READINESS_QUESTIONS[step];
  const current = pressed[question.key];

  return (
    <Card className="border-2 border-secondary/30 bg-secondary/5">
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
          <div className="flex items-center gap-1.5" aria-label={`Pregunta ${step + 1} de ${TOTAL}`}>
            {READINESS_QUESTIONS.map((q, i) => (
              <span
                key={q.key}
                className={`h-1.5 w-6 rounded-full ${i <= step ? 'bg-teal-500' : 'bg-muted'}`}
              />
            ))}
          </div>
        </div>

        <h3 className="text-center text-xl font-bold text-foreground">{question.title}</h3>

        <div className="mx-auto grid max-w-xs grid-cols-3 gap-y-3">
          {NUMBERS.map((n) => (
            <div key={n} className="flex flex-col items-center">
              <button
                type="button"
                onClick={() => handlePress(n)}
                className={`flex h-16 w-full items-center justify-center rounded-xl text-4xl font-light transition-colors hover:bg-secondary/20 active:bg-secondary/30 ${
                  current === n ? 'bg-teal-500/20 text-teal-400' : 'text-foreground'
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
