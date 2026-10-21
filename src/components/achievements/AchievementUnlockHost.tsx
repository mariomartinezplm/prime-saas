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
      <DialogContent className="max-w-sm overflow-hidden rounded-[28px] border-[#62b8cf]/35 bg-[linear-gradient(180deg,#272329,#1f1c21)] text-center text-[#fff8e4] [&>button]:hidden">
        <div className="flex flex-col items-center gap-5 py-2">
          {queue.length > 1 && (
            <p className="text-xs text-[#a8a295]" aria-live="polite">
              {position + 1} de {queue.length}
            </p>
          )}

          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8fd0e0]">Nuevo logro · {current.categoryLabel}</p>

          {/* La insignia aparece con opacidad y escala y se asienta con un leve rebote; un halo suave se expande UNA vez.
              Con "menos movimiento" no hay animación alguna. */}
          <div className="relative flex items-center justify-center">
            {!reduceMotion && (
              <motion.span
                key={`${current.id}-halo`}
                aria-hidden="true"
                className="absolute h-[120px] w-[120px] rounded-full border border-[#62b8cf]/50"
                initial={{ opacity: 0.7, scale: 0.8 }}
                animate={{ opacity: 0, scale: 1.8 }}
                transition={{ duration: 1.1, delay: 0.35, ease: 'easeOut' }}
              />
            )}
            <motion.div
              key={current.id}
              initial={reduceMotion ? false : { opacity: 0, scale: 0.7 }}
              animate={reduceMotion ? { opacity: 1, scale: 1 } : { opacity: 1, scale: [0.7, 1.06, 1] }}
              transition={reduceMotion ? { duration: 0 } : { duration: 0.7, times: [0, 0.65, 1], ease: 'easeOut' }}
            >
              <AchievementBadge category={current.category} state="earned" size={112} />
            </motion.div>
          </div>

          <motion.div
            key={`${current.id}-text`}
            className="space-y-2"
            initial={reduceMotion ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={reduceMotion ? { duration: 0 } : { duration: 0.4, delay: 0.35 }}
          >
            <DialogTitle className="font-serif text-[1.875rem] font-medium leading-tight text-[#fff8e4]">{current.title}</DialogTitle>
            <DialogDescription className="text-base text-[#cdc6b6]">{current.message}</DialogDescription>
          </motion.div>

          <dl className="flex w-full items-center justify-around border-y border-[#fff8e4]/10 py-3 text-center">
            <div>
              <dt className="text-xs text-[#a8a295]">Fecha</dt>
              <dd className="mt-0.5 text-sm font-semibold text-[#fff8e4]">{formatDay(current.awardedAt)}</dd>
            </div>
            <div>
              <dt className="text-xs text-[#a8a295]">Categoría</dt>
              <dd className="mt-0.5 text-sm font-semibold text-[#fff8e4]">{current.categoryLabel}</dd>
            </div>
          </dl>

          <div className="flex w-full flex-col gap-1 pt-1">
            <Button onClick={next} autoFocus className="min-h-[52px] rounded-2xl border-[#398ca2] bg-[#398ca2] text-base font-bold text-[#181619] hover:bg-[#398ca2]/90">
              {position + 1 < queue.length ? 'Siguiente' : 'Seguir mi camino'}
            </Button>
            <Button variant="ghost" onClick={goToDetails} className="min-h-[48px] text-[#8fd0e0] hover:bg-[#fff8e4]/[0.06] hover:text-[#8fd0e0]">
              Ver detalles del progreso
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AchievementUnlockHost;
