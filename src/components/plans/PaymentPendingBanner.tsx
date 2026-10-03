import { Button } from '@/components/ui/button';
import { Clock, MessageCircle } from 'lucide-react';
import { getWhatsAppUrl } from '@/config/contact';
import { formatPaymentDeadline } from '@/config/planCatalog';

interface PaymentPendingBannerProps {
  paymentDueBy: string;
}

const PaymentPendingBanner = ({ paymentDueBy }: PaymentPendingBannerProps) => (
  <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm space-y-3">
    <div className="flex gap-2 text-amber-400">
      <Clock className="h-4 w-4 mt-0.5 shrink-0" />
      <p>
        <strong>Renovación pendiente de pago.</strong> Tienes hasta el {formatPaymentDeadline(paymentDueBy)} para pagar.
        Mientras tanto puedes seguir agendando sesiones hasta esa fecha.
      </p>
    </div>
    <Button asChild variant="outline" size="sm" className="w-full sm:w-auto h-auto whitespace-normal py-2">
      <a href={getWhatsAppUrl('Hola, quiero pagar mi renovación en Prime F&H')} target="_blank" rel="noreferrer">
        <MessageCircle className="h-4 w-4 mr-2" />
        Contacta a Prime F&amp;H para pagar
      </a>
    </Button>
  </div>
);

export default PaymentPendingBanner;
