import { useEffect, useRef } from 'react';

/**
 * Fundido corto (~140 ms, solo opacidad) cuando el contenido real reemplaza a su esqueleto. Devuelve la clase a ponerle al
 * contenido; no cambia ni retrasa nada: el contenido ya está en la página (y se puede enfocar y tocar) desde el primer instante.
 *
 * Se anima UNA sola vez por componente montado, y solo si lo que se vio antes fue el esqueleto:
 *   · un componente que ya nace con su contenido no se anima;
 *   · reintentos, recargas de datos y cualquier render posterior no repiten el fundido;
 *   · con «reducir movimiento» no hay fundido (el cambio es inmediato).
 * No usa temporizadores ni estado: solo dos referencias, que se actualizan después de dibujar.
 */
export function useContentFade(loading: boolean): string {
  const wasLoading = useRef(loading);
  const alreadyShown = useRef(false);

  // En este render: ¿el contenido acaba de reemplazar al esqueleto por primera vez?
  const fade = wasLoading.current && !loading && !alreadyShown.current;

  useEffect(() => {
    wasLoading.current = loading;
    if (!loading) alreadyShown.current = true;
  });

  return fade ? 'animate-content-in motion-reduce:animate-none' : '';
}
