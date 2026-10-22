import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { clearPending, countPendingSets } from '@/lib/pendingSets';
import { authService } from '../services/authService';
import { getAccessToken, refreshAccessToken, setAccessToken } from '../lib/api';
import { releasePushOnLogout } from '../lib/push';
import { resetWelcome } from '../lib/welcomeSplash';
import type { User, LoginCredentials } from '../types';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: LoginCredentials) => Promise<User>;
  // Devuelve false si NO cerró sesión porque hay series de entrenamiento sin sincronizar (a menos que se fuerce)
  logout: (options?: { force?: boolean; preservePending?: boolean }) => Promise<boolean>;
  updateUser: (user: User) => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // SEGURIDAD (Paso 10 de BLUEPRINT.md): ya no hay nada que leer de
  // localStorage — la sesión larga vive en una cookie invisible para
  // JavaScript. "Silent login": se intenta renovar con esa cookie y, si
  // funciona, se pregunta quién es. Si falla, es el caso normal de "nunca
  // inició sesión" o "la sesión venció hace tiempo" — sin error visible.
  useEffect(() => {
    const initAuth = async () => {
      try {
        await refreshAccessToken();
        const currentUser = await authService.getCurrentUser();
        setUser(currentUser);
      } catch {
        setAccessToken(null);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, []);

  // Retorna el usuario (no solo lo guarda en el estado): quien llama a login
  // necesita el rol YA, en el mismo momento, para decidir a dónde redirigir
  // — el estado de React no se actualiza de forma síncrona.
  const login = async (credentials: LoginCredentials): Promise<User> => {
    const response = await authService.login(credentials);
    setUser(response.data.user);
    return response.data.user;
  };

  const logout = async (options: { force?: boolean; preservePending?: boolean } = {}): Promise<boolean> => {
    // Registros de entrenamiento sin sincronizar: no se pierden en silencio. Quien llama avisa y decide.
    if (user && !options.force && !options.preservePending && (await countPendingSets(user.id)) > 0) return false;
    // Se limpia el estado local PRIMERO: dos pantallas del código llaman
    // `logout(); navigate('/login');` sin esperar la promesa. Si el aviso al
    // backend fuera antes, ese navigate ocurriría con `user` todavía seteado
    // y las pantallas de login (que redirigen solas si ya hay sesión)
    // rebotarían de vuelta.
    // El dispositivo deja de recibir los avisos push de esta persona (usa el token que aún existe)
    const token = getAccessToken();
    const pushRelease = token ? releasePushOnLogout(token) : Promise.resolve();
    setAccessToken(null);
    setUser(null);
    resetWelcome();
    // Las series de entrenamiento pendientes de envío no deben quedar en el dispositivo cuando alguien cierra sesión
    if (!options.preservePending && user) clearPending(user.id).catch(() => {});
    try {
      await authService.logout();
    } catch {
      // Sin red o backend caído: no importa, el cliente ya quedó deslogueado
    }
    await pushRelease;
    return true;
  };

  const updateUser = (updatedUser: User) => {
    setUser(updatedUser);
  };

  const refreshUser = async () => {
    try {
      const currentUser = await authService.getCurrentUser();
      setUser(currentUser);
    } catch {
      // La sesión ya no es válida: se sale, pero lo pendiente de esta cuenta se CONSERVA para cuando vuelva a entrar
      logout({ force: true, preservePending: true });
    }
  };

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    isLoading,
    login,
    logout,
    updateUser,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
