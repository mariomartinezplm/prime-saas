import type { PhotoPosition } from '@/types';

export const POSITION_LABELS: Record<PhotoPosition, string> = {
  front: 'Frente',
  back: 'Espalda',
  'side-left': 'Lado izquierdo',
  'side-right': 'Lado derecho',
  other: 'Otra',
};

export const POSITIONS = Object.keys(POSITION_LABELS) as PhotoPosition[];
