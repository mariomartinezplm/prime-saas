import api from '../lib/api';
import type { APIResponse } from '../types';

// Meta corporal (hitos de evolución de peso). Sin meta, o con la meta desactivada, no se reconoce nada de peso.
export type BodyGoalDirection = 'lose' | 'gain' | 'maintain';

export interface BodyGoal {
  direction: BodyGoalDirection | null;
  enabled: boolean;
  startedAt: string | null;
}

export const achievementService = {
  getBodyGoal: async (): Promise<BodyGoal> => {
    const response = await api.get<APIResponse<{ goal: BodyGoal }>>('/achievements/body-goal');
    return response.data.data.goal;
  },

  updateBodyGoal: async (changes: { direction?: BodyGoalDirection | null; enabled?: boolean }): Promise<BodyGoal> => {
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
  | 'trayectoria'
  | 'cuerpo'
  | 'fuerza';

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

export interface UnseenAchievement {
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

export interface AchievementsOverview {
  categories: AchievementCategory[];
  next: { key: string; title: string; category: AchievementCategoryKey; categoryLabel: string; progress: AchievementProgress | null } | null;
  unseen: UnseenAchievement[];
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

export const achievementApi = {
  getMine: async (): Promise<AchievementsOverview> => {
    const response = await api.get<APIResponse<AchievementsOverview>>('/achievements/me');
    return response.data.data;
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
    return response.data.data;
  },

  createPause: async (patientId: string, periodKey: string, reason: string): Promise<void> => {
    await api.post(`/achievements/patients/${patientId}/pauses`, { periodKey, reason });
  },

  deletePause: async (patientId: string, periodKey: string): Promise<void> => {
    await api.delete(`/achievements/patients/${patientId}/pauses/${periodKey}`);
  },

  updatePatientBodyGoal: async (patientId: string, changes: { direction?: BodyGoalDirection | null; enabled?: boolean }): Promise<BodyGoal> => {
    const response = await api.put<APIResponse<{ goal: BodyGoal }>>(`/achievements/patients/${patientId}/body-goal`, changes);
    return response.data.data.goal;
  },
};
