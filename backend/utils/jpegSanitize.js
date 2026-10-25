// Limpieza de una foto de perfil JPEG sin librerías de imágenes: lee los segmentos del archivo, quita todo lo que no es imagen
// (EXIF con ubicación y datos del teléfono en APP1, comentarios, perfiles de color y otros APPn) y devuelve las medidas.
// La app envía siempre un JPEG ya recortado y redimensionado por el navegador; esto es la segunda barrera, en el servidor.

export class JpegError extends Error {}

const SOF_MARKERS = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);
const isStandalone = (marker) => marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8);

export function sanitizeJpeg(buffer, { minSide = 64, maxSide = 1024 } = {}) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) throw new JpegError('No es una imagen JPEG');

  const kept = [buffer.subarray(0, 2)];
  let pos = 2;
  let width = 0;
  let height = 0;
  let components = 0;
  let sawScan = false;

  while (pos < buffer.length && !sawScan) {
    if (buffer[pos] !== 0xff) throw new JpegError('La imagen está dañada');
    while (buffer[pos] === 0xff) pos += 1; // relleno
    const marker = buffer[pos];
    pos += 1;
    if (marker === undefined || marker === 0x00) throw new JpegError('La imagen está dañada');
    if (marker === 0xd9) throw new JpegError('La imagen no tiene datos');
    if (isStandalone(marker)) {
      kept.push(Buffer.from([0xff, marker]));
      continue;
    }

    if (pos + 2 > buffer.length) throw new JpegError('La imagen está dañada');
    const length = buffer.readUInt16BE(pos);
    if (length < 2 || pos + length > buffer.length) throw new JpegError('La imagen está dañada');
    const segment = buffer.subarray(pos - 2, pos + length); // marcador + longitud + contenido
    const body = buffer.subarray(pos + 2, pos + length);

    if (SOF_MARKERS.has(marker)) {
      if (body.length < 6) throw new JpegError('La imagen está dañada');
      height = body.readUInt16BE(1);
      width = body.readUInt16BE(3);
      components = body[5];
    }

    // Se quedan solo los segmentos que describen la imagen; APP0 (JFIF) es inofensivo. Todo APP1…APP15 y COM se descarta.
    const isMetadata = (marker >= 0xe1 && marker <= 0xef) || marker === 0xfe;
    if (!isMetadata) kept.push(segment);

    pos += length;
    if (marker === 0xda) {
      sawScan = true;
      kept.push(buffer.subarray(pos)); // datos de la imagen hasta el final, tal cual
    }
  }

  if (!sawScan || !width || !height) throw new JpegError('La imagen está dañada');
  if (components !== 1 && components !== 3) throw new JpegError('Formato de color no permitido');
  if (width < minSide || height < minSide) throw new JpegError('La foto es demasiado pequeña');
  if (width > maxSide || height > maxSide) throw new JpegError('La foto es demasiado grande');

  const clean = Buffer.concat(kept);
  if (clean.length < 4 || clean[clean.length - 2] !== 0xff || clean[clean.length - 1] !== 0xd9) throw new JpegError('La imagen está dañada');
  return { buffer: clean, width, height };
}
