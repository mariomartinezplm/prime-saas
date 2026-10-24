import type { CatalogCategory, CatalogIndicator, GoalSources, GoalView, IndicatorProgress, LatestValue } from '@/services/goalService';

// Utilidades puras de Mis objetivos PRIME: cómo se escribe cada valor y de dónde sale el punto de partida sugerido.
// Nada aquí inventa datos: si no hay registro, devuelve null.

const UNIT_TEXT: Record<string, string> = { '/10': ' de 10' };

export const decimalText = (n: number) => String(Math.round(n * 100) / 100).replace('.', ',');

// 67.5 kg → «67,5 kg»; 6 /10 → «6 de 10»; 140 ° → «140°»; 34 % → «34 %»
export function formatValue(value: number, unit: string): string {
  const n = decimalText(value);
  if (unit === '°') return `${n}°`;
  if (unit === '%') return `${n} %`;
  if (UNIT_TEXT[unit]) return `${n}${UNIT_TEXT[unit]}`;
  return `${n} ${unit}`.trim();
}

// «press banca» → «Press banca»
export const exerciseLabel = (key: string, sources?: GoalSources | null): string => {
  const found = sources?.exercises.find((e) => e.key === key);
  if (found) return found.name;
  return key ? key.charAt(0).toUpperCase() + key.slice(1) : '';
};

// Texto legible de lo que se mide, con sus parámetros: «Bíceps contraído derecho», «Press banca», «Rodilla derecha»
export function paramsText(ind: Pick<IndicatorProgress, 'indicatorId' | 'params'>, category: CatalogCategory | undefined, sources?: GoalSources | null): string {
  const def = category?.indicators.find((i) => i.id === ind.indicatorId);
  const parts: string[] = [];
  for (const p of def?.params ?? []) {
    const raw = ind.params?.[p.key];
    if (raw === undefined || raw === '') continue;
    if (p.type === 'enum') parts.push(p.options?.find((o) => o.value === raw)?.label ?? String(raw));
    else if (p.type === 'exercise') parts.push(exerciseLabel(String(raw), sources));
    else if (p.type === 'number') parts.push(`con ${decimalText(Number(raw))} kg`);
    else parts.push(String(raw));
  }
  return parts.join(' · ');
}

// Punto de partida que YA existe para un indicador (para no pedir medir de nuevo). null = primero hay que registrarlo.
export function startingPoint(def: CatalogIndicator, params: Record<string, string | number>, sources: GoalSources | null): LatestValue | null {
  if (!sources) return null;
  switch (def.source) {
    case 'exercise_load': {
      const e = sources.exercises.find((x) => x.key === params.exerciseKey);
      return e ? { value: e.bestLoadKg, day: e.lastDay, count: e.sessions } : null;
    }
    case 'exercise_reps':
      return null; // depende de la carga elegida: se calcula al guardar con los registros reales
    case 'measurement_perimeter':
      return sources.perimeters[def.field ?? String(params.field)] ?? null;
    case 'measurement_field':
      return def.field === 'weight' ? sources.weight : def.field === 'bodyFatPercentage' ? sources.bodyFatPercentage : sources.muscleMassPercentage;
    case 'jump_test':
      return sources.jumps[String(params.field)] ?? null;
    case 'eva': {
      const a = sources.painAreas[String(params.bodyArea)];
      return a && a.value !== null && a.day ? { value: a.value, day: a.day, count: a.count } : null;
    }
    default:
      return null; // registros manuales: el punto de partida es el primer valor que la persona registre
  }
}

const SUBJECT = (id: string): string =>
  id.startsWith('perimeter') ? 'Tu perímetro'
    : id.startsWith('body_weight') ? 'Tu peso'
      : id === 'exercise_max_load' ? 'Tu carga máxima'
        : id === 'exercise_reps_at_load' ? 'Tus repeticiones'
          : id === 'pain_eva' ? 'Tu dolor registrado'
            : id === 'body_fat_pct' ? 'Tu porcentaje de grasa'
              : id === 'muscle_mass_pct' ? 'Tu porcentaje de masa muscular'
                : 'Tu registro';

// Frase neutral sobre el cambio medido. Nunca afirma más de lo que dice el dato (un perímetro no es «músculo»).
export function changeText(p: IndicatorProgress): string | null {
  if (p.change === null || !p.baseline) return null;
  if (p.change === 0) return 'Sin cambios desde tu punto de partida';
  const verb = p.change > 0 ? 'aumentó' : 'disminuyó';
  return `${SUBJECT(p.indicatorId)} ${verb} ${formatValue(Math.abs(p.change), p.unit)} desde el inicio`;
}

