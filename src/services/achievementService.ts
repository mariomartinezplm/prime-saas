import api from '../lib/api';
import type { APIResponse } from '../types';

// Meta de peso: la define la persona (bajar o subir Y cuántos kg). Sin meta completa, o desactivada, no se reconoce nada de peso.
export type BodyGoalDirection = 'lose' | 'gain';

export interface BodyGoal {
  direction: BodyGoalDirection | null;
  targetKg: number | null;
  enabled: boolean;
  startedAt: string | null;
}

export const achievementService = {
  getBodyGoal: async (): Promise<BodyGoal> => {
    const response = await api.get<APIResponse<{ goal: BodyGoal }>>('/achievements/body-goal');
    return response.data.data.goal;
  },

  updateBodyGoal: async (changes: { direction?: BodyGoalDirection | null; targetKg?: number | null; enabled?: boolean }): Promise<BodyGoal> => {
    const response = await api.put<APIResponse<{ goal: BodyGoal }>>('/achievements/body-goal', changes);
    return response.data.data.goal;
  },
};

// ── Mis logros ───────────────────────────────────────────────────────────────

export type AchievementStatus = 'earned' | 'in_progress' | 'available' | 'locked' | 'pending';
export type AchievementCategoryKey =
  | 'kinesiologia'
  | 'constancia'
  | 'readiness'
  | 'descanso'
  | 'estres'
  | 'primeros'
  | 'trayectoria'
  | 'cuerpo'
  | 'fuerza'
  | 'objetivos';

export interface AchievementProgress {
  current: number;
  target: number;
  unit: string;
  label: string;
  periodKey?: string;
  source?: string;
}

export interface AchievementAward {
  id: string;
  periodKey: string;
  awardedAt: string;
  seenAt: string | null;
  detail: string | null;
  // Solo en la vista del personal
  status?: 'active' | 'under_review';
  source?: 'auto' | 'manual';
  reason?: string | null;
  reviewNote?: string | null;
  reviewFlaggedAt?: string | null;
  ruleVersion?: number;
  evidence?: { summary: string | null; values: Record<string, unknown> | null; refModel: string | null; count: number } | null;
}

export interface AchievementItem {
  key: string;
  title: string;
  description: string;
  criteria: string | null;
  status: AchievementStatus;
  progress: AchievementProgress | null;
  lockedNote?: string | null;
  pendingNote?: string | null;
  awards: AchievementAward[];
}

export interface AchievementCategory {
  key: AchievementCategoryKey;
  label: string;
  items: AchievementItem[];
}

// Solo en «Nueva marca personal»: ejercicio, marca anterior y nueva (kg)
export interface RecordDetail {
  exercise: string;
  previous: number | null;
  current: number | null;
  unit: string;
}

// Solo en «¡Objetivo conseguido!»: la frase y la meta alcanzada
export interface GoalCelebration {
  headline: string;
  value: number | null;
  unit: string | null;
}

export interface UnseenAchievement {
  record?: RecordDetail;
  goal?: GoalCelebration;
  id: string;
  key: string;
  title: string;
  message: string;
  category: AchievementCategoryKey;
  categoryLabel: string;
  awardedAt: string;
  detail?: string | null;
}

export interface AchievementHistoryEntry extends AchievementAward {
  key: string;
  title: string;
  category: AchievementCategoryKey;
  categoryLabel: string;
}

// Objetivo de la semana (Mi camino PRIME): 'none' = sin objetivo (plan ilimitado, de kinesiología o sin plan) · 'paused' = pausa autorizada
export type WeeklyGoal =
  | { state: 'none' | 'paused'; weekStart: string; weekEnd: string }
  | { state: 'active'; weekStart: string; weekEnd: string; periodKey: string; target: number; defaultTarget: number; completed: number; scheduled: number; met: boolean; source: 'plan' | 'professional' };

