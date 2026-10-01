// app.primefh.cl es la app (login/portal); www.primefh.cl es el sitio público.
// Ambos sirven el mismo build, así que la diferencia se decide por hostname.
export const IS_APP_HOST = window.location.hostname.startsWith('app.');
export const PUBLIC_SITE_URL = 'https://www.primefh.cl';
