import { useCallback, useEffect, useRef, useState } from 'react';

// "Guardado ✓" breve: `saved` es true unos segundos después de `flash()`. Se usa DESPUÉS de que el servidor
// confirma (nunca antes) para que el botón diga que terminó, en lugar de un aviso aparte.
export function useSavedFlash(ms = 2500): [boolean, () => void] {
  const [saved, setSaved] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  const flash = useCallback(() => {
    setSaved(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setSaved(false), ms);
  }, [ms]);

  useEffect(() => () => clearTimeout(timer.current), []);

  return [saved, flash];
}
