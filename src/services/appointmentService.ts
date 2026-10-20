import api from '../lib/api';
import { todayLocal } from '../lib/evolutionDate';
import type { Appointment, CreateAppointmentData, BulkBookingData, APIResponse } from '../types';

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
    patient?: string;
  }): Promise<Appointment[]> => {
    const response = await api.get<APIResponse<{ appointments: Appointment[] }>>('/appointments', { params });
    return response.data.data.appointments;
  },

  // Obtener una cita por ID
  getById: async (id: string): Promise<Appointment> => {
    const response = await api.get<APIResponse<{ appointment: Appointment }>>(`/appointments/${id}`);
    return response.data.data.appointment;
  },

  // Descargar la cita como .ics — se agrega con un clic a cualquier calendario
  // (Google, Apple, Outlook), sin pedirle autorización al paciente (Paso 28.B)
  downloadICS: async (id: string): Promise<void> => {
    const response = await api.get(`/appointments/${id}/ics`, { responseType: 'blob' });
    const url = URL.createObjectURL(new Blob([response.data], { type: 'text/calendar' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `cita-primefh-${id}.ics`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  },

  // Actualizar cita (solo admin)
  update: async (id: string, data: Partial<Appointment>): Promise<Appointment> => {
    const response = await api.put<APIResponse<{ appointment: Appointment }>>(`/appointments/${id}`, data);
    return response.data.data.appointment;
  },

  // Cancelar cita
  // scope 'following': en una cita de horario fijo, cancela también las siguientes
  cancel: async (id: string, reason?: string, scope: 'this' | 'following' = 'this'): Promise<Appointment> => {
    const response = await api.put<APIResponse<{ appointment: Appointment }>>(`/appointments/${id}/cancel`, {
      reason,
      scope,
    });
    return response.data.data.appointment;
  },

  // Eliminar cita (kinesiólogos de sus pacientes y administrador)
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

  // Crear citas masivas
  bulkCreate: async (data: BulkBookingData): Promise<{
    created: Appointment[];
    skipped: Array<{ fecha: string; motivo: string }>;
  }> => {
    const response = await api.post<APIResponse<{
      created: Appointment[];
      skipped: Array<{ fecha: string; motivo: string }>;
    }>>('/appointments/bulk', data);
    return response.data.data;
  },

  // Obtener citas próximas
  getUpcoming: async (): Promise<Appointment[]> => {
    const today = todayLocal();
    return await appointmentService.getAll({
      status: 'scheduled',
      from: today,
    });
  },

  // Obtener citas del día
  getToday: async (): Promise<Appointment[]> => {
    const today = todayLocal();
    return await appointmentService.getAll({
      status: 'scheduled',
      from: today,
      to: today,
    });
  },
};
