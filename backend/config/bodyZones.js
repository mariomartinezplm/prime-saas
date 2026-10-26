/**
 * ZONAS DEL CUERPO (mapa corporal)
 *
 * Una sola lista para todo: el registro de dolor (EVA), los objetivos de dolor y el mapa que ve la persona. Los `id` son
 * estables (se guardan en cada registro): se puede cambiar un nombre, NUNCA un id. «Izquierdo/derecho» es siempre el lado
 * de la PERSONA, no el de quien mira el dibujo.
 *
 *   kind: 'joint' (articulación) | 'muscle' (músculo o segmento) | 'region' (zona general)
 *   perimeter: campos de Mediciones (perimeters.*) que se pueden medir en esa zona
 *   legacy: ya no se dibuja en el mapa, pero registros antiguos con ese id siguen siendo válidos
 */
const pair = (base, labelL, labelR, kind, extra = {}) => [
  { id: `${base.l}`, label: labelL, kind, side: 'left', ...extra.left },
  { id: `${base.r}`, label: labelR, kind, side: 'right', ...extra.right },
];

export const BODY_ZONES = [
  { id: 'cabeza', label: 'Cabeza', kind: 'region' },
  { id: 'cuello', label: 'Cuello', kind: 'region' },
  ...pair({ l: 'hombro-izquierdo', r: 'hombro-derecho' }, 'Hombro izquierdo', 'Hombro derecho', 'joint', { left: { perimeter: [] }, right: { perimeter: [] } }),
  ...pair({ l: 'brazo-izquierdo', r: 'brazo-derecho' }, 'Brazo izquierdo', 'Brazo derecho', 'muscle', { left: { perimeter: ['bicepFlexedLeft'] }, right: { perimeter: ['bicepFlexedRight'] } }),
  ...pair({ l: 'codo-izquierdo', r: 'codo-derecho' }, 'Codo izquierdo', 'Codo derecho', 'joint'),
  ...pair({ l: 'antebrazo-izquierdo', r: 'antebrazo-derecho' }, 'Antebrazo izquierdo', 'Antebrazo derecho', 'muscle', { left: { perimeter: ['forearmLeft'] }, right: { perimeter: ['forearmRight'] } }),
  ...pair({ l: 'muneca-izquierda', r: 'muneca-derecha' }, 'Muñeca izquierda', 'Muñeca derecha', 'joint'),
  ...pair({ l: 'mano-izquierda', r: 'mano-derecha' }, 'Mano izquierda', 'Mano derecha', 'region'),
  { id: 'pecho', label: 'Pecho', kind: 'muscle', perimeter: ['chest'] },
  { id: 'abdomen', label: 'Abdomen', kind: 'region', perimeter: ['waist'] },
  { id: 'espalda-alta', label: 'Espalda alta', kind: 'region' },
  { id: 'espalda-media', label: 'Espalda media', kind: 'region' },
  { id: 'espalda-baja', label: 'Espalda baja (lumbar)', kind: 'region' },
  ...pair({ l: 'cadera-izquierda', r: 'cadera-derecha' }, 'Cadera izquierda', 'Cadera derecha', 'joint'),
  ...pair({ l: 'gluteo-izquierdo', r: 'gluteo-derecho' }, 'Glúteo izquierdo', 'Glúteo derecho', 'muscle', { left: { perimeter: ['hips'] }, right: { perimeter: ['hips'] } }),
  ...pair({ l: 'muslo-anterior-izquierdo', r: 'muslo-anterior-derecho' }, 'Muslo izquierdo (adelante)', 'Muslo derecho (adelante)', 'muscle', { left: { perimeter: ['thighLeft'] }, right: { perimeter: ['thighRight'] } }),
  ...pair({ l: 'muslo-posterior-izquierdo', r: 'muslo-posterior-derecho' }, 'Muslo izquierdo (atrás)', 'Muslo derecho (atrás)', 'muscle', { left: { perimeter: ['thighLeft'] }, right: { perimeter: ['thighRight'] } }),
  ...pair({ l: 'rodilla-izquierda', r: 'rodilla-derecha' }, 'Rodilla izquierda', 'Rodilla derecha', 'joint'),
  ...pair({ l: 'tibia-izquierda', r: 'tibia-derecha' }, 'Tibia izquierda', 'Tibia derecha', 'muscle'),
  ...pair({ l: 'pantorrilla-izquierda', r: 'pantorrilla-derecha' }, 'Pantorrilla izquierda', 'Pantorrilla derecha', 'muscle', { left: { perimeter: ['calfLeft'] }, right: { perimeter: ['calfRight'] } }),
  ...pair({ l: 'tobillo-izquierdo', r: 'tobillo-derecho' }, 'Tobillo izquierdo', 'Tobillo derecho', 'joint'),
  ...pair({ l: 'dorso-pie-izquierdo', r: 'dorso-pie-derecho' }, 'Dorso del pie izquierdo', 'Dorso del pie derecho', 'region'),
  ...pair({ l: 'planta-izquierda', r: 'planta-derecha' }, 'Planta izquierda', 'Planta derecha', 'region'),
];

// Ids que ya existían antes del mapa nuevo: siguen siendo válidos en registros y objetivos antiguos
export const LEGACY_ZONES = [
  { id: 'lumbar', label: 'Lumbar', kind: 'region', legacy: true },
  { id: 'pie-izquierdo', label: 'Pie izquierdo', kind: 'region', side: 'left', legacy: true },
  { id: 'pie-derecho', label: 'Pie derecho', kind: 'region', side: 'right', legacy: true },
  { id: 'otro', label: 'Otra zona', kind: 'region', legacy: true },
];

export const ALL_BODY_ZONES = [...BODY_ZONES, ...LEGACY_ZONES];
export const BODY_ZONE_IDS = ALL_BODY_ZONES.map((z) => z.id);
export const bodyZoneLabel = (id) => ALL_BODY_ZONES.find((z) => z.id === id)?.label ?? id;