export function statusLabel(goal: Pick<GoalView, 'status' | 'validated' | 'createdByRole'>, audience: 'patient' | 'staff' = 'patient'): { text: string; tone: 'pending' | 'validated' | 'own' | 'paused' | 'done' } {
  if (goal.status === 'achieved') return { text: 'Objetivo conseguido', tone: 'done' };
  if (goal.status === 'paused') return { text: 'En pausa', tone: 'paused' };
  if (goal.status === 'pending_validation') return { text: audience === 'staff' ? 'Por validar' : 'Pendiente de validación', tone: 'pending' };
  if (goal.validated) return { text: audience === 'staff' ? 'Validado' : 'Validada por tu kinesiólogo', tone: 'validated' };
  return { text: audience === 'staff' ? (goal.createdByRole === 'patient' ? 'Meta del paciente' : 'Meta propuesta por el equipo') : 'Meta propia', tone: 'own' };
}

export const directionText = (d: 'increase' | 'decrease' | 'maintain'): string => (d === 'increase' ? 'Subir' : d === 'decrease' ? 'Bajar' : 'Mantener');

export const dayLabel = (iso: string): string => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString('es-CL', { day: 'numeric', month: 'short', timeZone: 'UTC' });
};

// Objetivos que ocupan un cupo (pendientes o activos), del principal a los secundarios
export const activeGoals = (goals: GoalView[]): GoalView[] => goals.filter((g) => g.status === 'active' || g.status === 'pending_validation').sort((a, b) => (a.slot ?? 9) - (b.slot ?? 9));

// A dónde lleva «Ver evolución»: los registros que ya existen en la app (nada se duplica)
export function evolutionLink(p: Pick<IndicatorProgress, 'source' | 'params'>): string | null {
  if (p.source === 'exercise_load' || p.source === 'exercise_reps') return `/app/ejercicios/${encodeURIComponent(String(p.params.exerciseKey ?? ''))}`;
  if (p.source === 'measurement_perimeter' || p.source === 'measurement_field' || p.source === 'jump_test') return '/app/mediciones';
  if (p.source === 'eva') return '/app/dolor';
  return null;
}


// ── Pregunta «¿Qué quieres lograr?» al ingresar ──
// Se le pregunta una vez a quien aún no definió ningún objetivo y tiene un plan vigente. «Más tarde» la pospone 3 días y
// «No quiero definir objetivos» la apaga en ese dispositivo. Lo que se guarda en el dispositivo es solo esa preferencia.
export const GOALS_PROMPT_SNOOZE_DAYS = 3;

export interface GoalsPromptPref { snoozedUntil?: number; optOut?: boolean }

export function shouldPromptGoals(input: { hasPlan: boolean; goalsLoaded: boolean; goalCount: number; pref: GoalsPromptPref; now: number }): boolean {
  if (!input.hasPlan || !input.goalsLoaded || input.goalCount > 0) return false;
  if (input.pref.optOut) return false;
  return !(input.pref.snoozedUntil && input.pref.snoozedUntil > input.now);
}

// ── Historial de cambios (se muestra al paciente y al profesional; nada se pisa en silencio) ──
const ROLE_TEXT: Record<string, string> = { patient: 'el paciente', professional: 'el profesional', admin: 'administración', system: 'el sistema' };

export function historyText(h: { action: string; byRole: string; note: string | null; changes: unknown }, indicators: Pick<IndicatorProgress, 'seriesKey' | 'label' | 'unit'>[] = []): string {
  const who = ROLE_TEXT[h.byRole] ?? 'el equipo';
  const c = (h.changes ?? {}) as { seriesKey?: string; from?: { value: number } | null; to?: { value: number } | null };
  switch (h.action) {
    case 'created': return `Objetivo creado por ${who}`;
    case 'submitted_for_validation': return h.note ?? 'Enviado a tu kinesiólogo para validarlo';
    case 'validated': return `Validado por ${who}`;
    case 'target_changed': {
      const ind = indicators.find((i) => i.seriesKey === c.seriesKey);
      const unit = ind?.unit ?? '';
      const to = c.to ? formatValue(c.to.value, unit) : '—';
      return c.from ? `Meta cambiada por ${who}: de ${formatValue(c.from.value, unit)} a ${to}` : `Meta definida por ${who}: ${to}`;
    }
    case 'paused': return 'Objetivo en pausa';
    case 'resumed': return 'Objetivo reanudado';
    case 'discarded': return `Objetivo descartado${h.note ? `: ${h.note}` : ''}`;
    case 'achieved': return '¡Objetivo conseguido!';
    default: return 'Cambio registrado';
  }
}
