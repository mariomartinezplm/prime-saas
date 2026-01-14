import api from '../lib/api';
import type { ExerciseProgress, CreateExerciseData, APIResponse } from '../types';

export const exerciseService = {
  // Crear registro de ejercicio
  create: async (data: CreateExerciseData): Promise<ExerciseProgress> => {
    const response = await api.post<APIResponse<{ exerciseProgress: ExerciseProgress }>>('/exercises', data);
    return response.data.data.exerciseProgress;
  },

  // Obtener ejercicios de un paciente
  getByPatient: async (
    patientId: string,
    params?: { category?: string; exerciseName?: string; limit?: number }
  ): Promise<ExerciseProgress[]> => {
    const response = await api.get<APIResponse<{ exercises: ExerciseProgress[] }>>(
      `/exercises/patient/${patientId}`,
      { params }
    );
    return response.data.data.exercises;
  },

  // Obtener un registro por ID
  getById: async (id: string): Promise<ExerciseProgress> => {
    const response = await api.get<APIResponse<{ exerciseProgress: ExerciseProgress }>>(`/exercises/${id}`);
    return response.data.data.exerciseProgress;
  },

  // Actualizar registro
  update: async (id: string, data: Partial<CreateExerciseData>): Promise<ExerciseProgress> => {
    const response = await api.put<APIResponse<{ exerciseProgress: ExerciseProgress }>>(`/exercises/${id}`, data);
    return response.data.data.exerciseProgress;
  },

  // Eliminar registro
  delete: async (id: string): Promise<void> => {
    await api.delete(`/exercises/${id}`);
  },

  // Obtener progreso de un ejercicio
  getProgress: async (
    patientId: string,
    exerciseName: string,
    limit?: number
  ): Promise<{
    exerciseName: string;
    progress: Array<{
      date: string;
      weight?: number;
      sets?: number;
      reps?: number;
      oneRepMax?: number;
      volume?: number;
      rpe?: number;
    }>;
  }> => {
    const response = await api.get<APIResponse<{
      exerciseName: string;
      progress: any[];
    }>>(`/exercises/progress/${patientId}/${exerciseName}`, { params: { limit } });
    return response.data.data;
  },

  // Obtener récord personal
  getPersonalRecord: async (patientId: string, exerciseName: string): Promise<ExerciseProgress> => {
    const response = await api.get<APIResponse<{ personalRecord: ExerciseProgress }>>(
      `/exercises/pr/${patientId}/${exerciseName}`
    );
    return response.data.data.personalRecord;
  },

  // Obtener lista de ejercicios
  getList: async (patientId: string): Promise<string[]> => {
    const response = await api.get<APIResponse<{ exercises: string[] }>>(`/exercises/list/${patientId}`);
    return response.data.data.exercises;
  },

  // Obtener estadísticas
  getStats: async (patientId: string): Promise<any[]> => {
    const response = await api.get<APIResponse<{ stats: any[] }>>(`/exercises/stats/${patientId}`);
    return response.data.data.stats;
  },
};
