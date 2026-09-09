import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loader2, Sparkles, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';
import { wellnessService } from '@/services/wellnessService';
import { getWhatsAppUrl } from '@/config/contact';
import type { WellnessCheckin, CreateWellnessCheckinData } from '@/types';

interface WellnessCheckinCardProps {
  hasActivePlan: boolean;
}

// Las 5 métricas usan la misma dirección 1=mal, 5=bien — el texto de estrés y
// dolor se pregunta al revés ("qué tan tranquilo/libre de dolor") para que el
// promedio simple sirva de alerta sin invertir nada al guardarlo.
const SLIDERS: Array<{ key: keyof CreateWellnessCheckinData; label: string; low: string; high: string }> = [
  { key: 'sleep', label: 'Sueño', low: 'Dormí mal', high: 'Dormí muy bien' },
  { key: 'energy', label: 'Energía', low: 'Sin energía', high: 'Con mucha energía' },
  { key: 'stress', label: 'Tranquilidad', low: 'Muy estresado', high: 'Muy tranquilo' },
  { key: 'soreness', label: 'Cuerpo', low: 'Mucho dolor', high: 'Sin dolor' },
  { key: 'mood', label: 'Ánimo', low: 'Ánimo bajo', high: 'Ánimo alto' },
];

const SUMMARY_LABELS: Record<keyof CreateWellnessCheckinData, string> = {
  sleep: 'Sueño', energy: 'Energía', stress: 'Tranquilidad', soreness: 'Cuerpo', mood: 'Ánimo', notes: '',
};

const WellnessCheckinCard = ({ hasActivePlan }: WellnessCheckinCardProps) => {
  const [checkin, setCheckin] = useState<WellnessCheckin | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<CreateWellnessCheckinData>({
    sleep: 3, energy: 3, stress: 3, soreness: 3, mood: 3, notes: '',
  });

  useEffect(() => {
    wellnessService.getToday()
      .then(setCheckin)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSliderChange = (key: keyof CreateWellnessCheckinData, value: number[]) => {
    setForm((prev) => ({ ...prev, [key]: value[0] }));
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const created = await wellnessService.create(form);
      setCheckin(created);
      toast.success('¡Check-in registrado! Gracias por contarnos cómo estás.');
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      toast.error(error.response?.data?.message || 'Error al registrar el check-in');
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

  return (
    <Card className="border-2 border-secondary/30 bg-secondary/5">
      <CardHeader className="flex flex-row items-center gap-2 pb-2">
        <Sparkles className="h-4 w-4 text-teal-600" />
        <CardTitle className="text-base font-semibold">¿Cómo te sientes hoy?</CardTitle>
      </CardHeader>
      <CardContent>
        {checkin ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Ya registraste tu check-in de hoy. ¡Gracias!</p>
            <div className="grid grid-cols-5 gap-2 text-center">
              {(Object.keys(SUMMARY_LABELS) as Array<keyof CreateWellnessCheckinData>)
                .filter((key) => key !== 'notes')
                .map((key) => (
                  <div key={key}>
                    <p className="text-lg font-bold text-teal-600">{checkin[key]}/5</p>
                    <p className="text-[11px] text-muted-foreground">{SUMMARY_LABELS[key]}</p>
                  </div>
                ))}
            </div>
            {checkin.notes && (
              <p className="text-sm text-muted-foreground italic">"{checkin.notes}"</p>
            )}
          </div>
        ) : !hasActivePlan ? (
          <div className="space-y-3">
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
          </div>
        ) : (
          <div className="space-y-4">
            {SLIDERS.map(({ key, label, low, high }) => (
              <div key={key} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">{label}</Label>
                  <span className="text-sm font-semibold text-teal-600">{form[key]}/5</span>
                </div>
                <Slider
                  value={[form[key] as number]}
                  onValueChange={(v) => handleSliderChange(key, v)}
                  min={1}
                  max={5}
                  step={1}
                />
                <div className="flex justify-between text-[11px] text-muted-foreground">
                  <span>{low}</span>
                  <span>{high}</span>
                </div>
              </div>
            ))}

            <div className="space-y-1.5">
              <Label className="text-sm">Notas (opcional)</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                placeholder="¿Algo más que quieras contarnos?"
                rows={2}
              />
            </div>

            <Button onClick={handleSubmit} disabled={submitting} className="w-full">
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Guardar check-in
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default WellnessCheckinCard;
