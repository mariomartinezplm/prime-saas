import { Link, useLocation, useNavigate } from 'react-router-dom';
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
  Dumbbell,
  Activity,
  User,
  FileText,
  LogOut,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
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
      { label: 'Mediciones', icon: Ruler, path: '/app/mediciones' },
      { label: 'Ejercicios', icon: Dumbbell, path: '/app/ejercicios' },
      { label: 'Fotos', icon: Camera, path: '/app/fotos' },
      { label: 'Dolor (EVA)', icon: Activity, path: '/app/dolor' },
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
    label: 'Pacientes',
    items: [
      { label: 'Pacientes', icon: Users, path: '/app/admin/pacientes' },
      { label: 'Registrar paciente', icon: UserPlus, path: '/app/admin/registro' },
      { label: 'Planes', icon: FileText, path: '/app/admin/planes' },
    ],
  },
  { label: 'Cuenta', items: [{ label: 'Configuración', icon: Settings, path: '/app/configuracion' }] },
];

const isItemActive = (pathname: string, item: NavItem) =>
  item.exact ? pathname === item.path : pathname === item.path || pathname.startsWith(`${item.path}/`);

const AppSidebar = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { setOpenMobile } = useSidebar();

  const isStaff = user?.role === 'admin' || user?.role === 'professional';
  const groups = isStaff ? staffNav : patientNav;
  const homePath = isStaff ? '/app/admin' : '/app/dashboard';

  const closeMobileMenu = () => setOpenMobile(false);

  const handleLogout = () => {
    closeMobileMenu();
    logout();
    navigate('/login');
  };

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border p-4">
        <Link
          to={homePath}
          onClick={closeMobileMenu}
          aria-label="Prime F&H, ir al inicio"
          className="inline-flex w-fit rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
        >
          <img src={logoImage} alt="" className="h-8 w-auto" />
        </Link>
        {user && (
          <div className="mt-3 min-w-0">
            <p className="flex flex-wrap items-center gap-1.5 text-sm font-medium text-sidebar-foreground">
              <span className="truncate">
                {user.firstName} {user.lastName}
              </span>
              {user.isFounder && <FounderBadge compact />}
            </p>
            <p className="text-xs text-sidebar-foreground/70">
              {user.role === 'admin' ? 'Administrador' : user.role === 'professional' ? 'Profesional' : 'Paciente'}
            </p>
          </div>
        )}
      </SidebarHeader>

      <SidebarContent>
        {groups.map((group, index) => (
          <SidebarGroup key={group.label ?? `grupo-${index}`}>
            {group.label && <SidebarGroupLabel>{group.label}</SidebarGroupLabel>}
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const active = isItemActive(location.pathname, item);
                  return (
                    <SidebarMenuItem key={item.path}>
                      <SidebarMenuButton asChild isActive={active} tooltip={item.label}>
                        <Link to={item.path} onClick={closeMobileMenu} aria-current={active ? 'page' : undefined}>
                          <item.icon className="h-4 w-4" aria-hidden="true" />
                          <span>{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-4">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={handleLogout} tooltip="Cerrar sesión">
              <LogOut className="h-4 w-4" aria-hidden="true" />
              <span>Cerrar sesión</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
};

export default AppSidebar;
