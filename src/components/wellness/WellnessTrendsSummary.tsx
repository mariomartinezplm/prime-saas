import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { HeartPulse } from 'lucide-react';
import LoadErrorAlert from '@/components/shared/LoadErrorAlert';
import LoadingState from '@/components/shared/LoadingState';
import { wellnessService } from '@/services/wellnessService';
import { STATUS_STYLES, formatScore } from './readinessConfig';
import type { WellnessTrend } from '@/types';

const WellnessTrendsSummary = () => {
  const navigate = useNavigate();
  const [trends, setTrends] = useState<WellnessTrend[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setFailed(false);
    wellnessService.getTrends()
      .then(setTrends)
      // Un fallo de carga no debe verse como "nadie ha registrado nada"
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-2">
        <HeartPulse className="h-4 w-4 text-muted-foreground" />
        <CardTitle className="text-lg">Readiness de pacientes (últimos 7 días)</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <LoadingState label="Cargando bienestar…" className="py-8" />
        ) : failed ? (
          <LoadErrorAlert message="No se pudo cargar el bienestar de los pacientes." onRetry={load} />
        ) : trends.length === 0 ? (
          <p className="text-muted-foreground text-sm">Nadie ha registrado un check-in esta semana todavía</p>
        ) : (
          <div className="space-y-2">
            {trends.map((trend) => {
              const style = trend.weeklyStatus ? STATUS_STYLES[trend.weeklyStatus] : null;
              return (
              <button
                key={trend.patient._id}
                onClick={() => navigate(`/app/admin/pacientes/${trend.patient._id}`)}
                className={`w-full flex items-center justify-between p-3 rounded-lg border border-border text-left transition-colors hover:bg-secondary/10 ${
                  style ? `border-l-4 ${style.border}` : ''
                } ${trend.isLowAlert ? 'bg-destructive/5' : ''}`}
              >
                <div>
                  <p className="font-medium text-sm">
                    {trend.patient.firstName} {trend.patient.lastName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {trend.checkinsThisWeek} check-in(s) esta semana
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {style && (
                    <Badge className={`border ${style.badge}`}>
                      {trend.isLowAlert ? 'Requiere atención' : style.label}
                    </Badge>
                  )}
                  <span className={`text-sm font-semibold ${style?.text ?? ''}`}>
                    {trend.weeklyAverage !== null ? formatScore(trend.weeklyAverage) : '-'}/9
                  </span>
                </div>
              </button>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default WellnessTrendsSummary;
