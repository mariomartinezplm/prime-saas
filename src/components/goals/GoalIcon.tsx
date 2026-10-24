import { Activity, Brain, Crosshair, Dumbbell, Flame, HeartPulse, Move, PersonStanding, Scale, Target, Timer, type LucideIcon } from 'lucide-react';

// El catálogo guarda el nombre del icono; aquí se resuelve a su dibujo
const ICONS: Record<string, LucideIcon> = { Dumbbell, Activity, Scale, Flame, Timer, HeartPulse, Brain, PersonStanding, Crosshair, Move, Target };

const GoalIcon = ({ name, className }: { name: string; className?: string }) => {
  const Icon = ICONS[name] ?? Target;
  return <Icon aria-hidden="true" className={className} />;
};

export default GoalIcon;
