import api from '../lib/api';
import type { APIResponse } from '../types';
import type { RestState } from '@/lib/workoutClock';

// Una solicitud que no responde en 15 s se corta: la serie queda «pendiente» y se reenvía con la MISMA clave (no se duplica)
const REQUEST = { timeout: 15000 };

export type BlockKind = 'single' | 'super' | 'tri';
export type Modality = 'weight' | 'bodyweight' | 'time';

export interface BlockSlot {
  slot: string; // A1, A2, B3…
  exerciseName: string;
  modality: Modality;
}

export interface WorkoutBlock {
  blockId: string;
  kind: BlockKind;
  label: string; // A, B, C…
  slots: BlockSlot[];
}

// Una serie guardada (cada una es una fila del historial de Ejercicios)
export interface SavedSet {
  id: string;
  blockId: string | null;
  slot: string | null;
  exerciseName: string;
  setNumber: number | null;
  reps: number | null;
  weight: number | null;
  weightUnit: 'kg' | 'lbs';
  durationSec: number | null;
  modality: Modality | null;
  clientId: string | null;
  createdAt: string;
}

export interface SetInput {
  clientId: string;
  slot: string;
  reps?: number;
  weight?: number;
  weightUnit?: 'kg' | 'lbs';
  durationSec?: number;
}

export interface ExerciseSuggestion {
  name: string;
  count: number;
  days: number;
  lastDate: string;
  // Fecha de la referencia «última vez» (de otra sesión); null si el ejercicio solo existe en la sesión de hoy
  refDate: string | null;
  last: { reps: number | null; weight: number | null; weightUnit: 'kg' | 'lbs'; durationSec: number | null; modality: Modality | null };
}

export interface ExerciseSearch {
  recent: ExerciseSuggestion[];
  frequent: ExerciseSuggestion[];
  matches: ExerciseSuggestion[];
  exact: boolean;
}

export interface WorkoutSummary {
  durationSec: number;
  exercises: { name: string; slots: string[]; sets: number; reps: number; bestWeight: number | null; unit: 'kg' | 'lbs' | null; timeSec: number; modality: Modality | null }[];
  totals: { exercises: number; sets: number; reps: number; timeSec: number };
  // Marcas personales logradas en esta sesión (carga en kg que supera la mejor de días anteriores)
  records: { name: string; previous: number; current: number; improvement: number; reps: number | null }[];
}

export interface WorkoutSessionView {
  id: string;
  appointmentId: string | null;
  status: 'active' | 'finished' | 'auto_closed';
  startedAt: string;
  endedAt: string | null;
  lastActivityAt: string;
  rest: RestState;
  blocks: WorkoutBlock[];
  sets: SavedSet[];
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
  summary?: WorkoutSummary;
  saved?: { clientId: string; created: boolean; set: SavedSet }[];
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
    const response = await api.post<APIResponse<WorkoutMutation>>(`/workouts/${id}/rest`, { action, ...options }, REQUEST);
    return response.data.data;
  },

  searchExercises: async (q: string): Promise<ExerciseSearch> => {
    const response = await api.get<APIResponse<ExerciseSearch>>('/workouts/exercises/search', { params: { q } });
    return response.data.data;
  },

  addBlock: async (id: string, block: { blockId: string; kind: BlockKind; slots: { exerciseName: string; modality: Modality }[] }): Promise<WorkoutMutation> => {
    const response = await api.post<APIResponse<WorkoutMutation>>(`/workouts/${id}/blocks`, block, REQUEST);
    return response.data.data;
  },

  // Por lote e idempotente: cada serie lleva su `clientId`; reintentar nunca duplica
  saveSets: async (id: string, blockId: string, sets: SetInput[]): Promise<WorkoutMutation> => {
    const response = await api.post<APIResponse<WorkoutMutation>>(`/workouts/${id}/sets`, { blockId, sets }, REQUEST);
    return response.data.data;
  },

  updateSet: async (setId: string, values: { reps?: number; weight?: number; weightUnit?: 'kg' | 'lbs'; durationSec?: number }): Promise<WorkoutMutation> => {
    const response = await api.put<APIResponse<WorkoutMutation>>(`/workouts/sets/${setId}`, values, REQUEST);
    return response.data.data;
  },

  deleteSet: async (setId: string): Promise<WorkoutMutation> => {
    const response = await api.delete<APIResponse<WorkoutMutation>>(`/workouts/sets/${setId}`, REQUEST);
    return response.data.data;
  },

  finish: async (id: string): Promise<WorkoutMutation> => {
    const response = await api.post<APIResponse<WorkoutMutation>>(`/workouts/${id}/finish`, undefined, REQUEST);
    return response.data.data;
  },
};
