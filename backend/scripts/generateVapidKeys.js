// Genera las claves VAPID para las notificaciones push (se hace UNA sola vez).
//
//   node scripts/generateVapidKeys.js
//
// Copia los tres valores en las variables de Railway (servicio del backend):
//   VAPID_PUBLIC_KEY   la clave pública
//   VAPID_PRIVATE_KEY  la clave privada  ← SECRETA: no la pegues en chats, correos ni archivos del repositorio
//   VAPID_SUBJECT      mailto:un-correo-de-contacto@primefh.cl
//
// Si cambias las claves después, todos los dispositivos ya suscritos dejan de recibir avisos hasta que vuelvan a
// activarlas: guárdalas en un lugar seguro (por ejemplo tu gestor de contraseñas).
import webpush from 'web-push';

const { publicKey, privateKey } = webpush.generateVAPIDKeys();

console.log('\nVAPID_PUBLIC_KEY=' + publicKey);
console.log('VAPID_PRIVATE_KEY=' + privateKey);
console.log('VAPID_SUBJECT=mailto:contacto@primefh.cl   (cámbialo por un correo real de contacto)\n');
console.log('⚠️  La clave privada es secreta. Cárgala solo en Railway.\n');
