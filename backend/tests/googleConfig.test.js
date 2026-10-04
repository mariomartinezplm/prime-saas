/**
 * PRUEBAS — diagnóstico de la configuración de Google Calendar (cálculo puro).
 */

import { describe, it, expect } from 'vitest';
import { googleConfigStatus, clean } from '../utils/googleConfig.js';

const completo = () => ({
  GOOGLE_CLIENT_ID: '123456789012-abc123def456.apps.googleusercontent.com',
  GOOGLE_CLIENT_SECRET: 'GOCSPX-xxxxxxxx',
  ENCRYPTION_KEY: 'a'.repeat(64),
  FRONTEND_URL: 'https://app.primefh.cl'
});

describe('googleConfigStatus', () => {
  it('todo cargado y con formato válido: on', () => {
    expect(googleConfigStatus(completo())).toBe('on');
  });

  it('sin ninguna variable de Google: off', () => {
    expect(googleConfigStatus({})).toBe('off');
  });

  it('falta el secreto, la clave de cifrado o la URL del frontend: incomplete', () => {
    for (const falta of ['GOOGLE_CLIENT_SECRET', 'ENCRYPTION_KEY', 'FRONTEND_URL', 'GOOGLE_CLIENT_ID']) {
      const env = completo();
      delete env[falta];
      expect(googleConfigStatus(env)).toBe('incomplete');
    }
  });

  it('un ID de cliente que no tiene la forma de uno real: bad-client-id (el caso del error 401 invalid_client)', () => {
    for (const malo of ['tu_client_id_aqui', 'abc.apps.googleusercontent.com', 'GOCSPX-este-es-el-secreto', '123-abc.googleusercontent.com']) {
      expect(googleConfigStatus({ ...completo(), GOOGLE_CLIENT_ID: malo })).toBe('bad-client-id');
    }
  });

  it('espacios, saltos de línea o comillas pegadas por error no impiden validar', () => {
    const id = '123456789012-abc123def456.apps.googleusercontent.com';
    expect(googleConfigStatus({ ...completo(), GOOGLE_CLIENT_ID: `  ${id}\n` })).toBe('on');
    expect(googleConfigStatus({ ...completo(), GOOGLE_CLIENT_ID: `"${id}"` })).toBe('on');
    expect(clean(`"${id}" `)).toBe(id);
  });
});
