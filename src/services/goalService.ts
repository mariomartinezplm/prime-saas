import api from '../lib/api';
import type { APIResponse } from '../types';

// Catálogo de objetivos (viene del servidor: las diez categorías son datos, no pantallas fijas)
export interface GoalParamDef {
  key: string;
  type: 'enum' | 'number' | 'text' | 'exercise';
  label: string;
  required?: boolean;
  options?: { value: string; label: string }[];
  min?: number;
  max?: number;
}
export type GoalDirection = 'increase' | 'decrease' | 'maintain';
export type GoalOrigin = 'registro' | 'autorreporte' | 'profesional';

export interface CatalogIndicator {
  id: string;
  label: string;
  source: string;
  unit?: string;
  unitOptions?: string[];
  range: { min: number; max: number };
  directions: GoalDirection[];
  defaultDirection: GoalDirection;
  params: GoalParamDef[];
  confirmation: { records: number; minDays: number };
  origin: GoalOrigin;
  indirect?: boolean;
  clinical?: boolean;
  professionalTarget?: boolean;
  professionalEntryOnly?: boolean;
  field?: string;
  note?: string;
  checkinQuestion?: string;
}
export interface CatalogCategory {
  id: string;
  order: number;
  icon: string;
  name: string;
  description: string;
  supervision: 'none' | 'recommended' | 'required';
  multiIndicator?: boolean;
  indicators: CatalogIndicator[];
}
export interface GoalCatalog {
  version: number;
  maxActiveGoals: number;
  maxIndicatorsPerGoal: number;
  categories: CatalogCategory[];
}

// Lo que ya hay registrado de la persona (para sugerirlo al elegir indicador)
export interface LatestValue { value: number; day: string; count: number }
export interface GoalSources {
  exercises: { key: string; name: string; sessions: number; loads: number[]; bestLoadKg: number; lastDay: string }[];
  perimeters: Record<string, LatestValue>;
  weight: LatestValue | null;
  bodyFatPercentage: LatestValue | null;
  muscleMassPercentage: LatestValue | null;
  jumps: Record<string, LatestValue>;
  painAreas: Record<string, { count: number; value: number | null; day: string | null }>;
}

export interface IndicatorProgress {
  indicatorId: string;
  seriesKey: string;
  params: Record<string, string | number>;
  source: string;
  manual: boolean;
  confirmation: { records: number; minDays: number };
  professionalEntryOnly: boolean;
  targetSetByRole: 'patient' | 'professional' | 'admin' | null;
  label: string;
  unit: string;
  direction: GoalDirection;
  origin: GoalOrigin;
  note: string | null;
  indirect: boolean;
  target: { value: number; tolerance?: number } | null;
  baseline: { value: number; day: string } | null;
  current: { value: number; day: string } | null;
  lastDay: string | null;
  recordsCount: number;
  points: { day: string; value: number }[];
  change: number | null;
  remaining: number | null;
  percent: number | null;
  reached: boolean;
  confirmed: boolean;
  state: 'needs_target' | 'needs_baseline' | 'in_progress' | 'achieved';
}

export type GoalStatus = 'pending_validation' | 'active' | 'paused' | 'achieved' | 'discarded';
export interface GoalHistoryEntry { at: string; byRole: string; action: string; note: string | null; changes: unknown }
export interface GoalView {
  id: string;
  categoryId: string;
  categoryName: string;
  icon: string;
  priority: 'primary' | 'secondary' | null;
  slot: number | null;
  status: GoalStatus;
  requiresValidation: boolean;
  validated: boolean;
  validatedAt: string | null;
  selfDefined: boolean;
  createdByRole: 'patient' | 'professional' | 'admin';
  startedAt: string;
  startedDay: string;
  targetDay: string | null;
  achievedAt: string | null;
  discardReason: string | null;
  celebrate: boolean;
  reminders: boolean;
  progress: { state: string; percent: number | null; lastDay: string | null; indicators: IndicatorProgress[] };
  history: GoalHistoryEntry[];
}

// Lo que se envía al crear un objetivo
export interface IndicatorInput {
  indicatorId: string;
  params?: Record<string, string | number>;
  unit?: string;
  direction?: GoalDirection;
  target?: { value: number; tolerance?: number };
}
export interface CreateGoalInput {
  categoryId: string;
  priority: 'primary' | 'secondary';
  indicators: IndicatorInput[];
  targetDay?: string;
  celebrate?: boolean;
  pauseGoalId?: string;
}

export type GoalAction =
  | { action: 'pause' | 'discard' | 'resume' | 'make_primary'; note?: string; priority?: 'primary' | 'secondary' }
  | { action: 'validate' | 'update_target'; targets?: { seriesKey: string; value: number; tolerance?: number }[]; note?: string }
  | { action: 'update_settings'; celebrate?: boolean; reminders?: boolean; targetDay?: string | null };

export const goalService = {
  getCatalog: async (): Promise<GoalCatalog> => (await api.get<APIResponse<GoalCatalog>>('/goals/catalog')).data.data,
  list: async (patientId: string): Promise<GoalView[]> => (await api.get<APIResponse<{ goals: GoalView[] }>>(`/goals/patient/${patientId}`)).data.data.goals,
  sources: async (patientId: string): Promise<GoalSources> => (await api.get<APIResponse<GoalSources>>(`/goals/patient/${patientId}/sources`)).data.data,
  create: async (patientId: string, input: CreateGoalInput): Promise<GoalView> => (await api.post<APIResponse<{ goal: GoalView }>>(`/goals/patient/${patientId}`, input)).data.data.goal,
  act: async (goalId: string, body: GoalAction): Promise<GoalView> => (await api.post<APIResponse<{ goal: GoalView }>>(`/goals/${goalId}/action`, body)).data.data.goal,
  checkin: async (goalId: string, body: { seriesKey: string; value: number; day?: string; note?: string; clientId?: string }): Promise<GoalView> =>
    (await api.post<APIResponse<{ goal: GoalView }>>(`/goals/${goalId}/checkins`, body)).data.data.goal,
};
