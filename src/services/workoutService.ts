import api from '../lib/api';
import type { APIResponse } from '../types';
import type { RestState } from '@/lib/workoutClock';

export interface WorkoutSessionView {
  id: string;
  appointmentId: string | null;
  status: 'active' | 'finished' | 'auto_closed';
  startedAt: string;
  endedAt: string | null;
  lastActivityAt: string;
  rest: RestState;
}

export interface Startable {
  appointmentId: string;
  phase: 'soon' | 'live' | 'late';
  startTime: string;
  endTime: string;
}

export interface WorkoutActive {
  serverNow: string;
  session: WorkoutSessionView | null;
  startable: Startable | null;
  closedStale: boolean;
}

export interface WorkoutMutation {
  serverNow: string;
  session: WorkoutSessionView;
  resumed?: boolean;
  summary?: { durationSec: number };
}

export type RestAction = 'start' | 'pause' | 'resume' | 'add' | 'skip' | 'set_next';

// Entrenamiento en curso: registro personal. No toca la cita, el plan ni los cupos.
export const workoutService = {
  getActive: async (): Promise<WorkoutActive> => {
    const response = await api.get<APIResponse<WorkoutActive>>('/workouts/active');
    return response.data.data;
  },

  // `clientId` hace el inicio idempotente: si se reintenta, se devuelve la misma sesión
  start: async (appointmentId: string, clientId: string): Promise<WorkoutMutation> => {
    const response = await api.post<APIResponse<WorkoutMutation>>('/workouts/start', { appointmentId, clientId });
    return response.data.data;
  },

  rest: async (id: string, action: RestAction, options: { seconds?: number; expectedVersion?: number } = {}): Promise<WorkoutMutation> => {
    const response = await api.post<APIResponse<WorkoutMutation>>(`/workouts/${id}/rest`, { action, ...options });
    return response.data.data;
  },

  finish: async (id: string): Promise<WorkoutMutation> => {
    const response = await api.post<APIResponse<WorkoutMutation>>(`/workouts/${id}/finish`);
    return response.data.data;
  },
};
