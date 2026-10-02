import { useEffect } from 'react';

// La app interna (/app/*) usa tema negro; el sitio público y el login siguen
// con su propio diseño. La clase va en <html> (no en un contenedor) para que
// los menús, diálogos y avisos que React monta fuera del layout también la hereden.
export function useAppDarkTheme() {
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add('dark');
    return () => root.classList.remove('dark');
  }, []);
}
