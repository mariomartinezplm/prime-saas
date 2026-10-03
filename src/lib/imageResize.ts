const MAX_SIDE = 1600;
const JPEG_QUALITY = 0.85;

export class ImageReadError extends Error {}

// Reduce la foto antes de subirla (las del celular pesan 5-8 MB) y la reescribe
// como JPEG: de paso se pierden los metadatos EXIF, incluida la ubicación GPS.
export async function prepareImageForUpload(file: File): Promise<File> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new ImageReadError('No se pudo leer la imagen. Prueba con una foto JPG o PNG.'));
      image.src = url;
    });

    const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);

    const ctx = canvas.getContext('2d');
    if (!ctx) throw new ImageReadError('Tu navegador no pudo procesar la imagen.');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY));
    if (!blob) throw new ImageReadError('No se pudo preparar la imagen para subirla.');

    return new File([blob], 'foto.jpg', { type: 'image/jpeg' });
  } finally {
    URL.revokeObjectURL(url);
  }
}
