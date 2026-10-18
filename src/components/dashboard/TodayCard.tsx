import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarClock, CalendarPlus, CircleAlert, HeartPulse, Hourglass, Play, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { RESERVED } from './CardSkeleton';
import { useContentFade } from './useContentFade';
import {
  announceChange,
  keyOfAction,
  reconcileRows,
  settleAll,
  settleRow,
  toRows,
  type EnterMode,
  type PresenceRow,
} from './rowPresence';
import type { TodayAction, TodayActionId, TodayResult, TodayTarget } from './todayActions';

// Identidad de PRIME: negro #181619, turquesa #398ca2 y crema #fff8e4 (con transparencias). Los valores van exactos,
// no los aproximados del tema. El estado nunca se distingue solo por color: cada acción lleva icono y texto, y lo
// importante además lleva la etiqueta «Importante» y un borde más marcado.
const ICONS: Record<TodayActionId, LucideIcon> = {
  'plan-expired': CircleAlert,
  'session-live': Play,
  'session-today': CalendarClock,
  readiness: HeartPulse,
  'plan-used-up': Hourglass,
  'book-next': CalendarPlus,
};

// Botón principal: relleno turquesa con texto negro (contraste 4,7:1). Los demás: borde turquesa con texto crema.
const CTA_PRIMARY = 'border-[#398ca2] bg-[#398ca2] text-[#181619] hover:bg-[#398ca2]/90 hover:text-[#181619]';
const CTA_OUTLINE = 'border-[#398ca2] bg-transparent text-[#fff8e4] hover:bg-[#398ca2]/15 hover:text-[#fff8e4]';

interface TodayCardProps {
  result: TodayResult;
  onGoTo: (target: TodayTarget) => void;
}

const ActionRow = ({ action, first, onGoTo }: { action: TodayAction; first: boolean; onGoTo: (target: TodayTarget) => void }) => {
  const Icon = ICONS[action.id];
  const ctaClass = cn('w-full sm:w-auto', first ? CTA_PRIMARY : CTA_OUTLINE);

  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-lg border bg-[#181619]/60 p-3 sm:flex-row sm:items-center sm:justify-between',
        action.urgent ? 'border-[#fff8e4]/60 border-l-4 border-l-[#fff8e4]' : 'border-[#398ca2]/40 border-l-4 border-l-[#398ca2]'
      )}
    >
      <div className="flex min-w-0 items-start gap-3">
        <span
          aria-hidden="true"
          className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#398ca2]/60 bg-[#398ca2]/10 text-[#fff8e4]"
        >
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0 space-y-0.5">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-medium text-[#fff8e4]">
            {action.title}
            {action.urgent && (
              <span className="rounded-full border border-[#fff8e4]/70 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-[#fff8e4]">
                Importante
              </span>
            )}
          </p>
          <p className="text-sm text-[#fff8e4]/75">{action.detail}</p>
        </div>
      </div>

      {action.cta.to ? (
        <Button asChild variant="outline" className={ctaClass}>
          <Link to={action.cta.to}>{action.cta.label}</Link>
        </Button>
      ) : (
        <Button type="button" variant="outline" className={ctaClass} onClick={() => action.cta.target && onGoTo(action.cta.target)}>
          {action.cta.label}
        </Button>
      )}
    </div>
  );
};

interface PresenceState {
  // Firma de lo que corresponde mostrar: solo cuando cambia se reconcilian las filas (no en cada render)
  sig: string;
  rows: PresenceRow<TodayAction>[];
  // Ya se mostró «Para hoy» alguna vez (la primera presentación no anima filas: la cubre el fundido del esqueleto)
  shown: boolean;
  // Había una fila-esqueleto de «Readiness» que se reemplaza por la fila real
  hadLoadingRow: boolean;
  // Texto para lectores de pantalla (solo cuando el cambio no es evidente)
  announcement: string;
  // La lista quedó vacía después de tener filas: el mensaje «no hay tareas» aparece con fundido
  emptyFade: boolean;
}

const sigOf = (result: TodayResult) =>
  `${result.status}|${result.loadingMore ? 1 : 0}|${result.status === 'actions' ? result.actions.map((a) => a.id).join(',') : ''}`;

const initialPresence = (result: TodayResult): PresenceState => ({
  sig: sigOf(result),
  rows: result.status === 'actions' ? toRows<TodayAction>(result.actions, keyOfAction) : [],
  shown: result.status === 'actions' || result.status === 'empty',
  hadLoadingRow: result.loadingMore,
  announcement: '',
  emptyFade: false,
});

