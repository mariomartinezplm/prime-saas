import { Outlet, useLocation } from 'react-router-dom';
import ErrorBoundary from '@/components/guards/ErrorBoundary';
import { SidebarProvider, SidebarTrigger, SidebarInset } from '@/components/ui/sidebar';
import AppSidebar from './AppSidebar';
import NotificationBell from '@/components/notifications/NotificationBell';
import { useAppDarkTheme } from '@/hooks/useAppDarkTheme';
import WelcomeSplash from './WelcomeSplash';
import { UnsavedChangesProvider } from '@/contexts/UnsavedChangesContext';

const AppLayout = () => {
  useAppDarkTheme();
  const location = useLocation();

  return (
    <UnsavedChangesProvider>
      <a
        href="#contenido"
        className="sr-only z-[110] rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Saltar al contenido
      </a>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset className="min-w-0">
          <header className="flex h-14 items-center justify-between gap-4 border-b border-border bg-background px-6">
            <SidebarTrigger className="-ml-2 h-9 w-9 [@media(pointer:coarse)]:h-11 [@media(pointer:coarse)]:w-11" />
            <NotificationBell />
          </header>
          <main id="contenido" tabIndex={-1} className="flex-1 overflow-auto p-6 focus:outline-none">
            <ErrorBoundary resetKey={location.pathname}>
              {/* Entrada suave al cambiar de pantalla (se anula si el sistema pide menos movimiento) */}
              <div key={location.pathname} className="animate-in fade-in-0 slide-in-from-bottom-1 duration-200 motion-reduce:animate-none">
                <Outlet />
              </div>
            </ErrorBoundary>
          </main>
        </SidebarInset>
      </SidebarProvider>
      <WelcomeSplash />
    </UnsavedChangesProvider>
  );
};

export default AppLayout;
