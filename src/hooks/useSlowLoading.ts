import { useEffect, useState } from 'react';

// Pasa a `true` si la carga sigue en curso después de `ms`: sirve para decir "está tardando más de lo
// normal" en vez de dejar una pantalla de carga muda (el servidor gratuito puede tardar en despertar).
export function useSlowLoading(ms = 6000): boolean {
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setSlow(true), ms);
    return () => clearTimeout(timer);
  }, [ms]);

  return slow;
}
