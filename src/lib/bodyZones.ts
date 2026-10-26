// Mapa corporal: qué zonas existen, cómo se llaman y dónde se dibujan. Las zonas (ids y nombres) son las mismas que usa el servidor
// (backend/config/bodyZones.js; una prueba verifica que no se separen). «Izquierdo/derecho» es SIEMPRE el lado de la persona:
// de frente, su derecha queda a la izquierda del dibujo; de espalda, al revés.

export type BodyView = 'front' | 'back';
export type ZoneKind = 'joint' | 'muscle' | 'region';
export type Shape =
  | { t: 'e'; cx: number; cy: number; rx: number; ry: number; rot?: number }
  | { t: 'r'; x: number; y: number; w: number; h: number; r?: number };

export const MAP_WIDTH = 240;
export const MAP_HEIGHT = 470;

export interface ZoneGeometry {
  id: string;
  label: string;
  kind: ZoneKind;
  side: 'left' | 'right' | null;
  // Formas de la mitad izquierda del dibujo (o centradas, si la zona no tiene lado)
  front?: Shape;
  back?: Shape;
  // Campos de Mediciones (perímetros) que se pueden medir en esta zona
  perimeter?: string[];
}

const e = (cx: number, cy: number, rx: number, ry: number, rot = 0): Shape => ({ t: 'e', cx, cy, rx, ry, ...(rot ? { rot } : {}) });
const r = (x: number, y: number, w: number, h: number, rr = 8): Shape => ({ t: 'r', x, y, w, h, r: rr });

const center = (id: string, label: string, kind: ZoneKind, shapes: { front?: Shape; back?: Shape }, perimeter?: string[]): ZoneGeometry => ({ id, label, kind, side: null, ...shapes, ...(perimeter ? { perimeter } : {}) });

// Una zona con lado: se define una vez (mitad izquierda del dibujo) y se crean la izquierda y la derecha de la persona
const lateral = (base: string, fem: boolean, name: string, kind: ZoneKind, shapes: { front?: Shape; back?: Shape }, perimeter?: { left: string[]; right: string[] }, suffix = ''): ZoneGeometry[] => [
  { id: `${base}-${fem ? 'izquierda' : 'izquierdo'}`, label: `${name} ${fem ? 'izquierda' : 'izquierdo'}${suffix}`, kind, side: 'left' as const, ...shapes, ...(perimeter ? { perimeter: perimeter.left } : {}) },
  { id: `${base}-${fem ? 'derecha' : 'derecho'}`, label: `${name} ${fem ? 'derecha' : 'derecho'}${suffix}`, kind, side: 'right' as const, ...shapes, ...(perimeter ? { perimeter: perimeter.right } : {}) },
];

