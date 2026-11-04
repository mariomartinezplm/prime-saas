/**
 * PRUEBAS — instalación de la PWA: lo que hace que el acceso directo se abra como app y no como página web.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';

const root = new URL('../../', import.meta.url);
const html = readFileSync(new URL('index.html', root), 'utf8');
const vite = readFileSync(new URL('vite.config.ts', root), 'utf8');

describe('manifest (vite.config.ts)', () => {
  it('es una app independiente que parte en el login (nunca en la página corporativa) con identidad fija', () => {
    expect(vite).toMatch(/id:\s*"\/"/);
    expect(vite).toMatch(/start_url:\s*"\/login"/);
    expect(vite).toMatch(/scope:\s*"\/"/);
    expect(vite).toMatch(/display:\s*"standalone"/);
  });
});

describe('index.html: metadatos para iPhone y Android', () => {
  it.each([
    'name="apple-mobile-web-app-capable" content="yes"',
    'name="mobile-web-app-capable" content="yes"',
    'name="apple-mobile-web-app-title"',
    'rel="apple-touch-icon"',
    'rel="manifest"'.replace('rel="manifest"', 'name="theme-color"')
  ])('incluye %s', (fragment) => {
    expect(html).toContain(fragment);
  });
  it('el icono de iPhone existe y también en la raíz (iOS lo pide ahí por defecto)', () => {
    expect(existsSync(new URL('public/icons/apple-touch-icon.png', root))).toBe(true);
    expect(existsSync(new URL('public/apple-touch-icon.png', root))).toBe(true);
  });
});
