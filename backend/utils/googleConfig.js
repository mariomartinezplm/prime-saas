// Diagnóstico de la configuración de Google Calendar, sin revelar ningún valor.
// Un ID de cliente de Google tiene siempre la forma 1234567890-abc123.apps.googleusercontent.com;
// uno distinto (de ejemplo, con comillas, o pegado de otro campo) hace que Google responda
// "Error 401: invalid_client — The OAuth client was not found".
const CLIENT_ID_FORMAT = /^[0-9]+-[a-z0-9]+\.apps\.googleusercontent\.com$/;

export const clean = (value) => (typeof value === 'string' ? value.trim().replace(/^["']|["']$/g, '') : value);

// 'off'           ninguna variable de Google cargada
// 'incomplete'    falta alguna (ID, secreto, ENCRYPTION_KEY o FRONTEND_URL)
// 'bad-client-id' el ID de cliente no tiene la forma de uno real
// 'on'            todo cargado con formato válido (no prueba que Google lo reconozca)
export function googleConfigStatus(env = process.env) {
  const id = clean(env.GOOGLE_CLIENT_ID);
  const secret = clean(env.GOOGLE_CLIENT_SECRET);

  if (!id && !secret) return 'off';
  if (!id || !secret || !env.ENCRYPTION_KEY || !env.FRONTEND_URL) return 'incomplete';
  if (!CLIENT_ID_FORMAT.test(id)) return 'bad-client-id';
  return 'on';
}

export const GOOGLE_CONFIG_MESSAGES = {
  off: 'Google Calendar no está configurado en el servidor todavía.',
  incomplete: 'La configuración de Google Calendar está incompleta en el servidor.',
  'bad-client-id': 'El ID de cliente de Google configurado en el servidor no es válido.'
};
