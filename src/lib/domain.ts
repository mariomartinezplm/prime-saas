const LANDING_HOSTS = ['primefh.cl', 'www.primefh.cl'];
const APP_URL = 'https://app.primefh.cl';

export const isLandingDomain = () => LANDING_HOSTS.includes(window.location.hostname);

export const redirectToApp = (path: string) => {
  window.location.href = `${APP_URL}${path}`;
};
