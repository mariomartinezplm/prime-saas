import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Download, Share, Plus, CheckCircle2, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

// No estándar en lib.dom.d.ts todavía — Chrome/Edge/Android lo disparan,
// Safari/iOS nunca (no hay instalación programática ahí, solo manual).
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const InstallApp = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);

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
    <div className="min-h-screen bg-background py-16">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-2xl">
        <div className="mb-8">
          <Link to="/">
            <Button variant="ghost" className="mb-4">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Volver al inicio
            </Button>
          </Link>
          <div className="flex items-center gap-3 mb-2">
            <Smartphone className="w-8 h-8 text-secondary" />
            <h1 className="text-3xl lg:text-4xl font-bold text-brand-dark">Instala Prime F&H</h1>
          </div>
          <p className="text-muted-foreground">
            Agrega la app a tu celular para acceder más rápido, como cualquier otra app.
          </p>
        </div>

        {installed ? (
          <Card className="border-2 border-green-500/50 bg-green-500/5 mb-6">
            <CardContent className="flex items-center gap-3 p-4">
              <CheckCircle2 className="h-6 w-6 text-green-600 shrink-0" />
              <p className="text-sm font-medium">¡Ya instalaste la app! Búscala en tu pantalla de inicio.</p>
            </CardContent>
          </Card>
        ) : deferredPrompt ? (
          <Card className="border-2 border-secondary/50 bg-secondary/5 mb-6">
            <CardContent className="flex items-center justify-between gap-3 p-4">
              <div>
                <p className="text-sm font-medium">Tu navegador puede instalarla en un clic</p>
                <p className="text-xs text-muted-foreground">Funciona sin conexión y abre más rápido</p>
              </div>
              <Button onClick={handleInstallClick}>
                <Download className="h-4 w-4 mr-2" />
                Instalar
              </Button>
            </CardContent>
          </Card>
        ) : null}

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Share className="h-5 w-5 text-secondary" />
                iPhone / iPad (Safari)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
                <li>Toca el botón <strong>Compartir</strong> (el cuadrado con la flecha hacia arriba) en la barra de abajo</li>
                <li>Desliza hacia abajo y toca <strong>"Agregar a pantalla de inicio"</strong></li>
                <li>Toca <strong>"Agregar"</strong> arriba a la derecha</li>
              </ol>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Plus className="h-5 w-5 text-secondary" />
                Android (Chrome)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
                <li>Si arriba aparece el botón "Instalar", tócalo</li>
                <li>Si no, abre el menú (⋮, arriba a la derecha)</li>
                <li>Toca <strong>"Instalar app"</strong> o <strong>"Agregar a pantalla de inicio"</strong></li>
              </ol>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default InstallApp;
