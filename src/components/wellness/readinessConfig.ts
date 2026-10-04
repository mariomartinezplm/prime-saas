import type { ReadinessKey, ReadinessStatus } from '@/types';

// Orden de las preguntas, como en el ejemplo de Mario.
// El teclado muestra 1 a 9 en el sentido natural de cada pregunta (1 = nada fatigado,
// 9 = muy fatigado). Cuando 9 es lo malo (`invert`), se guarda 10 - número para que en
// la base todas las respuestas vayan en la misma dirección: 1 = mal, 9 = bien.
// `energy` guarda lo contrario de la fatiga.
export interface ReadinessQuestion {
  key: ReadinessKey;
  title: string;
  atOne: string;
  atNine: string;
  invert: boolean;
}

export const READINESS_QUESTIONS: ReadinessQuestion[] = [
  { key: 'stress', title: '¿Cómo de estresado estás hoy?', atOne: 'Muy relajado', atNine: 'Muy estresado', invert: true },
  { key: 'soreness', title: '¿Cuánto te duelen los músculos hoy?', atOne: 'Nada de dolor', atNine: 'Muy dolorido', invert: true },
  { key: 'energy', title: '¿Cómo de fatigado estás hoy?', atOne: 'Nada fatigado', atNine: 'Muy fatigado', invert: true },
  { key: 'sleep', title: '¿Qué tal dormiste anoche?', atOne: 'Insomnio', atNine: 'Muy descansado', invert: false },
  { key: 'mood', title: '¿Cómo está tu ánimo hoy?', atOne: 'Muy bajo', atNine: 'Muy alto', invert: false },
];

// Nombres para mostrar el resultado: todos en sentido "más alto = mejor"
export const METRIC_LABELS: Record<ReadinessKey, string> = {
  sleep: 'Sueño',
  energy: 'Energía',
  stress: 'Calma',
  soreness: 'Cuerpo',
  mood: 'Ánimo',
};

export const STATUS_STYLES: Record<ReadinessStatus, {
  label: string;
  headline: string;
  badge: string;
  text: string;
  bar: string;
  border: string;
}> = {
  green: {
    label: 'Verde',
    headline: 'Listo para entrenar',
    badge: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40',
    text: 'text-emerald-400',
    bar: 'bg-emerald-500',
    border: 'border-l-emerald-500',
  },
  yellow: {
    label: 'Amarillo',
    headline: 'Entrena con precaución',
    badge: 'bg-amber-500/20 text-amber-400 border-amber-500/40',
    text: 'text-amber-400',
    bar: 'bg-amber-500',
    border: 'border-l-amber-500',
  },
  red: {
    label: 'Rojo',
    headline: 'Necesitas recuperarte',
    badge: 'bg-red-500/20 text-red-400 border-red-500/40',
    text: 'text-red-400',
    bar: 'bg-red-500',
    border: 'border-l-red-500',
  },
};

// Con coma decimal, como en Chile: 6,8
export const formatScore = (score: number) => score.toFixed(1).replace('.', ',');
