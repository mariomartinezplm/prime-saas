import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useUnsavedChangesApi } from '@/contexts/UnsavedChangesContext';
import {
  LayoutDashboard,
  Calendar,
  CalendarCheck,
  CalendarClock,
  CalendarPlus,
  Users,
  UserPlus,
  Settings,
  Ruler,
  Camera,
  Target,
  Trophy,
  Dumbbell,
  Activity,
  PersonStanding,
  User,
  FileText,
  Wallet,
  Timer,
  LogOut,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import PendingLogoutDialog from '@/components/workout/PendingLogoutDialog';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from '@/components/ui/sidebar';
import logoImage from '@/assets/prime-fh-logo.png';
import FounderBadge from '@/components/plans/FounderBadge';
import { cn } from '@/lib/utils';

interface NavItem {
  label: string;
  icon: LucideIcon;
  path: string;
  // Las pantallas de inicio solo se marcan con la ruta exacta; el resto también en sus subrutas
  // (la ficha de un paciente deja "Pacientes" activo, clasificar planes deja "Planes" activo).
  exact?: boolean;
}

interface NavGroup {
  label?: string;
  items: NavItem[];
}

const patientNav: NavGroup[] = [
  { items: [{ label: 'Inicio', icon: LayoutDashboard, path: '/app/dashboard', exact: true }] },
  {
    label: 'Agenda',
    items: [
      { label: 'Reservar hora', icon: CalendarPlus, path: '/app/reservar' },
      { label: 'Mis citas', icon: CalendarCheck, path: '/app/mis-citas' },
    ],
  },
  {
    label: 'Mi progreso',
    items: [
      { label: 'Resumen', icon: Activity, path: '/app/progreso', exact: true },
      { label: 'Mediciones', icon: Ruler, path: '/app/mediciones' },
      { label: 'Mapa del cuerpo', icon: PersonStanding, path: '/app/mapa-corporal' },
      { label: 'Ejercicios', icon: Dumbbell, path: '/app/ejercicios' },
      { label: 'Fotos', icon: Camera, path: '/app/fotos' },
      { label: 'Dolor (EVA)', icon: Activity, path: '/app/dolor' },
      { label: 'Mis objetivos', icon: Target, path: '/app/objetivos' },
      { label: 'Mis logros', icon: Trophy, path: '/app/logros' },
    ],
  },
  {
    label: 'Cuenta',
    items: [
      { label: 'Mi perfil', icon: User, path: '/app/mi-perfil' },
      { label: 'Configuración', icon: Settings, path: '/app/configuracion' },
    ],
  },
];

const staffNav: NavGroup[] = [
  { items: [{ label: 'Inicio', icon: LayoutDashboard, path: '/app/admin', exact: true }] },
  {
    label: 'Agenda',
    items: [
      { label: 'Calendario', icon: Calendar, path: '/app/admin/calendario' },
      { label: 'Disponibilidad', icon: CalendarClock, path: '/app/admin/disponibilidad' },
    ],
  },
  {
    label: 'Pacientes y gestión',
    items: [
      { label: 'Pacientes', icon: Users, path: '/app/admin/pacientes' },
      { label: 'Registrar paciente', icon: UserPlus, path: '/app/admin/registro' },
      { label: 'Planes', icon: FileText, path: '/app/admin/planes' },
      { label: 'Ingresos', icon: Wallet, path: '/app/admin/ingresos' },
      { label: 'Cronómetro', icon: Timer, path: '/app/admin/cronometro' },
    ],
  },
  { label: 'Cuenta', items: [{ label: 'Configuración', icon: Settings, path: '/app/configuracion' }] },
];

const isItemActive = (pathname: string, item: NavItem) =>
  item.exact ? pathname === item.path : pathname === item.path || pathname.startsWith(`${item.path}/`);

const ROLE_LABEL = (role?: string) => (role === 'admin' ? 'Administrador' : role === 'professional' ? 'Profesional' : 'Paciente');

const initialsOf = (firstName?: string, lastName?: string) =>
  `${(firstName ?? '').trim().charAt(0)}${(lastName ?? '').trim().charAt(0)}`.toUpperCase();

// Fila de navegación: identidad PRIME (#181619 / #398ca2 / #fff8e4). Altura táctil de 44 px solo en pantallas táctiles.
// El estado activo se distingue por TRES señales (barra turquesa, fondo suave y texto en negrita), no solo por el color.
const ROW = cn(
  'relative h-9 gap-3 rounded-xl px-3 text-[15px] font-normal text-[#fff8e4]/80 transition-colors duration-150 [@media(pointer:coarse)]:h-11 [&>svg]:size-[18px]',
  'hover:bg-[#fff8e4]/[0.06] hover:text-[#fff8e4] active:bg-[#fff8e4]/10 active:text-[#fff8e4]',
  'focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#fff8e4]',
  'data-[active=true]:bg-[#398ca2]/15 data-[active=true]:font-semibold data-[active=true]:text-[#fff8e4]'
);

const LABEL =
  'h-6 px-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#fff8e4]/60';

const AppSidebar = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { setOpenMobile, isMobile } = useSidebar();
  const [pendingLogout, setPendingLogout] = useState(false);

  const isStaff = user?.role === 'admin' || user?.role === 'professional';
  const groups = isStaff ? staffNav : patientNav;
  const homePath = isStaff ? '/app/admin' : '/app/dashboard';

  const { confirmLeave } = useUnsavedChangesApi();

  const closeMobileMenu = () => setOpenMobile(false);

  // Ir a otra pantalla pregunta antes si hay un formulario a medias. Ctrl/Cmd/Shift + clic
  // (abrir en otra pestaña) no pierde nada y sigue su curso normal.
  const goTo = (to: string) => (event: React.MouseEvent) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) {
      closeMobileMenu();
      return;
    }
    event.preventDefault();
    confirmLeave(() => {
      closeMobileMenu();
      navigate(to);
    });
  };

  const handleLogout = () => {
    confirmLeave(async () => {
      closeMobileMenu();
      // Con series de entrenamiento sin sincronizar NO se cierra sesión en silencio: se avisa y la persona decide
      if (await logout()) navigate('/login');
      else setPendingLogout(true);
    });
  };

  const leaveAnyway = async () => {
    setPendingLogout(false);
    await logout({ force: true });
    navigate('/login');
  };

  return (
    <>
    {user && <PendingLogoutDialog open={pendingLogout} userId={user.id} onCancel={() => setPendingLogout(false)} onLeave={leaveAnyway} />}
    <Sidebar>
      {/* Un solo contenedor con el fondo de la marca: cubre igual el panel del celular y la barra de escritorio */}
      <div className="flex h-full min-h-0 w-full flex-col bg-[#181619] text-[#fff8e4] [padding-left:env(safe-area-inset-left)]">
        <SidebarHeader className="gap-0 border-b border-[#fff8e4]/10 p-0 px-3 pb-3 pt-[max(0.5rem,env(safe-area-inset-top))]">
          <div className="flex items-center justify-between gap-2">
            <Link
              to={homePath}
              onClick={goTo(homePath)}
              aria-label="Prime F&H, ir al inicio"
              className="-ml-1 inline-flex h-11 items-center rounded-lg px-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#fff8e4]"
            >
              <img src={logoImage} alt="" className="h-8 w-auto" />
            </Link>
            {isMobile && (
              <button
                type="button"
                onClick={closeMobileMenu}
                aria-label="Cerrar menú"
                className="-mr-1 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-[#fff8e4]/80 transition-colors hover:bg-[#fff8e4]/[0.06] hover:text-[#fff8e4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#fff8e4] active:bg-[#fff8e4]/10"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            )}
          </div>
          {user && (
            <div className="mt-1.5 flex min-w-0 items-center gap-3">
              <span
                aria-hidden="true"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#398ca2]/60 bg-[#398ca2]/15 text-[13px] font-semibold tracking-wide text-[#fff8e4]"
              >
                {initialsOf(user.firstName, user.lastName)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-semibold leading-tight text-[#fff8e4]">
                  {user.firstName} {user.lastName}
                </p>
                <p className="mt-0.5 flex items-center gap-1.5 text-xs leading-tight text-[#fff8e4]/70">
                  <span>{ROLE_LABEL(user.role)}</span>
                  {user.isFounder && <FounderBadge compact tone="brand" className="px-1.5 py-0" />}
                </p>
              </div>
            </div>
          )}
        </SidebarHeader>

        <SidebarContent
          role="navigation"
          aria-label="Secciones de Prime F&H"
          className="gap-0 overscroll-contain px-2 py-2"
        >
          {groups.map((group, index) => {
            const labelId = group.label ? `nav-grupo-${index}` : undefined;
            return (
              <SidebarGroup key={group.label ?? `grupo-${index}`} className={cn('p-0', index > 0 && 'mt-3')}>
                {group.label && (
                  <SidebarGroupLabel id={labelId} className={LABEL}>
                    {group.label}
                  </SidebarGroupLabel>
                )}
                <SidebarGroupContent>
                  <SidebarMenu aria-labelledby={labelId} className="gap-0.5">
                    {group.items.map((item) => {
                      const active = isItemActive(location.pathname, item);
                      return (
                        <SidebarMenuItem key={item.path}>
                          <SidebarMenuButton asChild isActive={active} tooltip={item.label} className={ROW}>
                            <Link to={item.path} onClick={goTo(item.path)} aria-current={active ? 'page' : undefined}>
                              {active && <span aria-hidden="true" className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-[#398ca2]" />}
                              <item.icon className={cn('shrink-0', active ? 'text-[#398ca2]' : 'text-[#fff8e4]/65')} aria-hidden="true" />
                              <span>{item.label}</span>
                            </Link>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      );
                    })}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            );
          })}
        </SidebarContent>

        {/* «Cerrar sesión» queda fijo abajo (fuera del desplazamiento) para que nunca se corte, ni en pantallas bajas */}
        <SidebarFooter className="gap-0 border-t border-[#fff8e4]/10 p-0 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2">
          <SidebarMenu className="gap-0.5">
            <SidebarMenuItem>
              <SidebarMenuButton onClick={handleLogout} tooltip="Cerrar sesión" className={ROW}>
                <LogOut className="shrink-0 text-[#fff8e4]/65" aria-hidden="true" />
                <span>Cerrar sesión</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </div>
    </Sidebar>
    </>
  );
};

export default AppSidebar;
