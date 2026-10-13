import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import ConfirmDialog from '@/components/shared/ConfirmDialog';

interface UnsavedChangesApi {
  // Cada formulario con datos sin guardar se anota aquí (clave única) y se borra al terminar
  setDirty: (key: string, dirty: boolean) => void;
  // Ejecuta `leave` de inmediato si no hay nada sin guardar; si lo hay, pregunta primero
  confirmLeave: (leave: () => void) => void;
}

const UnsavedChangesContext = createContext<UnsavedChangesApi | null>(null);

// Vive en el layout de la app: el menú, "Cerrar sesión" y los diálogos preguntan antes de descartar
// lo que alguien está escribiendo. (El aviso del navegador al cerrar o recargar la pestaña sigue
// en useUnsavedChangesWarning.)
export const UnsavedChangesProvider = ({ children }: { children: ReactNode }) => {
  const dirtyKeys = useRef(new Set<string>());
  const [pendingLeave, setPendingLeave] = useState<(() => void) | null>(null);
  // Para devolver el foco a donde estaba si la persona decide seguir editando
  const previousFocus = useRef<HTMLElement | null>(null);

  const setDirty = useCallback((key: string, dirty: boolean) => {
    if (dirty) dirtyKeys.current.add(key);
    else dirtyKeys.current.delete(key);
  }, []);

  const confirmLeave = useCallback((leave: () => void) => {
    if (dirtyKeys.current.size === 0) leave();
    else {
      previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setPendingLeave(() => leave);
    }
  }, []);

  const api = useMemo(() => ({ setDirty, confirmLeave }), [setDirty, confirmLeave]);

  return (
    <UnsavedChangesContext.Provider value={api}>
      {children}
      <ConfirmDialog
        open={pendingLeave !== null}
        onOpenChange={(open) => {
          if (open) return;
          setPendingLeave(null);
          const target = previousFocus.current;
          requestAnimationFrame(() => target?.isConnected && target.focus());
        }}
        title="¿Salir sin guardar?"
        description="Tienes datos escritos que todavía no se guardaron. Si sales ahora, se perderán."
        confirmLabel="Salir sin guardar"
        cancelLabel="Seguir editando"
        destructive
        onConfirm={() => {
          const leave = pendingLeave;
          // Lo que se descarta ya no cuenta como pendiente (si no, el siguiente clic volvería a preguntar)
          dirtyKeys.current.clear();
          leave?.();
        }}
      />
    </UnsavedChangesContext.Provider>
  );
};

// Fuera del layout (por ejemplo en una pantalla pública) no hay nada que proteger: deja pasar.
export const useUnsavedChangesApi = (): UnsavedChangesApi =>
  useContext(UnsavedChangesContext) ?? { setDirty: () => {}, confirmLeave: (leave) => leave() };
