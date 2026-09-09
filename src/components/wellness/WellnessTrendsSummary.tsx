import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { HeartPulse, Loader2 } from 'lucide-react';
import { wellnessService } from '@/services/wellnessService';
import type { WellnessTrend } from '@/types';

const WellnessTrendsSummary = () => {
  const navigate = useNavigate();
  const [trends, setTrends] = useState<WellnessTrend[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    wellnessService.getTrends()
      .then(setTrends)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-2">
        <HeartPulse className="h-4 w-4 text-muted-foreground" />
        <CardTitle className="text-lg">Bienestar de pacientes (últimos 7 días)</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : trends.length === 0 ? (
          <p className="text-muted-foreground text-sm">Nadie ha registrado un check-in esta semana todavía</p>
        ) : (
          <div className="space-y-2">
            {trends.map((trend) => (
              <button
                key={trend.patient._id}
                onClick={() => navigate(`/app/admin/pacientes/${trend.patient._id}`)}
                className={`w-full flex items-center justify-between p-3 rounded-lg border text-left transition-colors hover:bg-secondary/10 ${
                  trend.isLowAlert ? 'border-l-4 border-l-red-500 bg-red-500/5' : 'border-border'
                }`}
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
                  {trend.isLowAlert && (
                    <Badge className="bg-red-500/20 text-red-400">Requiere atención</Badge>
                  )}
                  <span className="text-sm font-semibold">
                    {trend.weeklyAverage?.toFixed(1)}/5
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default WellnessTrendsSummary;
