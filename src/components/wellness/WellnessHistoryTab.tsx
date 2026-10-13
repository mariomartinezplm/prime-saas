import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { HeartPulse } from 'lucide-react';
import EmptyState from '@/components/shared/EmptyState';
import LoadErrorAlert from '@/components/shared/LoadErrorAlert';
import LoadingState from '@/components/shared/LoadingState';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { wellnessService } from '@/services/wellnessService';
import WellnessTrendChart from '@/components/charts/WellnessTrendChart';
import ReadinessBars from './ReadinessBars';
import { STATUS_STYLES, formatScore } from './readinessConfig';
import type { WellnessCheckin } from '@/types';

interface WellnessHistoryTabProps {
  patientId: string;
}

const WellnessHistoryTab = ({ patientId }: WellnessHistoryTabProps) => {
  const [checkins, setCheckins] = useState<WellnessCheckin[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setFailed(false);
    wellnessService.getPatientCheckins(patientId)
      .then(setCheckins)
      // Un fallo de carga no debe verse como "no hay check-ins"
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  }, [patientId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <LoadingState label="Cargando bienestar…" className="py-8" />;

  if (failed) return <LoadErrorAlert message="No se pudo cargar el historial de bienestar." onRetry={load} />;

  if (checkins.length === 0) {
    return (
      <EmptyState
        icon={HeartPulse}
        title="Todavía no hay check-ins de bienestar"
        description="Cuando el paciente complete su check-in diario, verás aquí su evolución."
      />
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-lg">Readiness por día</CardTitle></CardHeader>
        <CardContent>
          <ReadinessBars checkins={checkins} days={14} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg">Tendencia</CardTitle></CardHeader>
        <CardContent>
          <WellnessTrendChart checkins={checkins} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg">Historial ({checkins.length})</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {checkins.map((checkin) => {
            const style = STATUS_STYLES[checkin.readiness.status];
            const flagged = checkin.readiness.flags.length > 0;
            return (
              <div key={checkin._id} className={`flex items-center justify-between rounded-lg border border-l-4 border-border p-3 ${style.border}`}>
                <div>
                  <p className="text-sm font-medium">
                    {format(parseISO(checkin.date), "d 'de' MMMM", { locale: es })}
                  </p>
                  {flagged && (
                    <p className="text-xs text-warning mt-0.5">Respuesta muy baja en una pregunta</p>
                  )}
                  {checkin.notes && (
                    <p className="text-xs text-muted-foreground mt-0.5 italic">"{checkin.notes}"</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${style.badge}`}>{style.label}</span>
                  <span className={`text-sm font-semibold ${style.text}`}>{formatScore(checkin.readiness.score)}/9</span>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
};

export default WellnessHistoryTab;
