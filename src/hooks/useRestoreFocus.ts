import { useCallback, useRef } from 'react';

// Al cerrar un diálogo el foco debe volver a donde estaba al abrirlo (la cita del calendario, el botón…).
// Radix lo hace solo cuando el diálogo tiene su propio botón "disparador"; los diálogos que la app abre
// desde un estado (la mayoría) lo dejaban perdido en la página.
//
// `contentRef` va en el contenido del diálogo: se ejecuta cuando éste aparece (el diálogo todavía no movió
// el foco adentro) y anota qué estaba enfocado. `onCloseAutoFocus` lo devuelve al cerrar.
export function useRestoreFocus(onCloseAutoFocus?: (event: Event) => void) {
  const previous = useRef<HTMLElement | null>(null);

  const contentRef = useCallback((node: HTMLElement | null) => {
    // Radix vuelve a llamar este ref en cada render: solo vale la primera vez de cada apertura, cuando el
    // foco todavía está afuera. Después ya estaría dentro del propio diálogo.
    const active = document.activeElement;
    if (node && !previous.current && active instanceof HTMLElement && !node.contains(active)) {
      previous.current = active;
    }
  }, []);

  const restore = useCallback(
    (event: Event) => {
      onCloseAutoFocus?.(event);
      const target = previous.current;
      previous.current = null;
      if (event.defaultPrevented) return;
      if (target && target !== document.body && target.isConnected) {
        event.preventDefault();
        target.focus();
      }
    },
    [onCloseAutoFocus]
  );

  return { contentRef, onCloseAutoFocus: restore };
}
