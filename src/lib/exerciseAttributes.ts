// Las tres dimensiones de un ejercicio, iguales para el profesional y el paciente (mismas reglas que el servidor, que es quien valida):
//  - modalidad (cómo se mide): con peso · peso corporal · tiempo · peso y tiempo
//  - ejecución (cómo se hace): normal · excéntrico · isométrico (+ segundos de la fase excéntrica, opcional)
//  - implemento (con qué):     barra · una mancuerna · dos mancuernas · sin implemento
// Son independientes entre sí y de la categoría. Los registros antiguos no los tienen y se muestran como siempre.
// La carga se muestra tal como se anotó: con dos mancuernas es el peso de CADA mancuerna (nunca se suma en silencio).

export type Modality = 'weight' | 'bodyweight' | 'time' | 'weight_time';
export type Execution = 'normal' | 'eccentric' | 'isometric';
export type Implement = 'barbell' | 'one_dumbbell' | 'two_dumbbells' | 'none';

export interface Attributes {
  execution?: Execution | null;
  eccentricSec?: number | null;
  implement?: Implement | null;
}

export const EXECUTIONS: Execution[] = ['normal', 'eccentric', 'isometric'];
export const IMPLEMENTS: Implement[] = ['barbell', 'one_dumbbell', 'two_dumbbells', 'none'];
export const ECCENTRIC_SEC_MAX = 30;

export const EXECUTION_LABEL: Record<Execution, string> = { normal: 'Normal', eccentric: 'Excéntrico', isometric: 'Isométrico' };
export const IMPLEMENT_LABEL: Record<Implement, string> = { barbell: 'Barra', one_dumbbell: 'Una mancuerna', two_dumbbells: 'Dos mancuernas', none: 'Sin implemento' };
// Versión corta para los botones
export const IMPLEMENT_SHORT: Record<Implement, string> = { barbell: 'Barra', one_dumbbell: '1 mancuerna', two_dumbbells: '2 mancuernas', none: 'Sin implemento' };

const usesWeight = (m: Modality) => m === 'weight' || m === 'weight_time';
const usesTime = (m: Modality) => m === 'time' || m === 'weight_time';

// Qué opciones tienen sentido según la modalidad (no se ofrece lo que el servidor rechazaría)
export const implementOptionsFor = (m: Modality): Implement[] => (usesWeight(m) ? IMPLEMENTS : ['none']);
export const executionOptionsFor = (m: Modality): Execution[] => (usesTime(m) ? ['normal', 'isometric'] : ['normal', 'eccentric']);

// Al cambiar la modalidad se conserva lo que sigue sirviendo y se descarta lo que ya no tiene sentido
export function coerceAttributes(m: Modality, a: Attributes): Attributes {
  const out: Attributes = { ...a };
  if (out.execution && !executionOptionsFor(m).includes(out.execution)) out.execution = m === 'time' || m === 'weight_time' ? 'isometric' : 'normal';
  if (out.execution !== 'eccentric' && out.eccentricSec != null) out.eccentricSec = null;
  if (out.implement && !implementOptionsFor(m).includes(out.implement)) out.implement = 'none';
  return out;
}

// Nombre del campo de carga según el implemento (lo que el profesional o el paciente debe anotar)
export const loadFieldLabel = (implement?: Implement | null): string =>
  implement === 'barbell' ? 'Peso total' : implement === 'one_dumbbell' ? 'Mancuerna' : implement === 'two_dumbbells' ? 'Por mancuerna' : 'Carga';

// Cuadro de carga del entrenamiento (angosto): nombre y unidad según el implemento
export const loadTile = (implement?: Implement | null): { label: string; unit: string } =>
  implement === 'barbell' ? { label: 'Total', unit: 'kg' } : implement === 'two_dumbbells' ? { label: 'Cada una', unit: 'kg' } : { label: 'Carga', unit: 'kg' };

const num = (v: number) => String(v).replace('.', ',');

// «60 kg totales», «20 kg», «12 kg por mancuerna». Sin implemento: solo «55 kg».
export function loadText(weight: number, implement?: Implement | null, unit = 'kg'): string {
  const base = `${num(weight)} ${unit}`;
  if (implement === 'barbell') return `${base} totales`;
  if (implement === 'two_dumbbells') return `${base} por mancuerna`;
  return base;
}

// «Excéntrico · 3 s», «Isométrico»; la ejecución normal no se repite (es lo habitual) salvo que se pida
export function executionText(a: Attributes, { showNormal = false } = {}): string | null {
  if (!a.execution || (a.execution === 'normal' && !showNormal)) return null;
  if (a.execution === 'eccentric' && a.eccentricSec) return `${EXECUTION_LABEL.eccentric} · ${a.eccentricSec} s`;
  return EXECUTION_LABEL[a.execution];
}

// Piezas para mostrar junto a una serie o un ejercicio: implemento y ejecución (si están definidos)
export function attributeChips(a: Attributes): string[] {
  const out: string[] = [];
  if (a.implement) out.push(IMPLEMENT_LABEL[a.implement]);
  const exec = executionText(a);
  if (exec) out.push(exec);
  return out;
}

// Texto completo de una serie: «3 series × 10 rep · 12 kg por mancuerna · Excéntrico · 3 s»
export function describeSet(s: { sets?: number | null; reps?: number | null; weight?: number | null; weightUnit?: string | null; durationSec?: number | null } & Attributes): string {
  const parts: string[] = [];
  const head = [s.sets ? `${s.sets} ${s.sets === 1 ? 'serie' : 'series'}` : null, s.reps ? `${s.reps} ${s.sets ? 'rep' : 'repeticiones'}` : null].filter(Boolean).join(' × ');
  if (head) parts.push(head);
  if (s.durationSec) parts.push(`${s.durationSec} s`);
  if (s.weight && s.weight > 0) parts.push(loadText(s.weight, s.implement, s.weightUnit ?? 'kg'));
  const exec = executionText(s);
  if (exec) parts.push(exec);
  return parts.join(' · ');
}

// Lo que identifica registros comparables (mismo implemento y misma ejecución); sin ejecución guardada = normal
export const attributeKey = (a: Attributes): string => `${a.implement ?? 'unspecified'}|${a.execution ?? 'normal'}`;

export const attributeKeyLabel = (key: string): string => {
  const [implement, execution] = key.split('|');
  const impl = implement === 'unspecified' ? 'Sin especificar' : IMPLEMENT_LABEL[implement as Implement];
  return execution === 'normal' ? impl : `${impl} · ${EXECUTION_LABEL[execution as Execution]}`;
};
