import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
    Calendar,
    Users,
    FileText,
    DollarSign,
    Clock,
    ChevronLeft,
    ChevronRight,
    Plus,
    Search,
    Filter,
    Download,
    BarChart3,
    LogOut,
    Settings,
    Bell
} from "lucide-react";
import StaffCalendarView from "@/components/staff/StaffCalendarView";
import PatientRecordView from "@/components/staff/PatientRecordView";
import { motion } from "framer-motion";

type ViewMode = "dashboard" | "calendar" | "patients" | "records" | "billing";

const StaffDashboard = () => {
    const navigate = useNavigate();
    const { user, logout } = useAuth();
    const [currentView, setCurrentView] = useState<ViewMode>("dashboard");

    const handleLogout = () => {
        logout();
        navigate("/login");
    };

    // Estadísticas del día
    const todayStats = {
        totalSessions: 12,
        completed: 7,
        inProgress: 2,
        pending: 2,
        noShow: 1,
        revenue: 245000
    };

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <header className="bg-white border-b border-gray-200 sticky top-0 z-40 shadow-sm">
                <div className="px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-bold text-brand-dark">Dashboard Prime F&H</h1>
                            <p className="text-sm text-gray-600 mt-1">Bienvenido, {user?.fullName || "Personal"}</p>
                        </div>

                        <div className="flex items-center gap-4">
                            <Button variant="outline" size="sm" className="relative">
                                <Bell className="w-5 h-5" />
                                <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                                    3
                                </span>
                            </Button>

                            <Button variant="outline" size="sm">
                                <Settings className="w-5 h-5 mr-2" />
                                Configuración
                            </Button>

                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleLogout}
                                className="text-red-600 hover:bg-red-50"
                            >
                                <LogOut className="w-5 h-5 mr-2" />
                                Salir
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Navigation Tabs */}
                <nav className="px-6 flex gap-2 overflow-x-auto">
                    {[
                        { id: "dashboard", label: "Panel Principal", icon: BarChart3 },
                        { id: "calendar", label: "Agenda", icon: Calendar },
                        { id: "patients", label: "Pacientes", icon: Users },
                        { id: "records", label: "Fichas Clínicas", icon: FileText },
                        { id: "billing", label: "Facturación", icon: DollarSign }
                    ].map((tab) => {
                        const Icon = tab.icon;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setCurrentView(tab.id as ViewMode)}
                                className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-all whitespace-nowrap ${currentView === tab.id
                                    ? "border-brand-secondary text-brand-secondary font-semibold"
                                    : "border-transparent text-gray-600 hover:text-brand-dark hover:border-gray-300"
                                    }`}
                            >
                                <Icon className="w-5 h-5" />
                                {tab.label}
                            </button>
                        );
                    })}
                </nav>
            </header>

            {/* Main Content */}
            <main className="p-6">
                {currentView === "dashboard" && (
                    <div className="space-y-6">
                        {/* Stats Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            <StatsCard
                                title="Sesiones Hoy"
                                value={todayStats.totalSessions}
                                subtitle={`${todayStats.completed} completadas`}
                                icon={Calendar}
                                color="blue"
                            />
                            <StatsCard
                                title="En Progreso"
                                value={todayStats.inProgress}
                                subtitle="Sesiones activas"
                                icon={Clock}
                                color="green"
                            />
                            <StatsCard
                                title="Pendientes"
                                value={todayStats.pending}
                                subtitle="Por atender"
                                icon={Users}
                                color="orange"
                            />
                            <StatsCard
                                title="Ingresos Hoy"
                                value={`$${todayStats.revenue.toLocaleString()}`}
                                subtitle={`${todayStats.noShow} inasistencia`}
                                icon={DollarSign}
                                color="purple"
                            />
                        </div>

                        {/* Quick Actions */}
                        <Card className="p-6">
                            <h2 className="text-lg font-semibold mb-4">Acciones Rápidas</h2>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <QuickActionButton
                                    icon={Plus}
                                    label="Nueva Cita"
                                    onClick={() => setCurrentView("calendar")}
                                />
                                <QuickActionButton
                                    icon={Users}
                                    label="Nuevo Paciente"
                                    onClick={() => setCurrentView("patients")}
                                />
                                <QuickActionButton
                                    icon={FileText}
                                    label="Nueva Ficha"
                                    onClick={() => setCurrentView("records")}
                                />
                                <QuickActionButton
                                    icon={Download}
                                    label="Reportes"
                                    onClick={() => { }}
                                />
                            </div>
                        </Card>

                        {/* Today's Schedule Preview */}
                        <Card className="p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-lg font-semibold">Agenda de Hoy</h2>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setCurrentView("calendar")}
                                >
                                    Ver Completa
                                </Button>
                            </div>
                            <div className="space-y-3">
                                <AppointmentItem
                                    time="09:00"
                                    patient="Juan Pérez"
                                    type="Kinesiología"
                                    status="completed"
                                />
                                <AppointmentItem
                                    time="10:00"
                                    patient="María González"
                                    type="Entrenamiento"
                                    status="in-session"
                                />
                                <AppointmentItem
                                    time="11:00"
                                    patient="Carlos Soto"
                                    type="Kinesiología"
                                    status="pending"
                                />
                                <AppointmentItem
                                    time="12:00"
                                    patient="Bloqueo - Almuerzo"
                                    type="Bloqueado"
                                    status="blocked"
                                />
                            </div>
                        </Card>
                    </div>
                )}

                {currentView === "calendar" && <StaffCalendarView />}
                {currentView === "patients" && <PatientListView />}
                {currentView === "records" && <PatientRecordView />}
                {currentView === "billing" && <BillingView />}
            </main>
        </div>
    );
};

// Stats Card Component
const StatsCard = ({ title, value, subtitle, icon: Icon, color }: any) => {
    const colors = {
        blue: "bg-blue-50 text-blue-600",
        green: "bg-green-50 text-green-600",
        orange: "bg-orange-50 text-orange-600",
        purple: "bg-purple-50 text-purple-600"
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
        >
            <Card className="p-6 hover:shadow-lg transition-shadow">
                <div className="flex items-start justify-between">
                    <div>
                        <p className="text-sm text-gray-600 mb-1">{title}</p>
                        <p className="text-3xl font-bold text-brand-dark mb-1">{value}</p>
                        <p className="text-xs text-gray-500">{subtitle}</p>
                    </div>
                    <div className={`p-3 rounded-lg ${colors[color]}`}>
                        <Icon className="w-6 h-6" />
                    </div>
                </div>
            </Card>
        </motion.div>
    );
};

// Quick Action Button
const QuickActionButton = ({ icon: Icon, label, onClick }: any) => (
    <Button
        variant="outline"
        className="h-auto py-6 flex flex-col items-center gap-2 hover:bg-brand-secondary/10 hover:border-brand-secondary"
        onClick={onClick}
    >
        <Icon className="w-6 h-6" />
        <span className="text-sm">{label}</span>
    </Button>
);

// Appointment Item Component
const AppointmentItem = ({ time, patient, type, status }: any) => {
    const statusConfig = {
        completed: { label: "Finalizado", color: "bg-green-100 text-green-700" },
        "in-session": { label: "En Sesión", color: "bg-blue-100 text-blue-700" },
        pending: { label: "En Espera", color: "bg-yellow-100 text-yellow-700" },
        "no-show": { label: "Inasistencia", color: "bg-red-100 text-red-700" },
        blocked: { label: "Bloqueado", color: "bg-gray-100 text-gray-700" }
    };

    const config = statusConfig[status as keyof typeof statusConfig];

    return (
        <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
            <div className="text-center min-w-[60px]">
                <p className="text-lg font-bold text-brand-dark">{time}</p>
            </div>
            <div className="flex-1">
                <p className="font-semibold text-brand-dark">{patient}</p>
                <p className="text-sm text-gray-600">{type}</p>
            </div>
            <span className={`px-3 py-1 rounded-full text-xs font-medium ${config.color}`}>
                {config.label}
            </span>
        </div>
    );
};

// Placeholder Components (to be implemented)
const PatientListView = () => (
    <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Lista de Pacientes</h2>
        <p className="text-gray-600">Vista de pacientes en desarrollo...</p>
    </Card>
);

const BillingView = () => (
    <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Facturación y Pagos</h2>
        <p className="text-gray-600">Vista de facturación en desarrollo...</p>
    </Card>
);

export default StaffDashboard;
