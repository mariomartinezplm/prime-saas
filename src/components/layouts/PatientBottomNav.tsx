import { NavLink, useLocation } from 'react-router-dom';
import { Activity, CalendarCheck, Home, UserRound, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Tab {
  to: string;
  label: string;
  icon: LucideIcon;
  // Rutas que cuentan como «dentro» de esta pestaña
  match: string[];
}

const TABS: Tab[] = [
  { to: '/app/dashboard', label: 'Inicio', icon: Home, match: ['/app/dashboard'] },
  { to: '/app/mis-citas', label: 'Mis citas', icon: CalendarCheck, match: ['/app/mis-citas', '/app/reservar'] },
  { to: '/app/progreso', label: 'Progreso', icon: Activity, match: ['/app/progreso', '/app/mediciones', '/app/ejercicios', '/app/fotos', '/app/dolor', '/app/logros'] },
  { to: '/app/mi-perfil', label: 'Perfil', icon: UserRound, match: ['/app/mi-perfil'] },
];

// Barra inferior del paciente (PROTOTIPO, apagada por defecto: ver usePatientBottomNav). Solo en pantallas angostas; respeta el área
// segura de iPhone; objetivos táctiles de 56 px; la pestaña activa lleva texto, color y una marca superior (no depende solo del color).
const PatientBottomNav = () => {
  const { pathname } = useLocation();
  return (
    <nav
      aria-label="Principal"
      className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-[#fff8e4]/10 bg-[#181619]/95 px-2 pb-[env(safe-area-inset-bottom)] pt-1.5 backdrop-blur md:hidden"
    >
      {TABS.map(({ to, label, icon: Icon, match }) => {
        const active = match.some((m) => pathname === m || pathname.startsWith(`${m}/`));
        return (
          <NavLink
            key={to}
            to={to}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'relative flex min-h-[56px] flex-col items-center justify-center gap-1 rounded-xl text-[12px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#fff8e4]',
              active ? 'text-[#fff8e4]' : 'text-[#fff8e4]/62'
            )}
          >
            {active && <span aria-hidden="true" className="absolute -top-1.5 h-[3px] w-8 rounded-b-full bg-[#398ca2]" />}
            <Icon className={cn('h-[22px] w-[22px]', active && 'text-[#7cc0d2]')} aria-hidden="true" />
            {label}
          </NavLink>
        );
      })}
    </nav>
  );
};

export default PatientBottomNav;
