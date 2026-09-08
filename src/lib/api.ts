import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

// Configuración base de Axios
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// SEGURIDAD (Paso 10 de BLUEPRINT.md): sin withCredentials, el navegador nunca
// manda la cookie de refresh (HttpOnly, la puso el backend en el Paso 08) de
// vuelta al servidor. Es lo que sostiene la sesión de 30 días.
const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Access token en memoria, nunca en localStorage: cualquier script que corra
// en la página (una vulnerabilidad de inyección, por mínima que sea) puede
// leer localStorage, pero no una variable de módulo. Vive aquí (fuera de
// React) porque el interceptor de abajo necesita leerlo de forma síncrona.
// ─────────────────────────────────────────────────────────────────────────────
let accessToken: string | null = null;

export const setAccessToken = (token: string | null): void => {
  accessToken = token;
};

export const getAccessToken = (): string | null => accessToken;

// Promesa compartida: si varias peticiones fallan con 401 casi al mismo
// tiempo (ej. la página dispara 5 requests en paralelo con el access ya
// vencido), solo debe salir UNA llamada de red a /auth/refresh — las demás
// esperan este mismo resultado en vez de disparar cada una la suya.
let refreshPromise: Promise<string> | null = null;

export const refreshAccessToken = async (): Promise<string> => {
  if (!refreshPromise) {
    // axios "crudo", no la instancia `api`: si se usara `api`, una respuesta
    // 401 de este mismo POST re-disparía el interceptor de abajo sobre sí
    // mismo.
    refreshPromise = axios
      .post(`${API_URL}/auth/refresh`, {}, { withCredentials: true })
      .then((res) => {
        const newToken = res.data.data.token;
        setAccessToken(newToken);
        return newToken;
      })
      .finally(() => {
        // Libera el turno para el próximo ciclo de expiración (minutos después)
        refreshPromise = null;
      });
  }
  return refreshPromise;
};

// Rutas que nunca deben disparar un refresh sobre sí mismas si devuelven 401
// (evita un loop infinito): un 401 en el propio /refresh significa que la
// sesión ya no es válida, no que haya que reintentarla.
const EXCLUDED_FROM_REFRESH = ['/auth/refresh', '/auth/login', '/auth/logout'];
const isExcludedFromRefresh = (url?: string): boolean =>
  !!url && EXCLUDED_FROM_REFRESH.some((p) => url.includes(p));

// Interceptor de request: adjunta el access token vigente a cada petición
api.interceptors.request.use(
  (config) => {
    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Interceptor de response: ante un 401, intenta renovar la sesión UNA vez y
// reintenta la petición original — el usuario nunca ve el corte de 1h del
// access token, solo lo nota si la sesión de 30 días (la cookie) ya venció.
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as
      | (InternalAxiosRequestConfig & { _retry?: boolean })
      | undefined;

    if (
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      !isExcludedFromRefresh(originalRequest.url)
    ) {
      originalRequest._retry = true; // si el reintento vuelve a dar 401, no se reintenta de nuevo
      try {
        const newToken = await refreshAccessToken();
        originalRequest.headers = originalRequest.headers ?? {};
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        // La sesión de 30 días también venció (o fue revocada): sin sesión
        // que renovar, toca volver a pedir la contraseña.
        setAccessToken(null);
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
        return Promise.reject(refreshError);
      }
    }
    return Promise.reject(error);
  }
);

export default api;
