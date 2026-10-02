// Detecta el tipo real de un archivo por sus primeros bytes ("magic bytes").
// La extensión y el Content-Type los controla quien sube el archivo, así que
// no sirven como prueba: un .exe renombrado a .pdf pasaría un chequeo por nombre.
const SIGNATURES = [
  { mimeType: 'application/pdf', ext: 'pdf', bytes: [0x25, 0x50, 0x44, 0x46, 0x2d] }, // %PDF-
  { mimeType: 'image/jpeg', ext: 'jpg', bytes: [0xff, 0xd8, 0xff] },
  { mimeType: 'image/png', ext: 'png', bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] }
];

export function detectFileType(buffer) {
  if (!Buffer.isBuffer(buffer)) return null;

  for (const { mimeType, ext, bytes } of SIGNATURES) {
    if (buffer.length >= bytes.length && bytes.every((byte, i) => buffer[i] === byte)) {
      return { mimeType, ext };
    }
  }
  return null;
}
