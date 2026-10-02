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
}

const SessionsSelect = ({ serviceType, value, onChange, className }: SessionsSelectProps) => (
  <Select
    key={serviceType}
    value={String(value)}
    onValueChange={(v) => onChange(v === UNLIMITED ? UNLIMITED : Number(v))}
  >
    <SelectTrigger className={className}><SelectValue /></SelectTrigger>
    <SelectContent>
      {sessionChoicesFor(serviceType).map((choice) => (
        <SelectItem key={choice} value={String(choice)}>{choiceLabel(choice)}</SelectItem>
      ))}
    </SelectContent>
  </Select>
);

export default SessionsSelect;
