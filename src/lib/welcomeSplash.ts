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

export const resetWelcome = (): void => {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // nada que borrar
  }
};
