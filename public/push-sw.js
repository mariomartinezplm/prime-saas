/* Notificaciones push de Prime F&H.
 *
 * Este archivo lo carga el service worker principal (vite.config.ts → workbox.importScripts). Solo muestra el
 * aviso y, al tocarlo, abre la app en la ruta indicada. El servidor envía únicamente un título y un texto
 * GENÉRICOS (se ven en la pantalla bloqueada) y una ruta interna: nunca datos de salud.
 */

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (error) {
    data = {};
  }

  const title = data.title || 'Prime F&H';
  const options = {
    body: data.body || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    // Mismo `tag` = un aviso reemplaza al anterior del mismo tipo en vez de apilarse
    tag: data.tag || undefined,
    data: { url: typeof data.url === 'string' && data.url.startsWith('/app') ? data.url : '/app/dashboard' }
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/app/dashboard';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      // Si la app ya está abierta, se reutiliza esa ventana
      for (const client of windows) {
        if (new URL(client.url).origin === self.location.origin && 'focus' in client) {
          return client.focus().then((focused) => ('navigate' in focused ? focused.navigate(url) : undefined));
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