export const BODY_ZONE_GEOMETRY: ZoneGeometry[] = [
  center('cabeza', 'Cabeza', 'region', { front: e(120, 34, 19, 24), back: e(120, 34, 19, 24) }),
  center('cuello', 'Cuello', 'region', { front: r(108, 58, 24, 18, 6), back: r(108, 58, 24, 18, 6) }),
  ...lateral('hombro', false, 'Hombro', 'joint', { front: e(86, 92, 17, 14), back: e(86, 92, 17, 14) }),
  ...lateral('brazo', false, 'Brazo', 'muscle', { front: e(68, 134, 11, 27, 6), back: e(68, 134, 11, 27, 6) }, { left: ['bicepFlexedLeft'], right: ['bicepFlexedRight'] }),
  ...lateral('codo', false, 'Codo', 'joint', { front: e(63, 170, 9, 9), back: e(63, 170, 9, 9) }),
  ...lateral('antebrazo', false, 'Antebrazo', 'muscle', { front: e(58, 203, 9, 24, 4), back: e(58, 203, 9, 24, 4) }, { left: ['forearmLeft'], right: ['forearmRight'] }),
  ...lateral('muneca', true, 'Muñeca', 'joint', { front: e(54, 233, 7, 7), back: e(54, 233, 7, 7) }),
  ...lateral('mano', true, 'Mano', 'region', { front: e(51, 254, 8, 13), back: e(51, 254, 8, 13) }),
  center('pecho', 'Pecho', 'muscle', { front: r(100, 84, 40, 40, 10) }, ['chest']),
  center('abdomen', 'Abdomen', 'region', { front: r(103, 128, 34, 46, 10) }, ['waist']),
  center('espalda-alta', 'Espalda alta', 'region', { back: r(100, 82, 40, 32, 8) }),
  center('espalda-media', 'Espalda media', 'region', { back: r(102, 116, 36, 26, 8) }),
  center('espalda-baja', 'Espalda baja (lumbar)', 'region', { back: r(102, 144, 36, 30, 8) }),
  ...lateral('cadera', true, 'Cadera', 'joint', { front: e(97, 190, 16, 14) }),
  ...lateral('gluteo', false, 'Glúteo', 'muscle', { back: e(101, 196, 18, 16) }, { left: ['hips'], right: ['hips'] }),
  ...lateral('muslo-anterior', false, 'Muslo', 'muscle', { front: e(100, 246, 18, 40) }, { left: ['thighLeft'], right: ['thighRight'] }, ' (adelante)'),
  ...lateral('muslo-posterior', false, 'Muslo', 'muscle', { back: e(100, 246, 18, 40) }, { left: ['thighLeft'], right: ['thighRight'] }, ' (atrás)'),
  ...lateral('rodilla', true, 'Rodilla', 'joint', { front: e(100, 298, 13, 12), back: e(100, 298, 13, 12) }),
  ...lateral('tibia', true, 'Tibia', 'muscle', { front: e(99, 344, 11, 33) }),
  ...lateral('pantorrilla', true, 'Pantorrilla', 'muscle', { back: e(99, 342, 12, 32) }, { left: ['calfLeft'], right: ['calfRight'] }),
  ...lateral('tobillo', false, 'Tobillo', 'joint', { front: e(98, 386, 8, 8), back: e(98, 386, 8, 8) }),
  ...lateral('dorso-pie', false, 'Dorso del pie', 'region', { front: e(96, 412, 10, 17) }),
  ...lateral('planta', true, 'Planta', 'region', { back: e(96, 412, 10, 17) }),
];

// La derecha de la persona se ve a la izquierda del dibujo de frente; la izquierda, de espalda
const mirrored = (side: 'left' | 'right' | null, view: BodyView): boolean => {
  if (!side) return false;
  const onViewerLeft = view === 'front' ? side === 'right' : side === 'left';
  return !onViewerLeft;
};

// Forma final de una zona en una vista (ya en el lado correcto del dibujo), o null si esa zona no se ve en esa vista
export function zoneShape(zone: ZoneGeometry, view: BodyView): Shape | null {
  const base = zone[view];
  if (!base) return null;
  if (!mirrored(zone.side, view)) return base;
  return base.t === 'e'
    ? { ...base, cx: MAP_WIDTH - base.cx, ...(base.rot ? { rot: -base.rot } : {}) }
    : { ...base, x: MAP_WIDTH - base.x - base.w };
}

export const zonesInView = (view: BodyView): ZoneGeometry[] => BODY_ZONE_GEOMETRY.filter((z) => !!z[view]);
export const zoneById = (id: string): ZoneGeometry | undefined => BODY_ZONE_GEOMETRY.find((z) => z.id === id);

// Nombre legible de cualquier id (también de los antiguos que ya no se dibujan)
const LEGACY_LABELS: Record<string, string> = { lumbar: 'Lumbar', 'pie-izquierdo': 'Pie izquierdo', 'pie-derecho': 'Pie derecho', otro: 'Otra zona' };
export const zoneLabel = (id: string): string => zoneById(id)?.label ?? LEGACY_LABELS[id] ?? id;

// Qué vista muestra una zona (para abrir el mapa del lado correcto al elegirla desde una lista)
export const viewOfZone = (id: string, current: BodyView): BodyView => {
  const z = zoneById(id);
  if (!z) return current;
  if (z[current]) return current;
  return current === 'front' ? 'back' : 'front';
};
