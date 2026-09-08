import api, { setAccessToken } from '../lib/api';
import type { AuthResponse, LoginCredentials, User, APIResponse } from '../types';

export const authService = {
  // Iniciar sesión (por email o RUT via campo identifier)
  login: async (credentials: LoginCredentials): Promise<AuthResponse> => {
    const response = await api.post<AuthResponse>('/auth/login', {
      identifier: credentials.identifier,
      password: credentials.password,
    });
    if (response.data.success && response.data.data.token) {
      setAccessToken(response.data.data.token);
    }
    return response.data;
  },

  // Cerrar sesión: revoca la sesión de refresh en el backend (Paso 08/10)
  logout: async (): Promise<void> => {
    await api.post('/auth/logout');
  },

  // Obtener usuario actual
  getCurrentUser: async (): Promise<User> => {
    const response = await api.get<APIResponse<{ user: User }>>('/auth/me');
    return response.data.data.user;
  },

  // Actualizar perfil
  updateProfile: async (data: Partial<User>): Promise<User> => {
    const response = await api.put<APIResponse<{ user: User }>>('/auth/profile', data);
    return response.data.data.user;
  },

  // Cambiar contraseña
  changePassword: async (currentPassword: string, newPassword: string): Promise<void> => {
    const response = await api.put<APIResponse<{ token: string }>>('/auth/change-password', {
      currentPassword,
      newPassword,
    });
    if (response.data.data.token) {
      setAccessToken(response.data.data.token);
    }
  },

  // Solicitar reseteo de contraseña
  forgotPassword: async (email: string): Promise<void> => {
    await api.post('/auth/forgot-password', { email });
  },

  // Resetear contraseña (Paso 13: el backend ahora también devuelve `user`,
  // mismo shape que login/acceptInvite, para poder redirigir por rol real)
  resetPassword: async (resetToken: string, newPassword: string): Promise<AuthResponse> => {
    const response = await api.put<AuthResponse>(`/auth/reset-password/${resetToken}`, {
      newPassword,
    });
    if (response.data.success && response.data.data.token) {
      setAccessToken(response.data.data.token);
    }
    return response.data;
  },

  // Aceptar invitación: define la contraseña y activa la cuenta (Paso 12/13)
  acceptInvite: async (token: string, password: string): Promise<AuthResponse> => {
    const response = await api.post<AuthResponse>(`/auth/accept-invite/${token}`, {
      password,
    });
    if (response.data.success && response.data.data.token) {
      setAccessToken(response.data.data.token);
    }
    return response.data;
  },
};
