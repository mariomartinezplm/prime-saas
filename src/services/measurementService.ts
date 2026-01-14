import api from '../lib/api';
import type { Measurement, CreateMeasurementData, APIResponse } from '../types';

export const measurementService = {
  // Crear nueva medición
  create: async (data: CreateMeasurementData): Promise<Measurement> => {
    const response = await api.post<APIResponse<{ measurement: Measurement }>>('/measurements', data);
    return response.data.data.measurement;
  },

  // Obtener mediciones de un paciente
  getByPatient: async (patientId: string, limit?: number): Promise<Measurement[]> => {
    const response = await api.get<APIResponse<{ measurements: Measurement[] }>>(
      `/measurements/patient/${patientId}`,
      { params: { limit } }
    );
    return response.data.data.measurements;
  },

  // Obtener una medición por ID
  getById: async (id: string): Promise<Measurement> => {
    const response = await api.get<APIResponse<{ measurement: Measurement }>>(`/measurements/${id}`);
    return response.data.data.measurement;
  },

  // Actualizar medición
  update: async (id: string, data: Partial<CreateMeasurementData>): Promise<Measurement> => {
    const response = await api.put<APIResponse<{ measurement: Measurement }>>(`/measurements/${id}`, data);
    return response.data.data.measurement;
  },

  // Eliminar medición
  delete: async (id: string): Promise<void> => {
    await api.delete(`/measurements/${id}`);
  },

  // Comparar dos mediciones
  compare: async (id1: string, id2: string): Promise<{
    measurement1: Measurement;
    measurement2: Measurement;
    comparison: any;
  }> => {
    const response = await api.get<APIResponse<{
      measurement1: Measurement;
      measurement2: Measurement;
      comparison: any;
    }>>(`/measurements/compare/${id1}/${id2}`);
    return response.data.data;
  },

  // Obtener progreso de un perímetro
  getPerimeterProgress: async (patientId: string, perimeter: string, limit?: number): Promise<{
    perimeter: string;
    progress: Array<{ date: string; value: number }>;
  }> => {
    const response = await api.get<APIResponse<{
      perimeter: string;
      progress: Array<{ date: string; value: number }>;
    }>>(`/measurements/progress/${patientId}/${perimeter}`, { params: { limit } });
    return response.data.data;
  },
};
