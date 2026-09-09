import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Bell, CheckCheck, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { notificationService } from '@/services/notificationService';
import { cn } from '@/lib/utils';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import type { Notification } from '@/types';

const POLL_INTERVAL_MS = 60_000;

const NotificationBell = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const loadedOnceRef = useRef(false);

  const refreshUnreadCount = useCallback(() => {
    notificationService.getUnreadCount().then(setUnreadCount).catch(() => {});
  }, []);

  // Carga inicial + polling cada 60s
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
    try {
      const data = await notificationService.getAll();
      setNotifications(data);
    } catch {
      // silencioso — la campanita no debe romper la navegación por esto
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
    if (notification.link) navigate(notification.link);
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
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute top-0.5 right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-[calc(100vw-2rem)] max-w-sm sm:w-96 p-0"
      >
        <div className="flex items-center justify-between p-3 border-b border-border">
          <p className="font-semibold text-sm">Notificaciones</p>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={handleMarkAllAsRead}
              disabled={markingAll}
            >
              {markingAll ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <CheckCheck className="h-3 w-3 mr-1" />}
              Marcar todas leídas
            </Button>
          )}
        </div>

        <ScrollArea className="max-h-96">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : notifications.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No tienes notificaciones</p>
          ) : (
            <div className="divide-y divide-border">
              {notifications.map((notification) => (
                <button
                  key={notification._id}
                  onClick={() => handleNotificationClick(notification)}
                  className={cn(
                    'w-full text-left p-3 hover:bg-secondary/10 transition-colors',
                    !notification.read && 'bg-secondary/5'
                  )}
                >
                  <div className="flex items-start gap-2">
                    {!notification.read && (
                      <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-secondary shrink-0" />
                    )}
                    <div className={cn('flex-1 min-w-0', notification.read && 'pl-3.5')}>
                      <p className="text-sm font-medium">{notification.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{notification.body}</p>
                      <p className="text-xs text-muted-foreground/70 mt-1">
                        {formatDistanceToNow(parseISO(notification.createdAt), { addSuffix: true, locale: es })}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
};

export default NotificationBell;