// «Para hoy»: como máximo 3 acciones, en orden de prioridad fija (ver todayActions.ts). Cuando una acción deja de corresponder
// (se completó el Readiness, la sesión empezó…) su fila sale con una transición breve en vez de esfumarse de golpe; ver rowPresence.ts.
const TodayCard = ({ result, onGoTo }: TodayCardProps) => {
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  // Último elemento de las acciones que tuvo el foco. Si esa fila desaparece (p. ej. se completó el Readiness, o una sesión
  // «de hoy» pasó a «en curso») el navegador deja el foco en la nada: se lleva al título del bloque, que es un punto predecible.
  const focused = useRef<HTMLElement | null>(null);
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const fade = useContentFade(result.status === 'loading');

  // Lo último que se dibujó (se actualiza tras cada render): así una fila que sale conserva EXACTAMENTE lo que se veía
  const lastActions = useRef<TodayAction[]>(result.status === 'actions' ? result.actions : []);
  useEffect(() => {
    lastActions.current = result.status === 'actions' ? result.actions : [];
  });

  const [presence, setPresence] = useState<PresenceState>(() => initialPresence(result));
  let view = presence;
  const nextSig = sigOf(result);
  if (nextSig !== presence.sig) {
    view = nextPresence(presence, result, lastActions.current, reducedMotion);
    setPresence(view); // se ajusta durante el render: React lo vuelve a dibujar de inmediato, sin mostrar el estado viejo
  }

  const settle = useCallback((key?: string) => {
    setPresence((p) => {
      const rows = key === undefined ? settleAll(p.rows) : settleRow(p.rows, key);
      return rows === p.rows ? p : { ...p, rows };
    });
  }, []);

  // Red de seguridad: si por algún motivo el navegador no avisa que terminó una animación (pestaña en segundo plano…), la fila que
  // salía se elimina igualmente. Se cancela al cambiar la lista o al desmontar: no deja nada pendiente.
  useEffect(() => {
    if (view.rows.every((row) => row.phase === 'present')) return undefined;
    const id = setTimeout(() => settle(), 450);
    return () => clearTimeout(id);
  }, [view.rows, settle]);

  // Foco: si la fila que sale tenía el foco, pasa al título ANTES de que la fila deje de estar disponible. Si el foco está en otra
  // parte, no se toca. (Sin animación —movimiento reducido—, la fila desaparece al instante y se aplica el mismo rescate.)
  useLayoutEffect(() => {
    const el = focused.current;
    if (!el) return;
    const row = el.closest('[data-row-key]');
    if (!el.isConnected || row?.getAttribute('data-phase') === 'leaving') {
      focused.current = null;
      headingRef.current?.focus({ preventScroll: true });
    }
  }, [view.rows]);

  // Sin datos suficientes no se afirma nada: el bloque no aparece
  if (result.status === 'unknown') return null;

  const latestByKey = new Map(result.status === 'actions' ? result.actions.map((a) => [keyOfAction(a), a] as const) : []);
  const firstLiveIndex = view.rows.findIndex((row) => row.phase !== 'leaving');

  return (
    <section
      aria-labelledby="para-hoy"
      className={cn('space-y-3 rounded-xl border border-[#398ca2]/40 bg-[#398ca2]/5 p-4', result.status === 'loading' && RESERVED.today)}
      onFocusCapture={(e) => {
        focused.current = e.target instanceof HTMLElement && e.target !== headingRef.current ? e.target : null;
      }}
      onBlurCapture={(e) => {
        const target = e.target;
        // Si el elemento sigue en pantalla, el foco simplemente se movió a otro lado; si ya no está, lo quitó una actualización
        if (target instanceof HTMLElement) requestAnimationFrame(() => target.isConnected && focused.current === target && (focused.current = null));
      }}
    >
      <h2 id="para-hoy" ref={headingRef} tabIndex={-1} className="text-lg font-semibold tracking-tight text-[#fff8e4] focus:outline-none">
        Para hoy
      </h2>

      {/* Único aviso para lectores de pantalla de este bloque; solo cuando un cambio no sería evidente (nunca repite el del Readiness) */}
      {(result.status === 'actions' || result.status === 'empty') && (
        <p role="status" aria-live="polite" className="sr-only">
          {view.announcement}
        </p>
      )}

      {result.status === 'empty' && view.rows.length === 0 && (
        <p className={cn('text-sm text-[#fff8e4]/75', fade, view.emptyFade && 'animate-content-in motion-reduce:animate-none')}>No tienes otras tareas para hoy.</p>
      )}

      {result.status === 'loading' && (
        <div role="status" aria-label="Revisando tus tareas de hoy">
          <Skeleton className="h-16 w-full rounded-lg" />
        </div>
      )}

      {(view.rows.length > 0 || result.status === 'actions') && (
        // El espacio entre filas va DENTRO de cada fila (pb-2): así se pliega junto con ella al salir. -mb-2 anula el de la última.
        <ul className={cn('!-mb-2', fade)}>
          {view.rows.map((row) => {
            const leaving = row.phase === 'leaving';
            const action = leaving ? row.item : (latestByKey.get(row.key) ?? row.item);
            const animating = row.phase !== 'present';
            return (
              <li
                key={row.key}
                data-row-key={row.key}
                data-phase={row.phase}
                aria-hidden={leaving || undefined}
                // inert: la fila que sale no se puede enfocar ni tocar ni leer, pero el resto de los botones sigue activo
                {...(leaving ? { inert: '' } : {})}
                onAnimationEnd={(e) => e.target === e.currentTarget && settle(row.key)}
                className={cn(
                  'grid',
                  row.phase === 'enter' && 'animate-row-in motion-reduce:animate-none',
                  row.phase === 'enter-fade' && 'animate-content-in motion-reduce:animate-none',
                  leaving && 'pointer-events-none animate-row-out motion-reduce:animate-none'
                )}
              >
                <div className={cn('min-h-0', animating && row.phase !== 'enter-fade' && 'overflow-hidden')}>
                  <div className="pb-2">
                    <ActionRow action={action} first={view.rows.indexOf(row) === firstLiveIndex} onGoTo={onGoTo} />
                  </div>
                </div>
              </li>
            );
          })}
          {result.loadingMore && (
            <li aria-hidden="true" className="pb-2">
              {/* Del alto de una fila real (móvil / escritorio): al llegar el Readiness la lista casi no se mueve */}
              <Skeleton className="h-[9.25rem] w-full rounded-lg sm:h-[4.75rem]" />
            </li>
          )}
        </ul>
      )}
    </section>
  );
};

