import api from '../lib/api';
import type { AuthResponse, LoginCredentials, RegisterData, User, APIResponse } from '../types';

export const authService = {
  // Iniciar sesión
  login: async (credentials: LoginCredentials): Promise<AuthResponse> => {
    const response = await api.post<AuthResponse>('/auth/login', credentials);
    if (response.data.success && response.data.data.token) {
      localStorage.setItem('token', response.data.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.data.user));
    }
    return response.data;
  },

  // Registrar nuevo usuario
  register: async (data: RegisterData): Promise<AuthResponse> => {
    const response = await api.post<AuthResponse>('/auth/register', data);
    if (response.data.success && response.data.data.token) {
      localStorage.setItem('token', response.data.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.data.user));
    }
    return response.data;
  },

  // Cerrar sesión
  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  },

  // Obtener usuario actual
  getCurrentUser: async (): Promise<User> => {
    const response = await api.get<APIResponse<{ user: User }>>('/auth/me');
    return response.data.data.user;
  },

  // Actualizar perfil
  updateProfile: async (data: Partial<User>): Promise<User> => {
    const response = await api.put<APIResponse<{ user: User }>>('/auth/profile', data);
    const updatedUser = response.data.data.user;
    localStorage.setItem('user', JSON.stringify(updatedUser));
    return updatedUser;
  },

  // Cambiar contraseña
  changePassword: async (currentPassword: string, newPassword: string): Promise<{ token: string }> => {
    const response = await api.put<APIResponse<{ token: string }>>('/auth/change-password', {
      currentPassword,
      newPassword,
    });
    if (response.data.data.token) {
      localStorage.setItem('token', response.data.data.token);
    }
    return response.data.data;
  },

  // Solicitar reseteo de contraseña
  forgotPassword: async (email: string): Promise<void> => {
    await api.post('/auth/forgot-password', { email });
  },

  // Resetear contraseña
  resetPassword: async (resetToken: string, newPassword: string): Promise<{ token: string }> => {
    const response = await api.put<APIResponse<{ token: string }>>(`/auth/reset-password/${resetToken}`, {
      newPassword,
    });
    if (response.data.data.token) {
      localStorage.setItem('token', response.data.data.token);
    }
    return response.data.data;
  },

  // Verificar si hay sesión activa
  isAuthenticated: (): boolean => {
    return !!localStorage.getItem('token');
  },

  // Obtener token guardado
  getToken: (): string | null => {
    return localStorage.getItem('token');
  },

  // Obtener usuario guardado
  getStoredUser: (): User | null => {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
  },
};
