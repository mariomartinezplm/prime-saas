/**
 * PRUEBAS — foto de perfil, lado del navegador (src/lib/avatarImage.ts): qué archivos se aceptan y cómo se encuadra el recorte.
 */
import { describe, it, expect } from 'vitest';

const { avatarFileProblem, clampCrop, drawRect, drawnSize, AVATAR_MAX_ZOOM, AVATAR_MAX_INPUT_BYTES, AVATAR_VIEW_SIDE, AVATAR_OUTPUT_SIDE } = await import('../../src/lib/avatarImage.ts');

describe('archivo elegido', () => {
  it('acepta JPG, PNG y WebP normales', () => {
    for (const type of ['image/jpeg', 'image/png', 'image/webp']) expect(avatarFileProblem({ type, size: 2_000_000 })).toBeUndefined();
  });

  it('rechaza lo que no es una foto, lo vacío y lo demasiado pesado, con un mensaje claro', () => {
    expect(avatarFileProblem({ type: 'application/pdf', size: 1000 })).toMatch(/no es una foto válida/);
    expect(avatarFileProblem({ type: 'application/x-msdownload', size: 1000 })).toMatch(/no es una foto válida/);
    expect(avatarFileProblem({ type: 'image/gif', size: 1000 })).toMatch(/no es una foto válida/);
    expect(avatarFileProblem({ type: 'image/jpeg', size: 0 })).toMatch(/vacío/);
    expect(avatarFileProblem({ type: 'image/jpeg', size: AVATAR_MAX_INPUT_BYTES + 1 })).toMatch(/pesada/);
  });
});

describe('encuadre del recorte', () => {
  const W = 4000;
  const H = 3000; // foto horizontal de teléfono

  it('con zoom 1 la imagen cubre justo el círculo (el lado menor llena la vista)', () => {
    const { w, h } = drawnSize(W, H, 1);
    expect(h).toBeCloseTo(AVATAR_VIEW_SIDE);
    expect(w).toBeGreaterThan(AVATAR_VIEW_SIDE);
  });

  it('el desplazamiento nunca deja ver el fondo, ni con mucho zoom ni arrastrando de más', () => {
    for (const zoom of [1, 1.7, AVATAR_MAX_ZOOM]) {
      const crop = clampCrop({ zoom, x: 99999, y: -99999 }, W, H);
      const { dx, dy, dw, dh } = drawRect(crop, W, H, AVATAR_VIEW_SIDE);
      expect(dx).toBeLessThanOrEqual(0.0001);
      expect(dy).toBeLessThanOrEqual(0.0001);
      expect(dx + dw).toBeGreaterThanOrEqual(AVATAR_VIEW_SIDE - 0.0001);
      expect(dy + dh).toBeGreaterThanOrEqual(AVATAR_VIEW_SIDE - 0.0001);
    }
  });

  it('el zoom se mantiene entre 1 y el máximo', () => {
    expect(clampCrop({ zoom: 0.2, x: 0, y: 0 }, W, H).zoom).toBe(1);
    expect(clampCrop({ zoom: 50, x: 0, y: 0 }, W, H).zoom).toBe(AVATAR_MAX_ZOOM);
    expect(clampCrop({ zoom: NaN, x: NaN, y: NaN }, W, H)).toEqual({ zoom: 1, x: 0, y: 0 });
  });

  it('lo que se ve en la vista es lo mismo que sale en el archivo (mismo encuadre a otra escala)', () => {
    const crop = clampCrop({ zoom: 2, x: 40, y: -10 }, W, H);
    const view = drawRect(crop, W, H, AVATAR_VIEW_SIDE);
    const out = drawRect(crop, W, H, AVATAR_OUTPUT_SIDE);
    const k = AVATAR_OUTPUT_SIDE / AVATAR_VIEW_SIDE;
    expect(out.dx).toBeCloseTo(view.dx * k);
    expect(out.dy).toBeCloseTo(view.dy * k);
    expect(out.dw).toBeCloseTo(view.dw * k);
  });
});
