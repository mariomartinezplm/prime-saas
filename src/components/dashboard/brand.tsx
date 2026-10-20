import { useEffect, useState, useSyncExternalStore } from 'react';
import { cn } from '@/lib/utils';
import { isWelcomeCovering, subscribeWelcomeCovering } from '@/lib/welcomeSplash';
import { meterPercent, shouldAnimateMeter } from './meterMath';

// Identidad de PRIME: negro #181619, turquesa #398ca2 y crema #fff8e4 (con transparencias). Los valores van exactos, no los
// aproximados del tema. Los estados nunca se distinguen solo por color: llevan texto, icono o forma.
export const SURFACE = 'rounded-2xl border border-[#fff8e4]/10 bg-[#fff8e4]/[0.04] p-5 sm:p-6';
export const EYEBROW = 'flex items-center justify-between gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#fff8e4]/60';
export const TEXT = 'text-[#fff8e4]';
export const TEXT_SOFT = 'text-[#fff8e4]/75';
// Botón de relleno (texto negro sobre turquesa: 4,66:1) y botón de borde (texto crema)
export const BTN_FILL = 'border-[#398ca2] bg-[#398ca2] text-[#181619] hover:bg-[#398ca2]/90 hover:text-[#181619]';
export const BTN_OUTLINE = 'border-[#398ca2] bg-transparent text-[#fff8e4] hover:bg-[#398ca2]/15 hover:text-[#fff8e4]';
// Etiqueta de estado: siempre con texto
export const PILL = 'inline-flex items-center gap-1 rounded-full border border-[#fff8e4]/40 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-[#fff8e4]';
// Etiqueta destacada: turquesa de la marca (nunca un relleno crema/blanco: rompe el aspecto oscuro de la app)
export const PILL_SOLID = 'inline-flex items-center gap-1 rounded-full border border-[#398ca2]/60 bg-[#398ca2]/25 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-[#fff8e4]';
// Superficie protagonista: degradado turquesa muy sutil sobre el fondo oscuro (una por pantalla)
export const HERO_SURFACE = 'border-[#398ca2]/45 bg-[linear-gradient(155deg,rgba(57,140,162,0.24),rgba(57,140,162,0.05)_62%)]';
// Tono turquesa claro derivado de la marca (#398ca2 aclarado): segundo anillo, textos de apoyo sobre fondo oscuro. Contraste sobre #181619 > 9:1.
export const BRAND_LIGHT = '#7cc0d2';
// Superficie de tarjeta estándar y su variante interactiva
export const CARD = 'rounded-[22px] border border-[#fff8e4]/10 bg-[#fff8e4]/[0.04]';
export const CARD_LINK = 'transition-colors duration-150 hover:bg-[#fff8e4]/[0.07] active:bg-[#fff8e4]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#fff8e4]';
// Texto de «sección» editorial (en minúscula normal; solo el eyebrow de cada pantalla va en versalitas)
export const EYEBROW_SOFT = 'text-xs font-semibold uppercase tracking-[0.12em] text-[#fff8e4]/60';

interface MeterProps {
  ratio: number; // 0..1
  label: string; // para lectores de pantalla: «6 de 8 sesiones»
  className?: string;
  // Identifica ESTA barra para animarla solo la primera vez que aparece en la sesión de la página (ver más abajo)
  animateKey?: string;
}

// Barras que ya aparecieron en esta carga de la página. Vive solo en memoria: no se guarda nada en el dispositivo, y al
// recargar la página (o abrirla de nuevo) vuelven a animarse una vez. Volver a Inicio desde otra pantalla NO las repite.
const shown = new Set<string>();

// Barra de progreso de la marca. El valor siempre está también en texto al lado: la barra refuerza, no es la única fuente.
//
// ANIMACIÓN DE ENTRADA (Fase 2A.2): al montarse con contenido válido, la barra se «descubre» de izquierda a derecha hasta su valor
// real en ~600 ms. Es una animación CSS de recorte (clip-path): no cambia el ancho ni la altura, así que no mueve nada alrededor,
// y no hace falta ningún estado ni render extra. El valor accesible (aria-valuenow) es el real desde el primer instante, y el texto
// numérico de al lado nunca se anima. Con «reducir movimiento» no hay animación. Si el valor no es válido se dibuja vacía y sin
// valor accesible (no se inventa un número). Los cambios posteriores del valor siguen la transición de ancho de siempre.
// Decide UNA vez, al montar, si una barra o un anillo debe animar su entrada, y si debe esperar a que termine el logo de bienvenida
export function useMeterAnimation(ratio: number, animateKey: string | undefined) {
  const { valid, pct } = meterPercent(ratio);
  const [animate] = useState(() => shouldAnimateMeter(ratio, animateKey, shown));
  useEffect(() => {
    if (animateKey && valid) shown.add(animateKey);
  }, [animateKey, valid]);
  const covered = useSyncExternalStore(subscribeWelcomeCovering, isWelcomeCovering, () => false);
  return { valid, pct, animate, covered };
}

export const Meter = ({ ratio, label, className, animateKey }: MeterProps) => {
  const { valid, pct, animate, covered } = useMeterAnimation(ratio, animateKey);
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={valid ? pct : undefined}
      className={cn('h-2 w-full overflow-hidden rounded-full bg-[#fff8e4]/[0.06] ring-1 ring-inset ring-[#fff8e4]/25', className)}
    >
      <div
        className={cn(
          'h-full rounded-full bg-[#398ca2] transition-[width] duration-500 motion-reduce:transition-none',
          animate && 'animate-meter-fill motion-reduce:animate-none',
          animate && covered && '[animation-play-state:paused]'
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
};
