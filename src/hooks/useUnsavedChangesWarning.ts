import { useEffect, useId } from 'react';
import { useUnsavedChangesApi } from '@/contexts/UnsavedChangesContext';

// Marca un formulario como "con cambios sin guardar":
// - avisa el navegador antes de cerrar o recargar la pestaña;
// - avisa la app antes de salir por el menú, "Cerrar sesión" o cerrar el diálogo (ver UnsavedChangesContext).
export function useUnsavedChangesWarning(dirty: boolean) {
  const key = useId();
  const { setDirty } = useUnsavedChangesApi();

  useEffect(() => {
    setDirty(key, dirty);
    return () => setDirty(key, false);
  }, [dirty, key, setDirty]);

  useEffect(() => {
    if (!dirty) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);
}
