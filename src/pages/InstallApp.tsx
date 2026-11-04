import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Download, Share, Plus, CheckCircle2, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import PageHeader from '@/components/shared/PageHeader';
import { useAppDarkTheme } from '@/hooks/useAppDarkTheme';

// No estándar en lib.dom.d.ts todavía — Chrome/Edge/Android lo disparan,
// Safari/iOS nunca (no hay instalación programática ahí, solo manual).
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

// Ya está abierta como app instalada (Android/Chrome: display-mode; Safari/iOS: navigator.standalone)
const isRunningInstalled = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

const InstallApp = () => {
  useAppDarkTheme();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(isRunningInstalled);

  useEffect(() => {
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    const handleInstalled = () => {
      setInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === 'accepted') setInstalled(true);
    setDeferredPrompt(null);
  };

  return (
    <div className="min-h-screen bg-background py-10 sm:py-16">
      <main id="contenido" className="mx-auto w-full max-w-2xl px-4 sm:px-6">
        <div className="mb-8 space-y-4">
          <Button asChild variant="ghost" size="sm" className="-ml-3">
            <Link to="/login">
              <ArrowLeft aria-hidden="true" />
              Volver al inicio de sesión
            </Link>
          </Button>
          <PageHeader
            title={
              <>
                <Smartphone aria-hidden="true" className="h-7 w-7 text-secondary" />
                Instala Prime F&H
              </>
            }
            description="Agrega la app a tu celular para acceder más rápido, como cualquier otra app."
          />
        </div>

        {installed ? (
          <Card className="mb-6 border-success/50 bg-success/10" role="status">
            <CardContent className="flex items-center gap-3 p-4">
              <CheckCircle2 aria-hidden="true" className="h-6 w-6 shrink-0 text-success" />
              <p className="text-sm font-medium">¡Ya tienes la app instalada! Búscala en tu pantalla de inicio.</p>
            </CardContent>
          </Card>
        ) : deferredPrompt ? (
          <Card className="mb-6 border-primary/50 bg-primary/10">
            <CardContent className="flex items-center justify-between gap-3 p-4">
              <div>
                <p className="text-sm font-medium">Tu navegador puede instalarla en un clic</p>
                <p className="text-xs text-muted-foreground">Funciona sin conexión y abre más rápido</p>
              </div>
              <Button onClick={handleInstallClick}>
                <Download aria-hidden="true" />
                Instalar
              </Button>
            </CardContent>
          </Card>
        ) : null}

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Share aria-hidden="true" className="h-5 w-5 text-secondary" />
                iPhone / iPad (Safari)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
                <li>Abre esta página en <strong>Safari</strong> (no desde Instagram ni WhatsApp: ahí no se puede instalar)</li>
                <li>Toca el botón <strong>Compartir</strong> (el cuadrado con la flecha hacia arriba)</li>
                <li>Desliza hacia abajo y toca <strong>"Agregar a pantalla de inicio"</strong></li>
                <li>Si ves la opción <strong>"Abrir como app"</strong>, déjala activada</li>
                <li>Toca <strong>"Agregar"</strong> arriba a la derecha</li>
              </ol>
              <p className="mt-3 text-sm text-muted-foreground">¿Ya la agregaste antes y se abre como una página web? Mantén apretado el icono, elige <strong>"Eliminar app"</strong> y agrégala de nuevo con estos pasos.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Plus aria-hidden="true" className="h-5 w-5 text-secondary" />
                Android (Chrome)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
                <li>Si arriba aparece el botón "Instalar", tócalo</li>
                <li>Si no, abre el menú (⋮, arriba a la derecha)</li>
                <li>Toca <strong>"Instalar app"</strong> (mejor que "Agregar a pantalla de inicio", que solo crea un acceso directo)</li>
              </ol>
              <p className="mt-3 text-sm text-muted-foreground">¿Ya tienes un acceso directo que se abre en el navegador? Elimínalo (mantén apretado el icono) e instala la app de nuevo.</p>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default InstallApp;
