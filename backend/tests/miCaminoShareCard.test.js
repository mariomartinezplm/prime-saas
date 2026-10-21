/**
 * PRUEBAS — Mi camino PRIME, parte 5: la imagen para compartir solo lleva datos de una lista blanca.
 */
import { describe, it, expect } from 'vitest';
import { buildShareCardModel, canShareSummary, shareMonthLabel, SHAREABLE_CATEGORIES, MAX_SHARED_MILESTONES } from '../../src/lib/shareCard.ts';

const m = (key, title, category) => ({ key, title, category, categoryLabel: 'x', awardedAt: '2026-10-12T12:00:00Z' });
const summary = (over = {}) => ({
  month: '2026-10',
  isCurrent: true,
  sessions: { completed: 8, training: 5, kinesiology: 3, plan: { completed: 8, target: 8, met: true } },
  milestones: [],
  records: { measurements: 4, exercises: 9, readinessDays: 12 },
  hasActivity: true,
  ...over
});

describe('modelo de la imagen para compartir', () => {
  it('solo lleva el mes, el número de sesiones y hitos neutros', () => {
    const model = buildShareCardModel(summary({ milestones: [m('first_session', 'Primera sesión completada', 'primeros'), m('consistency_month', 'Mes de constancia', 'constancia')] }));
    expect(model).toEqual({ monthLabel: 'Octubre 2026', sessions: 8, milestones: ['Primera sesión completada', 'Mes de constancia'] });
    expect(Object.keys(model).sort()).toEqual(['milestones', 'monthLabel', 'sessions']);
  });

  it('deja fuera hitos de kinesiología, cuerpo, descanso, estrés y Readiness (pueden revelar salud)', () => {
    const model = buildShareCardModel(
      summary({
        milestones: [
          m('kine_5', '5 sesiones completadas', 'kinesiologia'),
          m('body_goal', 'Meta de peso alcanzada', 'cuerpo'),
          m('rest_week', 'Una semana de buen descanso', 'descanso'),
          m('balance_week', 'Semana de equilibrio', 'estres'),
          m('readiness_week', 'Una semana de Readiness', 'readiness'),
          m('streak_3', '3 meses en movimiento', 'trayectoria')
        ]
      })
    );
    expect(model.milestones).toEqual(['3 meses en movimiento']);
    expect([...SHAREABLE_CATEGORIES].sort()).toEqual(['constancia', 'fuerza', 'primeros', 'trayectoria']);
  });

  it('nunca incluye registros, tipos de sesión ni valores de salud', () => {
    const json = JSON.stringify(buildShareCardModel(summary()));
    expect(json).not.toMatch(/measure|medici|kinesi|peso|weight|dolor|eva|readiness|record/i);
  });

  it('limita y no repite los hitos', () => {
    const many = Array.from({ length: 6 }, (_, i) => m(`k${i}`, i < 2 ? 'Mismo' : `Hito ${i}`, 'trayectoria'));
    const model = buildShareCardModel(summary({ milestones: many }));
    expect(model.milestones.length).toBeLessThanOrEqual(MAX_SHARED_MILESTONES);
    expect(new Set(model.milestones).size).toBe(model.milestones.length);
  });

  it('se puede compartir con sesiones o con un hito neutro, no con un mes vacío', () => {
    expect(canShareSummary(summary())).toBe(true);
    expect(canShareSummary(summary({ sessions: { completed: 0, training: 0, kinesiology: 0, plan: null } }))).toBe(false);
    expect(canShareSummary(summary({ sessions: { completed: 0, training: 0, kinesiology: 0, plan: null }, milestones: [m('first_progress', 'Primer registro de progreso', 'primeros')] }))).toBe(true);
    expect(canShareSummary(summary({ sessions: { completed: 0, training: 0, kinesiology: 0, plan: null }, milestones: [m('kine_5', '5 sesiones', 'kinesiologia')] }))).toBe(false);
  });

  it('el nombre del mes sale en español con mayúscula', () => {
    expect(shareMonthLabel('2026-01')).toBe('Enero 2026');
    expect(shareMonthLabel('2026-12')).toBe('Diciembre 2026');
  });
});
