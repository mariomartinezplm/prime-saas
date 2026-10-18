import { MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getWhatsAppUrl } from '@/config/contact';
import { cn } from '@/lib/utils';
import { BTN_OUTLINE } from './brand';

// El verde de WhatsApp solo en su icono: el resto del botón es de la marca
const WhatsAppButton = ({ label, message, className }: { label: string; message: string; className?: string }) => (
  <Button asChild variant="outline" className={cn('w-full sm:w-auto', BTN_OUTLINE, className)}>
    <a href={getWhatsAppUrl(message)} target="_blank" rel="noreferrer">
      <MessageCircle className="text-[#25D366]" aria-hidden="true" />
      {label}
    </a>
  </Button>
);

export default WhatsAppButton;
