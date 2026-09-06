/**
 * Limpieza de operadores de MongoDB en lo que llega del exterior
 * (Paso 06 de BLUEPRINT.md).
 *
 * EL PROBLEMA: MongoDB entiende ciertas claves como órdenes, no como datos.
 * Si alguien envía  ?status[$ne]=cancelada  el servidor recibe el objeto
 * { status: { $ne: 'cancelada' } }, que significa "status distinto de
 * cancelada" — y así se saltan filtros. Con { $gt: '' } se puede llegar a
 * hacer que una consulta devuelva registros que no corresponden.
 *
 * LA SOLUCIÓN: antes de tocar la base de datos, se eliminan las claves que
 * empiezan con "$" (operadores) o que contienen "." (rutas internas). Los
 * valores no se tocan: "$100" como precio o "a.b@correo.cl" siguen intactos,
 * porque el peligro está en las CLAVES, no en el contenido.
 *
 * Se escribió a mano en vez de usar express-mongo-sanitize porque ese paquete
 * lleva años sin mantenimiento y se rompe con Express 5.
 */

const esPeligrosa = (clave) => clave.startsWith('$') || clave.includes('.');

const limpiar = (valor, quitadas, profundidad = 0) => {
  // Tope de profundidad: evita que un objeto anidado a propósito consuma CPU
  if (valor === null || typeof valor !== 'object' || profundidad > 10) return valor;

  if (Array.isArray(valor)) {
    return valor.map((item) => limpiar(item, quitadas, profundidad + 1));
  }

  for (const clave of Object.keys(valor)) {
    if (esPeligrosa(clave)) {
      delete valor[clave];
      quitadas.push(clave);
    } else {
      const hijo = valor[clave];
      limpiar(hijo, quitadas, profundidad + 1);

      // Si un objeto se quedó VACÍO porque todo su contenido eran operadores,
      // era una inyección completa (?role[$ne]=x → role: {}). Se descarta la
      // clave entera: dejar { } ahí haría que Mongo intentara comparar contra
      // un objeto vacío y respondiera un error 500 en vez de ignorar el filtro.
      if (
        hijo && typeof hijo === 'object' && !Array.isArray(hijo) &&
        Object.keys(hijo).length === 0
      ) {
        delete valor[clave];
      }
    }
  }
  return valor;
};

export const sanitizeMongo = (req, res, next) => {
  const quitadas = [];

  // req.query y req.params son objetos normales en Express 4, así que se pueden
  // limpiar en el sitio. Si algún día se migra a Express 5, req.query pasa a ser
  // de solo lectura y habría que reasignarlo con Object.defineProperty.
  for (const contenedor of [req.body, req.query, req.params]) {
    if (contenedor) limpiar(contenedor, quitadas);
  }

  if (quitadas.length > 0) {
    // Se registra el intento, pero NUNCA el valor (podría traer datos del paciente)
    console.warn(
      `[sanitize] Se descartaron claves con operadores en ${req.method} ${req.originalUrl}: ${quitadas.join(', ')}`
    );
  }

  next();
};

/**
 * Escapa un texto para usarlo dentro de una expresión regular.
 *
 * Sin esto, buscar "(" en el listado de pacientes revienta la consulta, y un
 * texto como "(a+)+$" puede colgar el servidor durante segundos (un patrón que
 * tarda un tiempo desproporcionado en evaluarse).
 */
export const escapeRegex = (texto = '') =>
  String(texto).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Escapa texto que se va a incrustar dentro de un HTML (correos).
 *
 * Los correos que envía el sistema interpolan datos escritos por personas
 * (motivo de una cancelación, notas de una cita). Sin escapar, alguien podría
 * dejar etiquetas HTML o un script en esas notas y ejecutarlo en el correo de
 * quien lo abra.
 */
export const escapeHtml = (texto = '') =>
  String(texto)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
