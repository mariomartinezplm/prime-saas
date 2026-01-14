import api from '../lib/api';
import type { EVARecord, CreateEVAData, APIResponse } from '../types';

export const evaService = {
  // Crear registro EVA
  create: async (data: CreateEVAData): Promise<EVARecord> => {
    const response = await api.post<APIResponse<{ evaRecord: EVARecord }>>('/eva', data);
    return response.data.data.evaRecord;
  },

  // Obtener registros de un paciente
  getByPatient: async (patientId: string, bodyArea?: string, limit?: number): Promise<EVARecord[]> => {
    const response = await api.get<APIResponse<{ evaRecords: EVARecord[] }>>(
      `/eva/patient/${patientId}`,
      { params: { bodyArea, limit } }
    );
    return response.data.data.evaRecords;
  },

  // Obtener un registro por ID
  getById: async (id: string): Promise<EVARecord> => {
    const response = await api.get<APIResponse<{ evaRecord: EVARecord }>>(`/eva/${id}`);
    return response.data.data.evaRecord;
  },

  // Actualizar registro
  update: async (id: string, data: Partial<CreateEVAData>): Promise<EVARecord> => {
    const response = await api.put<APIResponse<{ evaRecord: EVARecord }>>(`/eva/${id}`, data);
    return response.data.data.evaRecord;
  },

  // Eliminar registro
  delete: async (id: string): Promise<void> => {
    await api.delete(`/eva/${id}`);
  },

  // Obtener evolución del dolor
  getEvolution: async (
    patientId: string,
    bodyArea: string,
    limit?: number
  ): Promise<{
    bodyArea: string;
    evolution: Array<{
      date: string;
      painLevel: number;
      functionalImpact?: number;
      observations?: string;
    }>;
  }> => {
    const response = await api.get<APIResponse<{
      bodyArea: string;
      evolution: any[];
    }>>(`/eva/evolution/${patientId}/${bodyArea}`, { params: { limit } });
    return response.data.data;
  },

  // Obtener áreas afectadas
  getAffectedAreas: async (patientId: string): Promise<any[]> => {
    const response = await api.get<APIResponse<{ affectedAreas: any[] }>>(
      `/eva/affected-areas/${patientId}`
    );
    return response.data.data.affectedAreas;
  },

  // Obtener resumen del dolor
  getSummary: async (patientId: string): Promise<{
    summary: any;
    latestRecord?: EVARecord;
  }> => {
    const response = await api.get<APIResponse<{
      summary: any;
      latestRecord?: EVARecord;
    }>>(`/eva/summary/${patientId}`);
    return response.data.data;
  },
};
