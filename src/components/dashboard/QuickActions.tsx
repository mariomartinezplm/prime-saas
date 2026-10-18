import { Link } from 'react-router-dom';
import { Activity, Camera, CalendarCheck, CalendarPlus, Dumbbell, Ruler, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TEXT } from './brand';

interface Item {
  to: string;
  label: string;
  icon: LucideIcon;
}

const ALL: Item[] = [
  { to: '/app/reservar', label: 'Reservar', icon: CalendarPlus },
  { to: '/app/mis-citas', label: 'Mis citas', icon: CalendarCheck },
  { to: '/app/mediciones', label: 'Mediciones', icon: Ruler },
  { to: '/app/ejercicios', label: 'Ejercicios', icon: Dumbbell },
  { to: '/app/dolor', label: 'Dolor (EVA)', icon: Activity },
  { to: '/app/fotos', label: 'Fotos', icon: Camera },
];

// Accesos del resto de la app. No repite el botón de la tarjeta protagonista: con una sesión agendada ya hay «Ver mis citas»;
// sin sesión, ya hay «Reservar hora». Las rutas son las de siempre; no se quita ninguna función (queda en el menú).
const QuickActions = ({ hide }: { hide: ('/app/reservar' | '/app/mis-citas')[] }) => {
  const items = ALL.filter((item) => !hide.includes(item.to as (typeof hide)[number]));
  return (
    <nav aria-label="Accesos rápidos" className={cn('grid gap-2', items.length === 4 ? 'grid-cols-2 sm:grid-cols-4' : items.length === 5 ? 'grid-cols-6 sm:grid-cols-5' : 'grid-cols-3 sm:grid-cols-6')}>
      {items.map(({ to, label, icon: Icon }, index) => (
        <Link
          key={to}
          to={to}
          className={cn(
            // Con 5 accesos: 3 arriba y 2 más anchos abajo (sin renglón cojo)
            items.length === 5 && (index < 3 ? 'col-span-2 sm:col-span-1' : 'col-span-3 sm:col-span-1'),
            'flex min-h-[4.25rem] flex-col items-center justify-center gap-1.5 rounded-2xl border border-[#fff8e4]/10 bg-[#fff8e4]/[0.04] px-1 text-center text-[13px] font-medium transition-colors duration-150',
            'hover:bg-[#fff8e4]/[0.07] active:bg-[#398ca2]/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#fff8e4]',
            TEXT
          )}
        >
          <Icon className="h-5 w-5 text-[#398ca2]" aria-hidden="true" />
          {label}
        </Link>
      ))}
    </nav>
  );
};

export default QuickActions;
