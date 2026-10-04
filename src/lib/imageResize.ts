const MAX_SIDE = 1600;
const PREVIEW_SIDE = 600;
const JPEG_QUALITY = 0.85;

export class ImageReadError extends Error {}

export interface PreparedImage {
  file: File;
  // Miniatura como data:, que la política de seguridad de la app sí permite
  previewUrl: string;
}

const isHeic = (file: File) =>
  /image\/hei[cf]/i.test(file.type) || /\.hei[cf]$/i.test(file.name);

const HEIC_MESSAGE =
  'Esta foto está en formato HEIC y tu navegador no puede leerla. En iPhone: Ajustes > Cámara > Formatos > "Más compatible". También sirve subir una captura de pantalla de la foto.';
const GENERIC_MESSAGE = 'No se pudo leer la imagen. Prueba con otra foto.';

// La política de seguridad de la app no permite imágenes blob:, así que la foto no se
// puede cargar con URL.createObjectURL. Se decodifica con createImageBitmap, que no
// pasa por esa regla (y respeta la orientación del celular); si el navegador no lo
// tiene, se lee como data: con FileReader.
async function decode(file: File): Promise<{ source: CanvasImageSource; width: number; height: number; release: () => void }> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file);
      return { source: bitmap, width: bitmap.width, height: bitmap.height, release: () => bitmap.close() };
    } catch {
      // se intenta el camino alternativo
    }
  }

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new ImageReadError(GENERIC_MESSAGE));
    reader.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new ImageReadError(isHeic(file) ? HEIC_MESSAGE : GENERIC_MESSAGE));
    image.src = dataUrl;
  });
  return { source: img, width: img.naturalWidth, height: img.naturalHeight, release: () => {} };
}

function drawScaled(source: CanvasImageSource, width: number, height: number, maxSide: number): HTMLCanvasElement {
  const scale = Math.min(1, maxSide / Math.max(width, height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new ImageReadError('Tu navegador no pudo procesar la imagen.');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
}

// Reduce la foto antes de subirla (las del celular pesan 5-8 MB) y la reescribe
// como JPEG: de paso se pierden los metadatos EXIF, incluida la ubicación GPS.
export async function prepareImageForUpload(file: File): Promise<PreparedImage> {
  let decoded;
  try {
    decoded = await decode(file);
  } catch (err) {
    if (err instanceof ImageReadError) throw err;
    throw new ImageReadError(isHeic(file) ? HEIC_MESSAGE : GENERIC_MESSAGE);
  }

  try {
    if (!decoded.width || !decoded.height) {
      throw new ImageReadError(isHeic(file) ? HEIC_MESSAGE : GENERIC_MESSAGE);
    }

    const canvas = drawScaled(decoded.source, decoded.width, decoded.height, MAX_SIDE);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY));
    if (!blob) throw new ImageReadError('No se pudo preparar la imagen para subirla.');

    const thumb = drawScaled(canvas, canvas.width, canvas.height, PREVIEW_SIDE);

    return {
      file: new File([blob], 'foto.jpg', { type: 'image/jpeg' }),
      previewUrl: thumb.toDataURL('image/jpeg', 0.7),
    };
  } finally {
    decoded.release();
  }
}
