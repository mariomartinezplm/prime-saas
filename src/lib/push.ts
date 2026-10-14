import api from '@/lib/api';
import type { APIResponse } from '@/types';

/**
 * Notificaciones push del dispositivo (Web Push).
 *
 * Distinción importante: la campanita de la app NO es una notificación del celular. Esto es lo segundo, y solo
 * existe si (1) el servidor tiene las claves cargadas, (2) el navegador lo permite y (3) la persona lo activó en
 * ESTE dispositivo. Nada aquí finge que un aviso "se entregó": el servidor solo sabe que el servicio de push del
 * navegador lo aceptó.
 */

export type PushSupport =
  | 'supported'
  | 'unsupported' // el navegador no tiene service worker / Push / Notification
  | 'needs-install'; // iPhone/iPad: solo funciona con la app instalada en la pantalla de inicio

export type PushPermission = 'default' | 'granted' | 'denied';

interface PushStatus {
  configured: boolean;
  publicKey: string | null;
  subscribedDevices: number;
}

const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isStandalone = () => window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

export function pushSupport(): PushSupport {
  const capable = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  if (capable) return 'supported';
  // En iOS el navegador normal no expone Push: hace falta instalar la app (iOS 16.4 o superior)
  if (isIOS() && !isStandalone()) return 'needs-install';
  return 'unsupported';
}

export const pushPermission = (): PushPermission => (typeof Notification === 'undefined' ? 'default' : Notification.permission);

export async function getPushStatus(): Promise<PushStatus> {
  const response = await api.get<APIResponse<PushStatus>>('/push/status');
  return response.data.data;
}

// base64url → bytes (el formato que pide pushManager.subscribe)
function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padded = base64.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(base64.length / 4) * 4, '=');
  const raw = atob(padded);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

// ¿Este dispositivo ya tiene una suscripción activa?
export async function hasLocalSubscription(): Promise<boolean> {
  if (pushSupport() !== 'supported') return false;
  const registration = await navigator.serviceWorker.ready;
  return (await registration.pushManager.getSubscription()) !== null;
}

// Debe llamarse desde un toque/clic de la persona (los navegadores lo exigen para pedir el permiso)
export async function enablePush(publicKey: string): Promise<'enabled' | 'denied'> {
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return 'denied';

  const registration = await navigator.serviceWorker.ready;
  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
    }));

  // El servidor guarda el dispositivo; si esto falla, la suscripción local no sirve de nada y se deshace
  try {
    await api.post('/push/subscribe', { subscription: subscription.toJSON() });
  } catch (error) {
    await subscription.unsubscribe().catch(() => {});
    throw error;
  }
  return 'enabled';
}

// Al cerrar sesión: este dispositivo deja de recibir los avisos de ESA persona (en un teléfono compartido, el
// siguiente usuario no debe ver los avisos del anterior). Mejor esfuerzo: nunca bloquea ni rompe el cierre de sesión.
// Recibe el token porque, cuando se llama, la sesión local ya se limpió.
export async function releasePushOnLogout(token: string): Promise<void> {
  try {
    if (pushSupport() !== 'supported') return;
    const registration = await navigator.serviceWorker.getRegistration();
    const subscription = await registration?.pushManager.getSubscription();
    if (!subscription) return;
    // fetch directo (no `api`): sus interceptores intentarían renovar la sesión ante un 401 y podrían revivirla
    const response = await fetch(`${api.defaults.baseURL}/push/unsubscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ endpoint: subscription.endpoint }),
      signal: AbortSignal.timeout(3000),
    });
    // Solo si el servidor ya lo dio de baja se quita también del navegador (si falló, queda como estaba)
    if (response.ok) await subscription.unsubscribe();
  } catch {
    // Sin red o sin suscripción: no importa, el cierre de sesión sigue
  }
}

export async function disablePush(): Promise<void> {
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;
  // Primero el servidor (si falla, no se deja al dispositivo "apagado" aquí y "encendido" allá)
  await api.post('/push/unsubscribe', { endpoint: subscription.endpoint });
  await subscription.unsubscribe();
}
