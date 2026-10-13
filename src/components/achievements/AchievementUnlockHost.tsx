import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { useUnsavedChangesApi } from '@/contexts/UnsavedChangesContext';
import { achievementApi, type UnseenAchievement } from '@/services/achievementService';
import AchievementBadge from './AchievementBadge';
import { formatDay } from './format';

// Solo en pantallas tranquilas: nunca durante una reserva, una cita o un formulario. Un logro se concede igual aunque
// no se vea la animación: queda en el historial de "Mis logros".
const SAFE_ROUTES = ['/app/dashboard', '/app/logros'];
// Espera para no encimarse con la pantalla de bienvenida del logo
const AFTER_SPLASH_MS = 2600;
const RETRY_MS = 4000;
const MAX_RETRIES = 6;

// Hay un diálogo abierto (agendar, confirmar, menú…): no se interrumpe
const dialogIsOpen = () => !!document.querySelector('[role="dialog"], [role="alertdialog"]');

const AchievementUnlockHost = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const { isDirty } = useUnsavedChangesApi();

  const [queue, setQueue] = useState<UnseenAchievement[]>([]);
  const [position, setPosition] = useState(0);
  const [open, setOpen] = useState(false);
  // Lo ya mostrado en esta sesión: navegar entre secciones no repite la animación
  const shown = useRef(new Set<string>());
  const mountedAt = useRef(Date.now());
  // `check` se programa con temporizadores: lee el estado actual por una referencia (no por una copia vieja) para no
  // reemplazar la animación que ya está en pantalla.
  const openRef = useRef(false);
  openRef.current = open;

  const safe = SAFE_ROUTES.includes(location.pathname);

  const check = useCallback(
    async (attempt = 0) => {
      if (openRef.current) return;
      try {
        const unseen = (await achievementApi.getUnseen()).filter((a) => !shown.current.has(a.id));
        if (unseen.length === 0 || openRef.current) return;
        // Si hay un diálogo abierto o algo sin guardar, se reintenta un poco más tarde (sin interrumpir)
        if (dialogIsOpen() || isDirty()) {
          if (attempt < MAX_RETRIES) setTimeout(() => check(attempt + 1), RETRY_MS);
          return;
        }
        setQueue(unseen);
        setPosition(0);
        setOpen(true);
      } catch {
        // Sin los logros nuevos no pasa nada: se verán en "Mis logros". Nunca se bloquea nada por esto.
      }
    },
    [isDirty]
  );

  useEffect(() => {
    if (!safe) return;
    const wait = Math.max(0, AFTER_SPLASH_MS - (Date.now() - mountedAt.current));
    const timer = setTimeout(() => check(), wait);
    return () => clearTimeout(timer);
  }, [safe, location.pathname, check]);

  const current = queue[position];

  // Al mostrarse se marca como visto en el servidor: no vuelve a aparecer ni en otro dispositivo
  useEffect(() => {
    if (!open || !current || shown.current.has(current.id)) return;
    shown.current.add(current.id);
    achievementApi.markSeen(current.id).catch(() => {});
  }, [open, current]);

  const next = () => {
    if (position + 1 < queue.length) setPosition(position + 1);
    else {
      setOpen(false);
      setQueue([]);
    }
  };

  const goToDetails = () => {
    const key = current?.key;
    setOpen(false);
    setQueue([]);
    if (key) navigate(`/app/logros#logro-${key}`);
  };

  if (!current) return null;

  return (
    <Dialog open={open} onOpenChange={(value) => !value && next()}>
      <DialogContent className="max-w-sm border-primary/30 bg-background text-center sm:rounded-2xl [&>button]:hidden">
        <div className="flex flex-col items-center gap-5 py-2">
          {queue.length > 1 && (
            <p className="text-xs text-muted-foreground" aria-live="polite">
              {position + 1} de {queue.length}
            </p>
          )}

          {/* La insignia aparece con opacidad y escala y se asienta con un leve rebote; con "menos movimiento" no se anima */}
          <motion.div
            key={current.id}
            initial={reduceMotion ? false : { opacity: 0, scale: 0.7 }}
            animate={reduceMotion ? { opacity: 1, scale: 1 } : { opacity: 1, scale: [0.7, 1.06, 1] }}
            transition={reduceMotion ? { duration: 0 } : { duration: 0.7, times: [0, 0.65, 1], ease: 'easeOut' }}
          >
            <AchievementBadge category={current.category} state="earned" size={112} />
          </motion.div>

          <motion.div
            key={`${current.id}-text`}
            className="space-y-2"
            initial={reduceMotion ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={reduceMotion ? { duration: 0 } : { duration: 0.4, delay: 0.35 }}
          >
            <p className="text-xs uppercase tracking-[0.18em] text-primary">Logro desbloqueado · {current.categoryLabel}</p>
            <DialogTitle className="text-2xl font-semibold text-foreground">{current.title}</DialogTitle>
            <DialogDescription className="text-base text-muted-foreground">{current.message}</DialogDescription>
            <p className="text-xs text-muted-foreground">Desbloqueado el {formatDay(current.awardedAt)}</p>
          </motion.div>

          <div className="flex w-full flex-col gap-2 pt-1">
            <Button onClick={next} autoFocus>
              {position + 1 < queue.length ? 'Siguiente' : 'Continuar'}
            </Button>
            <Button variant="ghost" onClick={goToDetails}>
              Ver detalles del progreso
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AchievementUnlockHost;
