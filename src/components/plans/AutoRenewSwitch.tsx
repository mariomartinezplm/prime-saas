import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

interface AutoRenewSwitchProps {
  id: string;
  checked: boolean;
  onCheckedChange: (value: boolean) => void;
  disabled?: boolean;
  className?: string;
}

// «Renovación automática»: para quien paga todos los meses. Es una marca del PACIENTE (no del plan): se queda aunque cambie de plan.
// Mismo interruptor al registrar, al renovar y al editar al paciente.
const AutoRenewSwitch = ({ id, checked, onCheckedChange, disabled, className }: AutoRenewSwitchProps) => (
  <div className={cn('flex items-start justify-between gap-4 rounded-lg border border-border p-3', className)}>
    <div className="space-y-1">
      <Label htmlFor={id}>Renovar automáticamente cada mes</Label>
      <p className="text-xs text-muted-foreground">
        Para quien paga todos los meses: su plan se renueva solo, sin que tengas que apretar «Renovar plan». El mes nuevo queda activo (sin
        plazo de pago) y tú recibes un aviso para revisar que haya transferido. Puedes apagarlo cuando quieras.
      </p>
    </div>
    <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} />
  </div>
);

export default AutoRenewSwitch;
