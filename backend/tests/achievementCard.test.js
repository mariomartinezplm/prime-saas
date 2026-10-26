/**
 * PRUEBAS — imagen para compartir un logro (src/lib/achievementCard.ts): qué lleva y qué NO lleva, según lo que la persona elija.
 */
import { describe, it, expect } from 'vitest';

const { buildAchievementCardModel, isSensitiveAchievement, detailLine, shareDateLabel, CARD_SIZES, SENSITIVE_CATEGORIES } = await import('../../src/lib/achievementCard.ts');

const base = { title: 'Mes de constancia', category: 'constancia', categoryLabel: 'Constancia', awardedAt: '2026-10-26T15:00:00.000Z' };
const record = { exercise: 'Sentadilla', previous: 90, current: 100, unit: 'kg' };
const goal = { headline: '¡Alcanzaste tu meta!', value: 82.5, unit: 'kg' };
const OFF = { includeName: false, includeDetail: false };
const ON = { includeName: true, includeDetail: true };

describe('lo que lleva la imagen por defecto', () => {
  it('solo el nombre del logro, la categoría (si es neutra) y la fecha: sin nombre ni números', () => {
    const m = buildAchievementCardModel({ ...base, record }, OFF, 'Ana');
    expect(m).toMatchObject({ title: 'Nueva marca personal', categoryLabel: 'Constancia', dateLabel: '26 de octubre de 2026', detail: null, name: null });
    expect(JSON.stringify(m)).not.toMatch(/Sentadilla|100|Ana/);
  });

  it('el nombre y los números solo van si la persona los enciende', () => {
    const m = buildAchievementCardModel({ ...base, record }, ON, ' Ana ');
    expect(m.name).toBe('Ana');
    expect(m.detail).toBe('Sentadilla · 100 kg');
    expect(buildAchievementCardModel(base, ON, 'Ana').detail).toBeNull(); // un logro sin números no inventa ninguno
    expect(buildAchievementCardModel(base, { includeName: true, includeDetail: false }, '   ').name).toBeNull(); // sin nombre no pone uno vacío
  });
});

describe('logros de salud o de cuerpo', () => {
  it('se reconocen y su categoría NO aparece en la imagen', () => {
    for (const category of ['kinesiologia', 'cuerpo', 'readiness', 'descanso', 'estres', 'objetivos']) {
      expect(SENSITIVE_CATEGORIES.has(category)).toBe(true);
      const a = { ...base, category, categoryLabel: 'Algo de salud' };
      expect(isSensitiveAchievement(a)).toBe(true);
      expect(buildAchievementCardModel(a, ON, 'Ana')).toMatchObject({ categoryLabel: '', sensitive: true });
    }
  });

  it('los logros neutros no avisan', () => {
    for (const category of ['primeros', 'constancia', 'trayectoria', 'fuerza']) expect(isSensitiveAchievement({ ...base, category })).toBe(false);
  });

  it('un objetivo conseguido siempre es sensible (cuenta una meta personal) y su meta solo va con el interruptor', () => {
    const a = { ...base, category: 'fuerza', goal };
    expect(isSensitiveAchievement(a)).toBe(true);
    expect(buildAchievementCardModel(a, OFF).detail).toBeNull();
    expect(buildAchievementCardModel(a, ON).detail).toBe('¡Alcanzaste tu meta! · 82,5 kg');
  });
});

describe('detalle y fecha', () => {
  it('no inventa números', () => {
    expect(detailLine(base)).toBeNull();
    expect(detailLine({ ...base, record: { exercise: 'Remo', previous: null, current: null, unit: 'kg' } })).toBeNull();
    expect(detailLine({ ...base, goal: { headline: '¡Listo!', value: null, unit: null } })).toBe('¡Listo!');
  });
  it('la fecha va en hora de Chile y una fecha inválida no rompe', () => {
    expect(shareDateLabel('2026-11-01T02:30:00.000Z')).toBe('31 de octubre de 2026'); // 23:30 del 31 en Chile
    expect(shareDateLabel('no es fecha')).toBe('');
  });
  it('hay formato historia (9:16) y publicación (4:5)', () => {
    expect(CARD_SIZES.story).toMatchObject({ w: 1080, h: 1920 });
    expect(CARD_SIZES.post).toMatchObject({ w: 1080, h: 1350 });
  });
});
