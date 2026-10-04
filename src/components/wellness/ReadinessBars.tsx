import { format, parseISO } from 'date-fns';
import { STATUS_STYLES, formatScore } from './readinessConfig';
import type { WellnessCheckin } from '@/types';

interface ReadinessBarsProps {
  // Más reciente primero, como llega de la API
  checkins: WellnessCheckin[];
  days?: number;
}

// Una barra por día, del color de ese día. Altura según el puntaje (de 1 a 9).
const ReadinessBars = ({ checkins, days = 7 }: ReadinessBarsProps) => {
  const recent = checkins.slice(0, days).reverse();
  if (recent.length === 0) return null;

  return (
    <div>
      <div className="flex h-28 items-end gap-2">
        {recent.map((c) => {
          const style = STATUS_STYLES[c.readiness.status];
          return (
            <div key={c._id} className="flex flex-1 flex-col items-center justify-end gap-1">
              <span className="text-[11px] text-muted-foreground">{formatScore(c.readiness.score)}</span>
              <div
                className={`w-full rounded-t ${style.bar}`}
                style={{ height: `${(c.readiness.score / 9) * 80}px` }}
                title={`${format(parseISO(c.date), 'dd/MM')}: ${formatScore(c.readiness.score)} (${style.label})`}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-1 flex gap-2">
        {recent.map((c) => (
          <span key={c._id} className="flex-1 text-center text-[11px] text-muted-foreground">
            {format(parseISO(c.date), 'dd/MM')}
          </span>
        ))}
      </div>
    </div>
  );
};

export default ReadinessBars;
