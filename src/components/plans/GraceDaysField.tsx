import { addDays, addMonths, endOfMonth, format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export const DEFAULT_GRACE_DAYS = 5;
export const MAX_GRACE_DAYS = 30;

interface GraceDaysFieldProps {
  id: string;
  value: number;
  onChange: (days: number) => void;
  billingCycle: 'calendar' | 'rolling';
  // Desde cuándo cuenta el plan (por defecto, hoy)
  from?: Date;
}

// Último día para pagar la renovación si el plan que empieza en `from` se renueva (solo para el ejemplo en pantalla)
function exampleDeadline(from: Date, billingCycle: 'calendar' | 'rolling', graceDays: number): Date {
  const nextCycleStart = billingCycle === 'rolling' ? addMonths(from, 1) : addDays(endOfMonth(from), 1);
  return addDays(nextCycleStart, Math.max(graceDays - 1, 0));
}

// «Plazo para pagar la renovación»: cuántos días tiene el paciente, desde que empieza el ciclo nuevo, para pagar
const GraceDaysField = ({ id, value, onChange, billingCycle, from = new Date() }: GraceDaysFieldProps) => {
  const valid = Number.isInteger(value) && value >= 0 && value <= MAX_GRACE_DAYS;
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>Plazo para pagar la renovación (días)</Label>
      <Input
        id={id}
        type="number"
        inputMode="numeric"
        min={0}
        max={MAX_GRACE_DAYS}
        value={Number.isNaN(value) ? '' : value}
        onChange={(e) => onChange(e.target.value === '' ? Number.NaN : Number(e.target.value))}
        className="w-28"
      />
      <p className="text-xs text-muted-foreground">
        {valid
          ? <>Cuando empiece el ciclo nuevo, tendrá {value} {value === 1 ? 'día' : 'días'} para pagar y podrá seguir agendando hasta entonces
            {' '}(por ejemplo, con esta fecha: hasta el {format(exampleDeadline(from, billingCycle, value), "d 'de' MMMM", { locale: es })}). Lo normal son {DEFAULT_GRACE_DAYS}.</>
          : <>Escribe un número de días entre 0 y {MAX_GRACE_DAYS}.</>}
      </p>
    </div>
  );
};

export default GraceDaysField;