export interface AchievementsOverview {
  categories: AchievementCategory[];
  next: { key: string; title: string; category: AchievementCategoryKey; categoryLabel: string; progress: AchievementProgress | null } | null;
  unseen: UnseenAchievement[];
  weekly?: WeeklyGoal;
  history: AchievementHistoryEntry[];
  summary: { earned: number };
}

export interface AchievementPause {
  _id: string;
  periodKey: string;
  reason: string;
  createdBy?: { firstName: string; lastName: string } | null;
  createdAt: string;
}

export interface PatientAchievements extends AchievementsOverview {
  goal: BodyGoal;
  pauses: AchievementPause[];
  reviewCount: number;
}

// Logros que dependen de funciones que PRIME aún no tiene (conexión con relojes o pulseras): no se muestran. Cuando exista la función, se quita de aquí.
export const HIDDEN_ACHIEVEMENT_KEYS: ReadonlySet<string> = new Set(['device_sleep']);

export function withoutUnavailable<T extends { categories: AchievementCategory[] }>(overview: T): T {
  const categories = overview.categories
    .map((c) => ({ ...c, items: c.items.filter((i) => !HIDDEN_ACHIEVEMENT_KEYS.has(i.key)) }))
    .filter((c) => c.items.length > 0);
  return { ...overview, categories };
}

// Resumen mensual de Mi camino PRIME: solo lo registrado (cantidades), sin interpretaciones
export interface MonthlySummary {
  month: string; // AAAA-MM
  isCurrent: boolean;
  sessions: { completed: number; training: number; kinesiology: number; plan: { completed: number; target: number; met: boolean } | null };
  milestones: { key: string; title: string; category: AchievementCategoryKey; categoryLabel: string; awardedAt: string }[];
  records: { measurements: number; exercises: number; readinessDays: number };
  hasActivity: boolean;
}

export const achievementApi = {
  getMonthly: async (month: string): Promise<MonthlySummary> => {
    const response = await api.get<APIResponse<MonthlySummary>>(`/achievements/me/monthly/${month}`);
    return response.data.data;
  },

  getMine: async (): Promise<AchievementsOverview> => {
    const response = await api.get<APIResponse<AchievementsOverview>>('/achievements/me');
    return withoutUnavailable(response.data.data);
  },

  getUnseen: async (): Promise<UnseenAchievement[]> => {
    const response = await api.get<APIResponse<{ unseen: UnseenAchievement[] }>>('/achievements/me/unseen');
    return response.data.data.unseen;
  },

  markSeen: async (awardId: string): Promise<void> => {
    await api.post(`/achievements/me/${awardId}/seen`);
  },

  // Personal con acceso al paciente
  getForPatient: async (patientId: string): Promise<PatientAchievements> => {
    const response = await api.get<APIResponse<PatientAchievements>>(`/achievements/patients/${patientId}`);
    return withoutUnavailable(response.data.data);
  },

  createPause: async (patientId: string, periodKey: string, reason: string): Promise<void> => {
    await api.post(`/achievements/patients/${patientId}/pauses`, { periodKey, reason });
  },

  deletePause: async (patientId: string, periodKey: string): Promise<void> => {
    await api.delete(`/achievements/patients/${patientId}/pauses/${periodKey}`);
  },

  // Objetivo semanal de entrenamiento (1 a 7 sesiones); null vuelve al valor por defecto del plan
  updatePatientWeeklyGoal: async (patientId: string, sessions: number | null): Promise<void> => {
    await api.put(`/achievements/patients/${patientId}/weekly-goal`, { sessions });
  },

  updatePatientBodyGoal: async (patientId: string, changes: { direction?: BodyGoalDirection | null; targetKg?: number | null; enabled?: boolean }): Promise<BodyGoal> => {
    const response = await api.put<APIResponse<{ goal: BodyGoal }>>(`/achievements/patients/${patientId}/body-goal`, changes);
    return response.data.data.goal;
  },
};
