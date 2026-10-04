import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, MessageCircle } from 'lucide-react';
import { getWhatsAppUrl } from '@/config/contact';

interface ErrorBoundaryProps {
  children: ReactNode;
  // Cambia al navegar: así, tras un error, otra pantalla vuelve a intentar renderizar
  resetKey?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  detail?: string;
}

// Si una pantalla falla, se muestra este aviso en vez de dejar toda la app en negro.
// Se muestra solo el mensaje técnico del error (sin datos del paciente) para poder diagnosticarlo.
class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, detail: String(error?.message ?? error).slice(0, 200) };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Error de pantalla:', error.message, info.componentStack);
  }

  componentDidUpdate(prev: ErrorBoundaryProps) {
    if (this.state.hasError && prev.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false, detail: undefined });
    }
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-16 text-center">
        <AlertTriangle className="h-10 w-10 text-amber-400" />
        <h2 className="text-xl font-semibold text-foreground">Algo salió mal en esta pantalla</h2>
        <p className="text-sm text-muted-foreground">
          Tus datos están a salvo. Prueba recargar; si sigue pasando, avísanos por WhatsApp.
        </p>
        {this.state.detail && (
          <p className="break-words rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            Detalle técnico (envíalo si avisas): {this.state.detail}
          </p>
        )}
        <div className="flex flex-wrap justify-center gap-2">
          <Button onClick={() => window.location.reload()}>Recargar</Button>
          <Button asChild variant="outline">
            <a href={getWhatsAppUrl('Hola, me falló una pantalla en la app de Prime F&H')} target="_blank" rel="noreferrer">
              <MessageCircle className="h-4 w-4 mr-2" />
              Avisar por WhatsApp
            </a>
          </Button>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
