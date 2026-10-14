/**
 * PRUEBAS — "citas desde hoy" y el día de Chile (investigación del posible error de UTC).
 *
 * Contexto: el servidor guarda el DÍA de una cita como medianoche UTC ("2026-10-14T00:00:00.000Z") y filtra con
 * date >= from. El frontend pedía las próximas citas con `new Date().toISOString().split('T')[0]`, que es el día en
 * UTC: desde las 21:00 (verano) o las 20:00 (invierno) hora de Chile ya es "mañana" y las citas que quedaban HOY
 * quedaban fuera de la consulta. Ahora usa el día local (`todayLocal`).
 *
 * Mismo patrón que el resto de backend/tests/ (vitest). Se fija la zona horaria de Chile para esta prueba: así se
 * reproduce el caso real aunque la máquina esté en otra zona.
 */

import { describe, it, expect, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

process.env.TZ = 'America/Santiago';

const { todayLocal } = await import('../../src/lib/evolutionDate.ts');

const CITA_DE_HOY = (dia) => new Date(dia); // cómo guarda el servidor el día: new Date('yyyy-MM-dd') = medianoche UTC
// Lo que hace el servidor con el filtro: la cita entra si date >= from (from = 'yyyy-MM-dd' leído como medianoche UTC)
const entraEnElFiltro = (citaDia, from) => CITA_DE_HOY(citaDia) >= new Date(from);

// El cálculo VIEJO, para dejar documentado el error
const diaViejo = (now) => now.toISOString().split('T')[0];

describe('día de hoy para pedir las próximas citas', () => {
  afterEach(() => {
    process.env.TZ = 'America/Santiago';
  });

  it('la zona horaria de la prueba es la de Chile (si no, la prueba no reproduce nada)', () => {
    // 2026-10-14 12:00 en Chile (verano, UTC-3) = 15:00 UTC
    expect(new Date('2026-10-14T15:00:00Z').getHours()).toBe(12);
  });

  it('REPRODUCE EL ERROR: de noche (21:00 en verano) el cálculo viejo da el día de MAÑANA y deja fuera las citas de hoy', () => {
    const ahora = new Date('2026-10-15T00:30:00Z'); // 21:30 del 14 de octubre en Chile
    expect(diaViejo(ahora)).toBe('2026-10-15');
    expect(entraEnElFiltro('2026-10-14', diaViejo(ahora))).toBe(false); // la cita de hoy NO entra
  });

  it('REPRODUCE EL ERROR en invierno: desde las 20:00 (UTC-4) pasa lo mismo', () => {
    const ahora = new Date('2026-07-15T00:30:00Z'); // 20:30 del 14 de julio en Chile
    expect(diaViejo(ahora)).toBe('2026-07-15');
    expect(entraEnElFiltro('2026-07-14', diaViejo(ahora))).toBe(false);
  });

  it('CORRECCIÓN: todayLocal da el día de Chile y la cita de hoy sí entra', () => {
    const ahora = new Date('2026-10-15T00:30:00Z');
    expect(todayLocal(ahora)).toBe('2026-10-14');
    expect(entraEnElFiltro('2026-10-14', todayLocal(ahora))).toBe(true);
    // y la de mañana también entra (se piden las citas "desde hoy")
    expect(entraEnElFiltro('2026-10-15', todayLocal(ahora))).toBe(true);
    // una cita de ayer no
    expect(entraEnElFiltro('2026-10-13', todayLocal(ahora))).toBe(false);
  });

  it('no cambia lo que ya andaba bien: de día, el viejo y el nuevo cálculo coinciden', () => {
    for (const ahora of ['2026-10-14T13:00:00Z', '2026-10-14T20:59:00Z', '2026-07-14T14:00:00Z', '2026-07-14T23:59:00Z']) {
      expect(todayLocal(new Date(ahora))).toBe(diaViejo(new Date(ahora)));
    }
  });

  it('bordes del día: justo antes y después de medianoche en Chile', () => {
    expect(todayLocal(new Date('2026-10-15T02:59:00Z'))).toBe('2026-10-14'); // 23:59 en Chile
    expect(todayLocal(new Date('2026-10-15T03:00:00Z'))).toBe('2026-10-15'); // 00:00 del día siguiente
    expect(todayLocal(new Date('2026-10-14T03:00:00Z'))).toBe('2026-10-14'); // 00:00 en Chile
  });

  it('sin argumento usa la hora actual (compatible con los usos anteriores)', () => {
    expect(todayLocal()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('guarda contra la vuelta atrás', () => {
  it('appointmentService no vuelve a calcular "hoy" con toISOString (día en UTC)', () => {
    const aqui = path.dirname(fileURLToPath(import.meta.url));
    const fuente = fs.readFileSync(path.join(aqui, '../../src/services/appointmentService.ts'), 'utf-8');
    expect(fuente).not.toMatch(/toISOString\(\)\s*\.\s*split\(/);
    expect(fuente).toMatch(/todayLocal\(\)/);
  });
});
