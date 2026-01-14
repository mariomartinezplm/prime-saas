import api from '../lib/api';
import type { User, DashboardStats, PatientProfile, APIResponse } from '../types';

export const userService = {
  // Obtener todos los usuarios (admin)
  getAll: async (params?: {
    role?: string;
    isActive?: boolean;
    search?: string;
    limit?: number;
    page?: number;
  }): Promise<{
    users: User[];
    count: number;
    total: number;
    page: number;
    pages: number;
  }> => {
    const response = await api.get<APIResponse<{ users: User[] }>>('/users', { params });
    return {
      users: response.data.data.users,
      count: response.data.count || 0,
      total: response.data.total || 0,
      page: response.data.page || 1,
      pages: response.data.pages || 1,
    };
  },

  // Obtener usuario por ID
  getById: async (id: string): Promise<User> => {
    const response = await api.get<APIResponse<{ user: User }>>(`/users/${id}`);
    return response.data.data.user;
  },

  // Crear usuario (admin)
  create: async (data: Partial<User> & { password: string }): Promise<User> => {
    const response = await api.post<APIResponse<{ user: User }>>('/users', data);
    return response.data.data.user;
  },

  // Actualizar usuario (admin)
  update: async (id: string, data: Partial<User>): Promise<User> => {
    const response = await api.put<APIResponse<{ user: User }>>(`/users/${id}`, data);
    return response.data.data.user;
  },

  // Eliminar usuario (admin)
  delete: async (id: string): Promise<void> => {
    await api.delete(`/users/${id}`);
  },

  // Obtener perfil completo del paciente
  getPatientProfile: async (id: string): Promise<PatientProfile> => {
    const response = await api.get<APIResponse<PatientProfile>>(`/users/${id}/profile`);
    return response.data.data;
  },

  // Obtener estadísticas del dashboard
  getDashboardStats: async (): Promise<DashboardStats> => {
    const response = await api.get<APIResponse<DashboardStats>>('/users/stats/dashboard');
    return response.data.data;
  },

  // Obtener solo pacientes
  getPatients: async (params?: {
    isActive?: boolean;
    search?: string;
    limit?: number;
  }): Promise<User[]> => {
    const response = await userService.getAll({ ...params, role: 'patient' });
    return response.users;
  },
};
