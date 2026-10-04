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
}

// Si una pantalla falla, se muestra este aviso en vez de dejar toda la app en negro.
// No se registra el error con datos del paciente: solo el mensaje técnico en consola.
class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Error de pantalla:', error.message, info.componentStack);
  }

  componentDidUpdate(prev: ErrorBoundaryProps) {
    if (this.state.hasError && prev.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false });
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
