import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  choiceLabel,
  sessionChoicesFor,
  UNLIMITED,
  type ServiceType,
  type SessionsChoice,
} from '@/config/planCatalog';

interface SessionsSelectProps {
  serviceType: ServiceType;
  value: SessionsChoice;
  onChange: (value: SessionsChoice) => void;
  className?: string;
  // Para enlazar con una <Label htmlFor>; si no hay etiqueta visible, se usa ariaLabel
  id?: string;
  ariaLabel?: string;
}

const SessionsSelect = ({ serviceType, value, onChange, className, id, ariaLabel = 'Sesiones por mes' }: SessionsSelectProps) => (
  <Select
    key={serviceType}
    value={String(value)}
    onValueChange={(v) => onChange(v === UNLIMITED ? UNLIMITED : Number(v))}
  >
    <SelectTrigger id={id} aria-label={id ? undefined : ariaLabel} className={className}><SelectValue /></SelectTrigger>
    <SelectContent>
      {sessionChoicesFor(serviceType).map((choice) => (
        <SelectItem key={choice} value={String(choice)}>{choiceLabel(choice)}</SelectItem>
      ))}
    </SelectContent>
  </Select>
);

export default SessionsSelect;
