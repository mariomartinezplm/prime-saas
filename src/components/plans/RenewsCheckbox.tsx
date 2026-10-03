import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

interface RenewsCheckboxProps {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  // Versión corta para filas de listas
  compact?: boolean;
}

// "Se renueva": si está marcada, al terminar el plan se abre solo la renovación
// pendiente de pago (hasta 5 días para pagar). Desmarcada = plan puntual: vence sin más.
const RenewsCheckbox = ({ id, checked, onChange, compact }: RenewsCheckboxProps) => (
  <div className="flex items-start gap-2">
    <Checkbox id={id} checked={checked} onCheckedChange={(value) => onChange(value === true)} className="mt-0.5" />
    <div className="space-y-0.5">
      <Label htmlFor={id} className="cursor-pointer">Se renueva cada mes</Label>
      {!compact && (
        <p className="text-xs text-muted-foreground">
          Desmárcala para planes puntuales (por ejemplo, 1 sesión): al terminar, el plan vence
          sin abrir una renovación pendiente de pago.
        </p>
      )}
    </div>
  </div>
);

export default RenewsCheckbox;
