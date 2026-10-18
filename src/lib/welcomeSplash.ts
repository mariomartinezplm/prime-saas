// Marca de "la bienvenida ya se mostró en esta sesión del navegador". Vive en
// sessionStorage: se borra al cerrar la pestaña o la app instalada, y no guarda ningún
// dato de la persona, solo un "1".
const KEY = 'prime-welcome-shown';

export const hasShownWelcome = (): boolean => {
  try {
    return sessionStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
};

export const markWelcomeShown = (): void => {
  try {
    sessionStorage.setItem(KEY, '1');
  } catch {
    // sin almacenamiento disponible: la bienvenida simplemente podría repetirse
  }
};

// Aviso en memoria de «el logo de bienvenida está tapando la pantalla ahora mismo». Lo usan las animaciones de entrada (p. ej. las
// barras de progreso) para empezar cuando la persona ya puede verlas, no por detrás del logo. No guarda nada.
let covering = false;
const listeners = new Set<() => void>();

export const setWelcomeCovering = (value: boolean): void => {
  if (covering === value) return;
  covering = value;
  listeners.forEach((listener) => listener());
};

export const isWelcomeCovering = (): boolean => covering;

export const subscribeWelcomeCovering = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const resetWelcome = (): void => {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // nada que borrar
  }
};
