import api from '../lib/api';
import type { APIResponse } from '../types';
import type { Attributes } from '@/lib/exerciseAttributes';

export type PlanBlockKind = 'single' | 'super' | 'tri';
export type PlanModality = 'weight' | 'bodyweight' | 'time' | 'weight_time';

export interface PlanGroup {
  sets: number;
  reps?: number;
  weight?: number;
  durationSec?: number;
}

export interface PlanSlot extends Attributes {
  exerciseName: string;
  modality: PlanModality;
  note?: string;
  groups: PlanGroup[];
}

export interface PlanBlock {
  blockId?: string;
  kind: PlanBlockKind;
  slots: PlanSlot[];
}

// Una preparación: lo PLANIFICADO. No es una sesión realizada ni un registro de ejercicio.
export interface TrainingPlan {
  id: string;
  forDate: string;
  title: string | null;
  blocks: PlanBlock[];
  createdAt: string;
  // Solo para el equipo (el paciente nunca recibe estos campos)
  visibleToPatient?: boolean;
  internalNotes?: string;
  updatedAt?: string;
}

export interface PlanInput {
  clientId?: string;
  forDate: string;
  title?: string;
  blocks: PlanBlock[];
  internalNotes?: string;
  visibleToPatient?: boolean;
}

export interface LastSession {
  date: string;
  blocks: PlanBlock[];
}

export const trainingPlanService = {
  list: async (patientId: string): Promise<TrainingPlan[]> => {
    const r = await api.get<APIResponse<{ plans: TrainingPlan[] }>>(`/training-plans/patient/${patientId}`);
    return r.data.data.plans;
  },
  lastSession: async (patientId: string): Promise<LastSession | null> => {
    const r = await api.get<APIResponse<{ lastSession: LastSession | null }>>(`/training-plans/patient/${patientId}/last-session`);
    return r.data.data.lastSession;
  },
  create: async (patientId: string, input: PlanInput): Promise<TrainingPlan> => {
    const r = await api.post<APIResponse<{ plan: TrainingPlan }>>(`/training-plans/patient/${patientId}`, input);
    return r.data.data.plan;
  },
  update: async (id: string, input: PlanInput): Promise<TrainingPlan> => {
    const r = await api.put<APIResponse<{ plan: TrainingPlan }>>(`/training-plans/${id}`, input);
    return r.data.data.plan;
  },
  remove: async (id: string): Promise<void> => {
    await api.delete(`/training-plans/${id}`);
  },
};
