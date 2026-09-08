import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authService } from '../services/authService';
import { refreshAccessToken, setAccessToken } from '../lib/api';
import type { User, LoginCredentials } from '../types';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: LoginCredentials) => Promise<User>;
  logout: () => Promise<void>;
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

  const logout = async () => {
    // Se limpia el estado local PRIMERO: dos pantallas del código llaman
    // `logout(); navigate('/login');` sin esperar la promesa. Si el aviso al
    // backend fuera antes, ese navigate ocurriría con `user` todavía seteado
    // y las pantallas de login (que redirigen solas si ya hay sesión)
    // rebotarían de vuelta.
    setAccessToken(null);
    setUser(null);
    try {
      await authService.logout();
    } catch {
      // Sin red o backend caído: no importa, el cliente ya quedó deslogueado
    }
  };

  const updateUser = (updatedUser: User) => {
    setUser(updatedUser);
  };

  const refreshUser = async () => {
    try {
      const currentUser = await authService.getCurrentUser();
      setUser(currentUser);
    } catch {
      logout();
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
