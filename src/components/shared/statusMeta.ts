import type { Appointment, ClientPlan } from '@/types';

export type StatusTone = 'success' | 'warning' | 'danger' | 'info' | 'accent' | 'neutral';

export interface StatusMeta {
  label: string;
  tone: StatusTone;
}

export const appointmentStatusMeta: Record<Appointment['status'], StatusMeta> = {
  scheduled: { label: 'Programada', tone: 'info' },
  completed: { label: 'Completada', tone: 'success' },
  cancelled: { label: 'Cancelada', tone: 'danger' },
  'no-show': { label: 'No asistió', tone: 'warning' },
};

export const planStatusMeta: Record<ClientPlan['status'], StatusMeta> = {
  active: { label: 'Activo', tone: 'success' },
  upcoming: { label: 'Próximo', tone: 'info' },
  expired: { label: 'Vencido', tone: 'danger' },
  cancelled: { label: 'Cancelado', tone: 'neutral' },
};

export const activeStatusMeta: Record<'active' | 'inactive', StatusMeta> = {
  active: { label: 'Activo', tone: 'success' },
  inactive: { label: 'Inactivo', tone: 'danger' },
};
