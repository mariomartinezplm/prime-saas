import { Outlet, useLocation } from 'react-router-dom';
import ErrorBoundary from '@/components/guards/ErrorBoundary';
import { SidebarProvider, SidebarTrigger, SidebarInset } from '@/components/ui/sidebar';
import AppSidebar from './AppSidebar';
import NotificationBell from '@/components/notifications/NotificationBell';
import { useAppDarkTheme } from '@/hooks/useAppDarkTheme';

const AppLayout = () => {
  useAppDarkTheme();
  const location = useLocation();

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="min-w-0">
        <header className="flex h-14 items-center justify-between gap-4 border-b border-border bg-background px-6">
          <SidebarTrigger className="-ml-2" />
          <NotificationBell />
        </header>
        <main className="flex-1 overflow-auto p-6">
          <ErrorBoundary resetKey={location.pathname}>
            <Outlet />
          </ErrorBoundary>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
};

export default AppLayout;
