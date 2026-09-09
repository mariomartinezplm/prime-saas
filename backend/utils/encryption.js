import crypto from 'crypto';

// Cifra los tokens de Google Calendar en reposo (Paso 28 de BLUEPRINT.md) —
// son credenciales de acceso a datos de terceros, se guardan como cualquier
// otro secreto: nunca en texto plano en la base de datos.
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // recomendado para GCM

function getKey() {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    throw new Error('Falta ENCRYPTION_KEY en las variables de entorno');
  }
  // Se espera una clave de 32 bytes en hex (64 caracteres) o base64.
  const buffer = /^[0-9a-f]{64}$/i.test(key) ? Buffer.from(key, 'hex') : Buffer.from(key, 'base64');
  if (buffer.length !== 32) {
    throw new Error('ENCRYPTION_KEY debe representar exactamente 32 bytes (hex de 64 caracteres o base64)');
  }
  return buffer;
}

// Devuelve un único string "iv:authTag:ciphertext" (todo en base64) — cómodo
// para guardar en un solo campo String del modelo.
export function encrypt(plaintext) {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [iv.toString('base64'), authTag.toString('base64'), ciphertext.toString('base64')].join(':');
}

export function decrypt(payload) {
  const key = getKey();
  const [ivB64, authTagB64, ciphertextB64] = payload.split(':');
  if (!ivB64 || !authTagB64 || !ciphertextB64) {
    throw new Error('Payload cifrado con formato inválido');
  }

  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(authTagB64, 'base64'));

  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertextB64, 'base64')),
    decipher.final()
  ]);

  return plaintext.toString('utf8');
}
