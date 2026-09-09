import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { wellnessService } from '@/services/wellnessService';
import WellnessTrendChart from '@/components/charts/WellnessTrendChart';
import type { WellnessCheckin } from '@/types';

interface WellnessHistoryTabProps {
  patientId: string;
}

const WellnessHistoryTab = ({ patientId }: WellnessHistoryTabProps) => {
  const [checkins, setCheckins] = useState<WellnessCheckin[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    wellnessService.getPatientCheckins(patientId)
      .then(setCheckins)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [patientId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (checkins.length === 0) {
    return <p className="text-muted-foreground text-sm">Este paciente todavía no tiene check-ins de bienestar registrados</p>;
  }

  return (
    <div className="space-y-4">
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
            const average = (checkin.sleep + checkin.energy + checkin.stress + checkin.soreness + checkin.mood) / 5;
            return (
              <div key={checkin._id} className="flex items-center justify-between p-3 rounded-lg border border-border">
                <div>
                  <p className="text-sm font-medium">
                    {format(parseISO(checkin.date), "d 'de' MMMM", { locale: es })}
                  </p>
                  {checkin.notes && (
                    <p className="text-xs text-muted-foreground mt-0.5 italic">"{checkin.notes}"</p>
                  )}
                </div>
                <span className={`text-sm font-semibold ${average < 2.5 ? 'text-red-500' : 'text-teal-600'}`}>
                  {average.toFixed(1)}/5
                </span>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
};

export default WellnessHistoryTab;