// Calcula el estado de presencia para el nuevo resultado (función pura aparte del componente para mantenerlo legible)
function nextPresence(prev: PresenceState, result: TodayResult, lastActions: TodayAction[], reducedMotion: boolean): PresenceState {
  const sig = sigOf(result);
  // Cargando de nuevo o sin datos: se vacía; al volver será una «primera presentación»
  if (result.status !== 'actions' && result.status !== 'empty') {
    return { sig, rows: [], shown: false, hadLoadingRow: false, announcement: '', emptyFade: false };
  }
  const items = result.status === 'actions' ? result.actions : [];
  const first = !prev.shown;
  const enter: EnterMode = first ? 'none' : prev.hadLoadingRow ? 'fade' : 'height';
  // Las filas conservan lo último que se vio de ellas (el texto «empieza en 40 min» cambia sin que cambie la fila)
  const lastByKey = new Map(lastActions.map((a) => [keyOfAction(a), a] as const));
  const refreshed = prev.rows.map((row) => (row.phase === 'leaving' ? row : { ...row, item: lastByKey.get(row.key) ?? row.item }));
  const rows = reconcileRows<TodayAction>(refreshed, items, { keyOf: keyOfAction, animate: !reducedMotion && !first, enter });

  // Sin aviso mientras la lista termina de CARGAR (primera presentación, o cuando llega la fila que esperaba su esqueleto): eso no es
  // un cambio que explicar
  let announcement = '';
  if (!first && !prev.hadLoadingRow) {
    const live = (list: TodayAction[]) => Object.fromEntries(list.map((a) => [keyOfAction(a), { id: a.id, title: a.title }]));
    announcement =
      announceChange({
        prevKeys: lastActions.map(keyOfAction),
        nextKeys: items.map(keyOfAction),
        prev: live(lastActions),
        next: live(items),
      }) ?? '';
  }
  return {
    sig,
    rows,
    shown: true,
    hadLoadingRow: result.loadingMore,
    announcement,
    emptyFade: !first && items.length === 0 && lastActions.length > 0,
  };
}

export default TodayCard;
