import api from '../lib/api';
import type { Appointment, CreateAppointmentData, APIResponse } from '../types';

export const appointmentService = {
  // Crear nueva cita
  create: async (data: CreateAppointmentData): Promise<Appointment> => {
    const response = await api.post<APIResponse<{ appointment: Appointment }>>('/appointments', data);
    return response.data.data.appointment;
  },

  // Obtener todas las citas
  getAll: async (params?: {
    status?: string;
    from?: string;
    to?: string;
    type?: string;
  }): Promise<Appointment[]> => {
    const response = await api.get<APIResponse<{ appointments: Appointment[] }>>('/appointments', { params });
    return response.data.data.appointments;
  },

  // Obtener una cita por ID
  getById: async (id: string): Promise<Appointment> => {
    const response = await api.get<APIResponse<{ appointment: Appointment }>>(`/appointments/${id}`);
    return response.data.data.appointment;
  },

  // Actualizar cita (solo admin)
  update: async (id: string, data: Partial<Appointment>): Promise<Appointment> => {
    const response = await api.put<APIResponse<{ appointment: Appointment }>>(`/appointments/${id}`, data);
    return response.data.data.appointment;
  },

  // Cancelar cita
  cancel: async (id: string, reason?: string): Promise<Appointment> => {
    const response = await api.put<APIResponse<{ appointment: Appointment }>>(`/appointments/${id}/cancel`, {
      reason,
    });
    return response.data.data.appointment;
  },

  // Eliminar cita (solo admin)
  delete: async (id: string): Promise<void> => {
    await api.delete(`/appointments/${id}`);
  },

  // Obtener disponibilidad de horarios
  getAvailability: async (professionalId: string, date: string): Promise<{
    date: string;
    availableSlots: string[];
    bookedSlots: string[];
  }> => {
    const response = await api.get<APIResponse<{
      date: string;
      availableSlots: string[];
      bookedSlots: string[];
    }>>(`/appointments/availability/${professionalId}/${date}`);
    return response.data.data;
  },

  // Obtener citas próximas
  getUpcoming: async (): Promise<Appointment[]> => {
    const today = new Date().toISOString().split('T')[0];
    return await appointmentService.getAll({
      status: 'scheduled',
      from: today,
    });
  },

  // Obtener citas del día
  getToday: async (): Promise<Appointment[]> => {
    const today = new Date().toISOString().split('T')[0];
    return await appointmentService.getAll({
      status: 'scheduled',
      from: today,
      to: today,
    });
  },
};
