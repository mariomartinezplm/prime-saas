import { useId } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import type { PlanTerm } from '@/config/planCatalog';

export type PaymentMode = 'prepaid' | 'monthly';

interface PlanBillingOptionsProps {
  term: PlanTerm;
  paymentMode: PaymentMode;
  scholarship: boolean;
  onPaymentModeChange: (mode: PaymentMode) => void;
  onScholarshipChange: (value: boolean) => void;
  // Kinesiología no tiene plazos: solo la beca
  showPaymentMode?: boolean;
}

// Para el personal (admin y profesionales): cómo se cobra el plan y si es una beca. No cambia las sesiones ni los horarios del paciente.
const PlanBillingOptions = ({ term, paymentMode, scholarship, onPaymentModeChange, onScholarshipChange, showPaymentMode = true }: PlanBillingOptionsProps) => {
  const baseId = useId();
  const modeId = `${baseId}-mode`;
  const beca = `${baseId}-beca`;
  return (
    <div className="space-y-3 rounded-md border border-border bg-muted/30 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Cobro</p>
      {showPaymentMode && term !== 'mensual' && (
        <div className="space-y-1.5">
          <Label htmlFor={modeId}>Forma de pago</Label>
          <Select value={paymentMode} onValueChange={(v) => onPaymentModeChange(v as PaymentMode)} disabled={scholarship}>
            <SelectTrigger id={modeId}><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="prepaid">Pagado por adelantado (con descuento)</SelectItem>
              <SelectItem value="monthly">Pago mes a mes, sin renovar a mano</SelectItem>
            </SelectContent>
          </Select>
          {paymentMode === 'monthly' && (
            <p className="text-xs text-muted-foreground">El plan queda cargado por todo el plazo. En Ingresos, cada mes cuenta a su tarifa mensual, sin descuento.</p>
          )}
        </div>
      )}
      <div className="flex items-start gap-2">
        <Checkbox id={beca} checked={scholarship} onCheckedChange={(v) => onScholarshipChange(v === true)} className="mt-0.5" />
        <div className="space-y-0.5">
          <Label htmlFor={beca} className="cursor-pointer">Beca total (sin costo)</Label>
          <p className="text-xs text-muted-foreground">Cuenta como $0 en Ingresos y queda identificada como beca. Se renueva sola cada mes y no recibe avisos de pago.</p>
        </div>
      </div>
    </div>
  );
};

export default PlanBillingOptions;
