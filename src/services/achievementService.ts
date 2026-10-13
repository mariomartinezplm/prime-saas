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
