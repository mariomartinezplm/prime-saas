// Si una petición nunca responde, la pantalla no debe quedar esperando para siempre: pasado el plazo se trata como un error
// (con su aviso y su «Reintentar»). No cancela la petición; solo deja de esperarla.
export const QUERY_TIMEOUT_MS = 20_000;

export class QueryTimeoutError extends Error {
  constructor() {
    super('La consulta tardó demasiado');
    this.name = 'QueryTimeoutError';
  }
}

export const withTimeout = <T>(promise: Promise<T>, ms: number = QUERY_TIMEOUT_MS): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new QueryTimeoutError()), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
