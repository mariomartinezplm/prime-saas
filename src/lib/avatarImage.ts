// Foto de perfil: reglas del archivo elegido y el encuadre del recorte circular. Funciones puras (sin navegador) para poder probarlas.

export const AVATAR_ACCEPT = 'image/jpeg,image/png,image/webp';
export const AVATAR_MAX_INPUT_BYTES = 25 * 1024 * 1024; // lo que el celular puede entregar; después se reduce a ~60 KB
export const AVATAR_OUTPUT_SIDE = 512;
export const AVATAR_VIEW_SIDE = 256;
export const AVATAR_MAX_ZOOM = 3;

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

// Mensaje para la persona si el archivo no sirve; undefined si está bien.
export function avatarFileProblem(file: { type: string; size: number }): string | undefined {
  if (!ALLOWED_TYPES.includes(file.type)) return 'Ese archivo no es una foto válida. Elige una foto JPG, PNG o WebP.';
  if (file.size > AVATAR_MAX_INPUT_BYTES) return 'La foto es demasiado pesada. Elige una de menos de 25 MB.';
  if (file.size === 0) return 'Ese archivo está vacío. Elige otra foto.';
  return undefined;
}

export interface CropState {
  zoom: number; // 1 = la imagen justo cubre el círculo; hasta AVATAR_MAX_ZOOM
  x: number; // desplazamiento en píxeles de la vista (0 = centrada)
  y: number;
}

// Tamaño con que se dibuja la imagen en la vista (cubre el cuadrado y luego se amplía con el zoom)
export function drawnSize(imageW: number, imageH: number, zoom: number, view = AVATAR_VIEW_SIDE) {
  const cover = Math.max(view / imageW, view / imageH);
  return { w: imageW * cover * zoom, h: imageH * cover * zoom };
}

// El desplazamiento nunca deja ver el fondo: la imagen siempre cubre el círculo.
export function clampCrop(state: CropState, imageW: number, imageH: number, view = AVATAR_VIEW_SIDE): CropState {
  const zoom = Math.min(AVATAR_MAX_ZOOM, Math.max(1, Number.isFinite(state.zoom) ? state.zoom : 1));
  const { w, h } = drawnSize(imageW, imageH, zoom, view);
  const maxX = Math.max(0, (w - view) / 2);
  const maxY = Math.max(0, (h - view) / 2);
  return { zoom, x: Math.min(maxX, Math.max(-maxX, state.x || 0)), y: Math.min(maxY, Math.max(-maxY, state.y || 0)) };
}

// Esquina superior izquierda de la imagen dentro de un lienzo cuadrado de lado `side` (para la vista y para la salida)
export function drawRect(state: CropState, imageW: number, imageH: number, side: number) {
  const k = side / AVATAR_VIEW_SIDE;
  const { w, h } = drawnSize(imageW, imageH, state.zoom);
  return { dx: (AVATAR_VIEW_SIDE - w) / 2 * k + state.x * k, dy: (AVATAR_VIEW_SIDE - h) / 2 * k + state.y * k, dw: w * k, dh: h * k };
}
