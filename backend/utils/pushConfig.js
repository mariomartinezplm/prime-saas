// Diagnóstico de la configuración de notificaciones push (Web Push + VAPID), sin revelar ningún valor.
//
// 'off'         no hay ninguna variable VAPID cargada
// 'incomplete'  falta alguna, o tiene un formato inválido
// 'on'          clave pública, clave privada y contacto cargados con formato válido
//               (no prueba que un navegador las acepte; eso solo se ve al enviar)
const b64url = /^[A-Za-z0-9_-]+$/;

const clean = (value) => (typeof value === 'string' ? value.trim().replace(/^["']|["']$/g, '') : value);

export function getVapidConfig(env = process.env) {
  return {
    publicKey: clean(env.VAPID_PUBLIC_KEY),
    privateKey: clean(env.VAPID_PRIVATE_KEY),
    subject: clean(env.VAPID_SUBJECT)
  };
}

export function pushConfigStatus(env = process.env) {
  const { publicKey, privateKey, subject } = getVapidConfig(env);
  if (!publicKey && !privateKey && !subject) return 'off';
  if (!publicKey || !privateKey || !subject) return 'incomplete';
  // Una clave pública VAPID son 65 bytes (87 caracteres base64url); la privada, 32 bytes (43)
  if (!b64url.test(publicKey) || publicKey.length !== 87) return 'incomplete';
  if (!b64url.test(privateKey) || privateKey.length !== 43) return 'incomplete';
  if (!/^(mailto:[^\s@]+@[^\s@]+\.[^\s@]+|https:\/\/\S+)$/.test(subject)) return 'incomplete';
  return 'on';
}

export const isPushConfigured = (env = process.env) => pushConfigStatus(env) === 'on';
