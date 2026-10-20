import { addMonths, format } from 'date-fns';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface StartDateFieldProps {
  id: string;
  value: string; // 'YYYY-MM-DD'
  onChange: (date: string) => void;
}

// «Fecha de ingreso / inicio del plan»: hoy por defecto; se elige otra para quienes pagan de fecha a fecha. Se puede cambiar después desde Planes.
const StartDateField = ({ id, value, onChange }: StartDateFieldProps) => (
  <div className="space-y-1.5">
    <Label htmlFor={id}>Fecha de ingreso (inicio del plan)</Label>
    <Input
      id={id}
      type="date"
      value={value}
      min={format(addMonths(new Date(), -12), 'yyyy-MM-dd')}
      max={format(addMonths(new Date(), 3), 'yyyy-MM-dd')}
      onChange={(e) => onChange(e.target.value)}
      className="w-44"
    />
    <p className="text-xs text-muted-foreground">
      El plan cuenta desde este día. Para quienes pagan de fecha a fecha, elige el día en que pagaron. Se puede cambiar después desde Planes.
    </p>
  </div>
);

export default StartDateField;
