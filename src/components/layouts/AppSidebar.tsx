import { useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Calendar,
  CalendarPlus,
  Users,
  UserPlus,
  ClipboardList,
  Settings,
  Ruler,
  Dumbbell,
  Activity,
  User,
  Clock,
  FileText,
  LogOut,
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
} from '@/components/ui/sidebar';
import logoImage from '@/assets/prime-fh-logo.png';

const AppSidebar = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const isStaff = user?.role === 'admin' || user?.role === 'professional';

  const patientMenuItems = [
    { label: 'Dashboard', icon: LayoutDashboard, path: '/app/dashboard' },
    { label: 'Reservar Hora', icon: CalendarPlus, path: '/app/reservar' },
    { label: 'Mis Citas', icon: Clock, path: '/app/mis-citas' },
    { label: 'Mi Perfil', icon: User, path: '/app/mi-perfil' },
    { label: 'Mediciones', icon: Ruler, path: '/app/mediciones' },
    { label: 'Ejercicios', icon: Dumbbell, path: '/app/ejercicios' },
    { label: 'Dolor (EVA)', icon: Activity, path: '/app/dolor' },
  ];

  const staffMenuItems = [
    { label: 'Dashboard', icon: LayoutDashboard, path: '/app/admin' },
    { label: 'Calendario', icon: Calendar, path: '/app/admin/calendario' },
    { label: 'Pacientes', icon: Users, path: '/app/admin/pacientes' },
    { label: 'Registrar Paciente', icon: UserPlus, path: '/app/admin/registro' },
    { label: 'Citas', icon: ClipboardList, path: '/app/admin/citas' },
    { label: 'Planes', icon: FileText, path: '/app/admin/planes' },
    { label: 'Disponibilidad', icon: Clock, path: '/app/admin/disponibilidad' },
  ];

  const menuItems = isStaff ? staffMenuItems : patientMenuItems;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <Sidebar>
      <SidebarHeader className="p-4 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <img src={logoImage} alt="Prime F&H" className="h-8 w-auto" />
        </div>
        {user && (
          <div className="mt-3">
            <p className="text-sm font-medium text-sidebar-foreground">
              {user.firstName} {user.lastName}
            </p>
            <p className="text-xs text-sidebar-foreground/60 capitalize">
              {user.role === 'admin' ? 'Administrador' : user.role === 'professional' ? 'Profesional' : 'Paciente'}
            </p>
          </div>
        )}
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>
            {isStaff ? 'Administración' : 'Mi Espacio'}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.path}>
                  <SidebarMenuButton
                    isActive={location.pathname === item.path}
                    onClick={() => navigate(item.path)}
                    tooltip={item.label}
                  >
                    <item.icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Cuenta</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={location.pathname === '/app/configuracion'}
                  onClick={() => navigate('/app/configuracion')}
                  tooltip="Configuración"
                >
                  <Settings className="h-4 w-4" />
                  <span>Configuración</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4 border-t border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={handleLogout} tooltip="Cerrar sesión">
              <LogOut className="h-4 w-4" />
              <span>Cerrar sesión</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
};

export default AppSidebar;
