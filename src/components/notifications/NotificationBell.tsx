import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useUnsavedChangesApi } from '@/contexts/UnsavedChangesContext';
import {
  Activity,
  AlertCircle,
  Bell,
  BellOff,
  CalendarCheck,
  CalendarX,
  CheckCheck,
  Clock,
  HeartPulse,
  Loader2,
  Sparkles,
  Trophy,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import EmptyState from '@/components/shared/EmptyState';
import LoadingState from '@/components/shared/LoadingState';
import { notificationService } from '@/services/notificationService';
import { cn } from '@/lib/utils';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import type { Notification } from '@/types';

const POLL_INTERVAL_MS = 60_000;

// Icono y color por tipo: se reconoce el tipo de aviso sin leerlo.
const TYPE_META: Record<string, { icon: LucideIcon; tone: string }> = {
  appointment_booked: { icon: CalendarCheck, tone: 'bg-info/15 text-info' },
  appointment_cancelled: { icon: CalendarX, tone: 'bg-warning/15 text-warning' },
  plan_expiring: { icon: Clock, tone: 'bg-warning/15 text-warning' },
  plan_expired: { icon: AlertCircle, tone: 'bg-destructive/15 text-destructive' },
  wellness_alert: { icon: HeartPulse, tone: 'bg-destructive/15 text-destructive' },
  evolution_updated: { icon: Activity, tone: 'bg-info/15 text-info' },
  achievement_unlocked: { icon: Trophy, tone: 'bg-primary/15 text-primary' },
  readiness_reminder: { icon: Sparkles, tone: 'bg-primary/15 text-primary' },
};
const FALLBACK_META = { icon: Bell, tone: 'bg-muted text-muted-foreground' };

// Una fecha inválida no debe tumbar la campanita (ni la pantalla).
const timeAgo = (iso: string) => {
  try {
    return formatDistanceToNow(parseISO(iso), { addSuffix: true, locale: es });
  } catch {
    return '';
  }
};

const NotificationBell = () => {
  const navigate = useNavigate();
  const { confirmLeave } = useUnsavedChangesApi();
  const location = useLocation();
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const loadedOnceRef = useRef(false);

  const refreshUnreadCount = useCallback(() => {
    // Con la pestaña oculta no se consulta: ahorra datos y batería
    if (document.hidden) return;
    notificationService.getUnreadCount().then(setUnreadCount).catch(() => {});
  }, []);

  // Carga inicial + polling cada 60 s
  useEffect(() => {
    refreshUnreadCount();
    const interval = setInterval(refreshUnreadCount, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [refreshUnreadCount]);

  // Refetch al navegar (sin contar la primera carga, que ya hizo el efecto de arriba)
  useEffect(() => {
    if (!loadedOnceRef.current) {
      loadedOnceRef.current = true;
      return;
    }
    refreshUnreadCount();
  }, [location.pathname, refreshUnreadCount]);

  const loadNotifications = async () => {
    setLoading(true);
    setLoadError(false);
    try {
      setNotifications(await notificationService.getAll());
    } catch {
      // La campanita no rompe la navegación: se avisa dentro del panel y se puede reintentar
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen) loadNotifications();
  };

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.read) {
      setNotifications((prev) => prev.map((n) => (n._id === notification._id ? { ...n, read: true } : n)));
      setUnreadCount((prev) => Math.max(0, prev - 1));
      notificationService.markAsRead(notification._id).catch(() => {});
    }
    setOpen(false);
    const link = notification.link;
    if (link) confirmLeave(() => navigate(link));
  };

  const handleMarkAllAsRead = async () => {
    setMarkingAll(true);
    try {
      await notificationService.markAllAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch {
      // deja el estado como estaba si falla
    } finally {
      setMarkingAll(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={unreadCount > 0 ? `Notificaciones, ${unreadCount} sin leer` : 'Notificaciones'}
        >
          <Bell className="h-5 w-5" aria-hidden="true" />
          {unreadCount > 0 && (
            <span
              aria-hidden="true"
              className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[calc(100vw-2rem)] max-w-sm p-0 sm:w-96">
        <div className="flex items-center justify-between border-b border-border p-3">
          <p className="text-sm font-semibold">Notificaciones</p>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={handleMarkAllAsRead} disabled={markingAll}>
              {markingAll ? (
                <Loader2 className="mr-1 h-3 w-3 animate-spin motion-reduce:animate-none" aria-hidden="true" />
              ) : (
                <CheckCheck className="mr-1 h-3 w-3" aria-hidden="true" />
              )}
              Marcar todas como leídas
            </Button>
          )}
        </div>

        <ScrollArea className="max-h-96">
          {loading ? (
            <LoadingState className="py-8" label="Cargando notificaciones…" />
          ) : loadError ? (
            <div className="flex flex-col items-center gap-3 px-6 py-8 text-center">
              <p className="text-sm text-muted-foreground">No se pudieron cargar las notificaciones.</p>
              <Button variant="outline" size="sm" onClick={loadNotifications}>
                Reintentar
              </Button>
            </div>
          ) : notifications.length === 0 ? (
            <EmptyState
              icon={BellOff}
              title="No tienes notificaciones"
              description="Aquí verás avisos de citas, planes y tu seguimiento."
              className="border-0 py-8"
            />
          ) : (
            <ul className="divide-y divide-border">
              {notifications.map((notification) => {
                const meta = TYPE_META[notification.type] ?? FALLBACK_META;
                const Icon = meta.icon;
                return (
                  <li key={notification._id}>
                    <button
                      type="button"
                      onClick={() => handleNotificationClick(notification)}
                      className={cn(
                        'flex w-full gap-3 p-3 text-left transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none',
                        !notification.read && 'bg-primary/5'
                      )}
                    >
                      <span className={cn('mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full', meta.tone)}>
                        <Icon className="h-4 w-4" aria-hidden="true" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-start justify-between gap-2">
                          <span className={cn('text-sm', notification.read ? 'font-medium' : 'font-semibold')}>
                            {notification.title}
                          </span>
                          {!notification.read && (
                            <>
                              <span aria-hidden="true" className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
                              <span className="sr-only">No leída</span>
                            </>
                          )}
                        </span>
                        <span className="mt-0.5 block text-xs text-muted-foreground">{notification.body}</span>
                        <span className="mt-1 block text-xs text-muted-foreground/80">{timeAgo(notification.createdAt)}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
};

export default NotificationBell;
