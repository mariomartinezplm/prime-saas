import type { ReactNode } from 'react';
import { MessageCircle, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface LinkProblemProps {
  // Texto principal y apoyo (por qué no sirve y qué hacer)
  message: string;
  help: string;
  whatsappUrl: string;
  // Acciones propias de cada pantalla (pedir otro link, volver al ingreso…)
  children?: ReactNode;
}

// Link de invitación o de recuperación vencido: explica qué pasó y da una salida a un clic.
const LinkProblem = ({ message, help, whatsappUrl, children }: LinkProblemProps) => (
  <div className="space-y-4">
    <div className="flex justify-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive/15">
        <ShieldAlert aria-hidden="true" className="h-7 w-7 text-destructive" />
      </div>
    </div>
    <div className="space-y-1 text-center">
      <p className="text-foreground">{message}</p>
      <p className="text-sm text-muted-foreground">{help}</p>
    </div>
    <div className="space-y-2">
      {children}
      <Button asChild variant="outline" className="w-full">
        <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
          <MessageCircle aria-hidden="true" />
          Escribir por WhatsApp
          <span className="sr-only"> (se abre en otra pestaña)</span>
        </a>
      </Button>
    </div>
  </div>
);

export default LinkProblem;
