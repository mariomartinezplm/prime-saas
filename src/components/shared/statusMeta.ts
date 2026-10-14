import type { Appointment, ClientPlan, InviteStatus } from '@/types';

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

// Invitación del paciente (solo la ve el personal). El texto dice el estado; el color solo lo refuerza.
export const inviteStatusMeta: Record<InviteStatus, StatusMeta & { hint: string }> = {
  not_invited: { label: 'Sin invitar', tone: 'neutral', hint: 'Todavía no se le envió la invitación y no ha entrado a la app' },
  pending: { label: 'Invitación enviada', tone: 'info', hint: 'Recibió el correo, pero todavía no crea su contraseña (el link dura 7 días)' },
  expired: { label: 'Invitación vencida', tone: 'warning', hint: 'El link venció sin usarse: reenvía la invitación' },
  activated: { label: 'Cuenta activada', tone: 'success', hint: 'Ya creó su contraseña o ya entró a la app' },
};

export const appointmentTypeLabels: Record<Appointment['type'], string> = {
  kinesiologia: 'Kinesiología',
  entrenamiento: 'Entrenamiento',
  evaluacion: 'Evaluación',
};
