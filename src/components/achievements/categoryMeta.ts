import { Activity, CalendarCheck, Dumbbell, Leaf, Moon, Route, Scale, Sparkles, type LucideIcon } from 'lucide-react';
import type { AchievementCategoryKey } from '@/services/achievementService';

// Un icono por categoría: la insignia se reconoce sin leer
export const CATEGORY_ICONS: Record<AchievementCategoryKey, LucideIcon> = {
  kinesiologia: Activity,
  constancia: CalendarCheck,
  readiness: Sparkles,
  descanso: Moon,
  estres: Leaf,
  trayectoria: Route,
  cuerpo: Scale,
  fuerza: Dumbbell,
};
