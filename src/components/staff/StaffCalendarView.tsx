import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
    Calendar as CalendarIcon,
    ChevronLeft,
    ChevronRight,
    Plus,
    Lock,
    Clock,
    User
} from "lucide-react";
import { motion } from "framer-motion";

type CalendarView = "daily" | "weekly" | "monthly";
type AppointmentStatus = "pending" | "in-session" | "completed" | "no-show" | "blocked";

interface Appointment {
    id: string;
    time: string;
    patient: string;
    type: "kinesiologia" | "entrenamiento" | "blocked";
    status: AppointmentStatus;
    duration: number; // minutos
    paid: boolean;
}

const StaffCalendarView = () => {
    const [view, setView] = useState<CalendarView>("daily");
    const [currentDate, setCurrentDate] = useState(new Date());
    const [showBlockModal, setShowBlockModal] = useState(false);

    // Mock appointments
    const appointments: Appointment[] = [
        {
            id: "1",
            time: "09:00",
            patient: "Juan Pérez",
            type: "kinesiologia",
            status: "completed",
            duration: 60,
            paid: true
        },
        {
            id: "2",
            time: "10:00",
            patient: "María González",
            type: "entrenamiento",
            status: "in-session",
            duration: 60,
            paid: true
        },
        {
            id: "3",
            time: "11:00",
            patient: "Carlos Soto",
            type: "kinesiologia",
            status: "pending",
            duration: 60,
            paid: false // ⚠️ No ha pagado
        },
        {
            id: "4",
            time: "12:00",
            patient: "Almuerzo",
            type: "blocked",
            status: "blocked",
            duration: 60,
            paid: true
        },
        {
            id: "5",
            time: "15:00",
            patient: "Ana Torres",
            type: "kinesiologia",
            status: "pending",
            duration: 60,
            paid: true
        }
    ];

    const changeDate = (increment: number) => {
        const newDate = new Date(currentDate);
        if (view === "daily") {
            newDate.setDate(newDate.getDate() + increment);
        } else if (view === "weekly") {
            newDate.setDate(newDate.getDate() + (increment * 7));
        } else if (view === "monthly") {
            newDate.setMonth(newDate.getMonth() + increment);
        }
        setCurrentDate(newDate);
    };

    const formatDate = (date: Date) => {
        if (view === "monthly") {
            return date.toLocaleDateString("es-CL", {
                year: "numeric",
                month: "long"
            });
        }
        return date.toLocaleDateString("es-CL", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric"
        });
    };

    return (
        <div className="space-y-6">
            {/* Header Controls */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => changeDate(-1)}
                    >
                        <ChevronLeft className="w-5 h-5" />
                    </Button>

                    <div className="text-center min-w-[300px]">
                        <h2 className="text-2xl font-bold text-brand-dark capitalize">
                            {formatDate(currentDate)}
                        </h2>
                    </div>

                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => changeDate(1)}
                    >
                        <ChevronRight className="w-5 h-5" />
                    </Button>

                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentDate(new Date())}
                    >
                        Hoy
                    </Button>
                </div>

                <div className="flex items-center gap-3">
                    {/* View Switcher */}
                    <div className="flex gap-2 p-1 bg-gray-100 rounded-lg">
                        <button
                            onClick={() => setView("daily")}
                            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${view === "daily"
                                ? "bg-white text-brand-dark shadow-sm"
                                : "text-gray-600 hover:text-brand-dark"
                                }`}
                        >
                            Vista Diaria
                        </button>
                        <button
                            onClick={() => setView("weekly")}
                            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${view === "weekly"
                                ? "bg-white text-brand-dark shadow-sm"
                                : "text-gray-600 hover:text-brand-dark"
                                }`}
                        >
                            Vista Semanal
                        </button>
                        <button
                            onClick={() => setView("monthly")}
                            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${view === "monthly"
                                ? "bg-white text-brand-dark shadow-sm"
                                : "text-gray-600 hover:text-brand-dark"
                                }`}
                        >
                            Vista Mensual
                        </button>
                    </div>

                    <Button
                        onClick={() => setShowBlockModal(true)}
                        variant="outline"
                        size="sm"
                        className="text-orange-600 hover:bg-orange-50"
                    >
                        <Lock className="w-4 h-4 mr-2" />
                        Bloquear Hora
                    </Button>

                    <Button
                        size="sm"
                        className="bg-brand-secondary hover:bg-brand-secondary/90"
                    >
                        <Plus className="w-4 h-4 mr-2" />
                        Nueva Cita
                    </Button>
                </div>
            </div>

            {/* Calendar Content */}
            {view === "daily" ? (
                <DailyView appointments={appointments} />
            ) : view === "weekly" ? (
                <WeeklyView currentDate={currentDate} />
            ) : (
                <MonthlyView currentDate={currentDate} />
            )}

            {/* Block Time Modal */}
            {showBlockModal && (
                <BlockTimeModal onClose={() => setShowBlockModal(false)} />
            )}
        </div>
    );
};

// Daily View Component
const DailyView = ({ appointments }: { appointments: Appointment[] }) => {
    const hours = Array.from({ length: 12 }, (_, i) => i + 8); // 8am - 8pm

    const getStatusColor = (status: AppointmentStatus) => {
        switch (status) {
            case "pending":
                return "bg-yellow-50 border-yellow-400 hover:bg-yellow-100";
            case "in-session":
                return "bg-blue-50 border-blue-400 hover:bg-blue-100";
            case "completed":
                return "bg-green-50 border-green-400 hover:bg-green-100";
            case "no-show":
                return "bg-red-50 border-red-400 hover:bg-red-100";
            case "blocked":
                return "bg-gray-100 border-gray-400 hover:bg-gray-200";
            default:
                return "bg-white border-gray-200";
        }
    };

    const getStatusBadge = (status: AppointmentStatus) => {
        const config = {
            pending: { label: "En Espera", color: "bg-yellow-100 text-yellow-700" },
            "in-session": { label: "En Sesión", color: "bg-blue-100 text-blue-700" },
            completed: { label: "Finalizado", color: "bg-green-100 text-green-700" },
            "no-show": { label: "Inasistencia", color: "bg-red-100 text-red-700" },
            blocked: { label: "Bloqueado", color: "bg-gray-100 text-gray-700" }
        };
        return config[status];
    };

    return (
        <Card className="p-6">
            <div className="space-y-2">
                {hours.map((hour) => {
                    const timeStr = `${hour.toString().padStart(2, '0')}:00`;
                    const appointment = appointments.find(apt => apt.time === timeStr);

                    return (
                        <div key={hour} className="flex gap-4 min-h-[80px]">
                            {/* Time Label */}
                            <div className="w-20 flex-shrink-0 pt-2">
                                <span className="text-sm font-semibold text-gray-600">{timeStr}</span>
                            </div>

                            {/* Appointment Slot */}
                            <div className="flex-1">
                                {appointment ? (
                                    <motion.div
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${getStatusColor(appointment.status)}`}
                                    >
                                        <div className="flex items-start justify-between">
                                            <div className="flex-1">
                                                {appointment.type !== "blocked" ? (
                                                    <>
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <User className="w-4 h-4 text-gray-600" />
                                                            <span className="font-semibold text-brand-dark">
                                                                {appointment.patient}
                                                            </span>
                                                            {!appointment.paid && (
                                                                <span className="px-2 py-0.5 bg-red-500 text-white text-xs rounded-full font-medium">
                                                                    ⚠️ Sin Pagar
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="flex items-center gap-2 text-sm text-gray-600">
                                                            <Clock className="w-4 h-4" />
                                                            <span>{appointment.type === "kinesiologia" ? "Kinesiología" : "Entrenamiento"}</span>
                                                            <span>•</span>
                                                            <span>{appointment.duration} min</span>
                                                        </div>
                                                    </>
                                                ) : (
                                                    <div className="flex items-center gap-2">
                                                        <Lock className="w-4 h-4 text-gray-600" />
                                                        <span className="font-semibold text-gray-700">
                                                            {appointment.patient}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>

                                            <span className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap ${getStatusBadge(appointment.status).color}`}>
                                                {getStatusBadge(appointment.status).label}
                                            </span>
                                        </div>
                                    </motion.div>
                                ) : (
                                    <div className="h-full border-2 border-dashed border-gray-200 rounded-lg flex items-center justify-center hover:border-brand-secondary hover:bg-brand-secondary/5 transition-all cursor-pointer group">
                                        <span className="text-sm text-gray-400 group-hover:text-brand-secondary">
                                            Disponible • Click para agendar
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </Card>
    );
};

// Weekly View Component (Simplified)
const WeeklyView = ({ currentDate }: { currentDate: Date }) => {
    const days = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

    return (
        <Card className="p-6">
            <div className="grid grid-cols-7 gap-4">
                <div className="font-semibold text-gray-600">Hora</div>
                {days.map(day => (
                    <div key={day} className="text-center font-semibold text-gray-600">
                        {day}
                    </div>
                ))}

                {/* Simplified weekly grid */}
                {Array.from({ length: 10 }, (_, hour) => (
                    <div key={hour} className="col-span-7 grid grid-cols-7 gap-4 border-t pt-2">
                        <div className="text-sm text-gray-600">{`${hour + 9}:00`}</div>
                        {days.map((day, i) => (
                            <div
                                key={i}
                                className="h-16 border-2 border-dashed border-gray-200 rounded hover:border-brand-secondary hover:bg-brand-secondary/5 transition-all cursor-pointer"
                            ></div>
                        ))}
                    </div>
                ))}</div>
        </Card>
    );
};

// Monthly View Component
const MonthlyView = ({ currentDate }: { currentDate: Date }) => {
    const getDaysInMonth = (date: Date) => {
        const year = date.getFullYear();
        const month = date.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const daysInMonth = lastDay.getDate();
        const startingDayOfWeek = firstDay.getDay(); // 0 = Sunday

        return { daysInMonth, startingDayOfWeek };
    };

    const { daysInMonth, startingDayOfWeek } = getDaysInMonth(currentDate);

    // Adjust for Monday start (0 = Monday, 6 = Sunday)
    const adjustedStart = startingDayOfWeek === 0 ? 6 : startingDayOfWeek - 1;

    const days = [];
    for (let i = 0; i < adjustedStart; i++) {
        days.push(null); // Empty cells before month starts
    }
    for (let i = 1; i <= daysInMonth; i++) {
        days.push(i);
    }

    const weekDays = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

    // Mock data for appointments per day
    const getAppointmentsForDay = (day: number | null) => {
        if (!day) return 0;
        // Mock: random appointments for demonstration
        if (day % 3 === 0) return 5;
        if (day % 2 === 0) return 3;
        return day % 5 === 0 ? 8 : 0;
    };

    const getLoadColor = (count: number) => {
        if (count === 0) return "bg-gray-50";
        if (count <= 3) return "bg-green-50 border-green-200";
        if (count <= 6) return "bg-yellow-50 border-yellow-200";
        return "bg-red-50 border-red-200";
    };

    return (
        <Card className="p-6">
            <div className="mb-4">
                <h3 className="text-lg font-semibold mb-2">Vista Mensual - Resumen de Carga</h3>
                <div className="flex gap-4 text-sm">
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-green-50 border border-green-200 rounded"></div>
                        <span className="text-gray-600">Baja (1-3)</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-yellow-50 border border-yellow-200 rounded"></div>
                        <span className="text-gray-600">Media (4-6)</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-red-50 border border-red-200 rounded"></div>
                        <span className="text-gray-600">Alta (7+)</span>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-7 gap-2">
                {/* Week day headers */}
                {weekDays.map((day) => (
                    <div key={day} className="text-center font-semibold text-gray-700 py-2">
                        {day}
                    </div>
                ))}

                {/* Calendar days */}
                {days.map((day, index) => {
                    const appointmentCount = getAppointmentsForDay(day);
                    const today = new Date();
                    const isToday = day === today.getDate() &&
                        currentDate.getMonth() === today.getMonth() &&
                        currentDate.getFullYear() === today.getFullYear();

                    return (
                        <div
                            key={index}
                            className={`min-h-[100px] border-2 rounded-lg p-2 transition-all cursor-pointer ${day
                                ? `${getLoadColor(appointmentCount)} hover:shadow-md ${isToday ? 'ring-2 ring-brand-secondary' : ''}`
                                : 'bg-gray-50 border-gray-100'
                                }`}
                        >
                            {day && (
                                <>
                                    <div className="flex items-center justify-between mb-2">
                                        <span className={`text-sm font-semibold ${isToday ? 'text-brand-secondary' : 'text-gray-700'}`}>
                                            {day}
                                        </span>
                                        {isToday && (
                                            <span className="text-xs bg-brand-secondary text-white px-2 py-0.5 rounded-full">
                                                Hoy
                                            </span>
                                        )}
                                    </div>
                                    {appointmentCount > 0 && (
                                        <div className="space-y-1">
                                            <div className="text-xs font-medium text-gray-700">
                                                {appointmentCount} {appointmentCount > 1 ? 'citas' : 'cita'}
                                            </div>
                                            <div className="w-full bg-gray-200 rounded-full h-1.5">
                                                <div
                                                    className={`h-1.5 rounded-full ${appointmentCount <= 3 ? 'bg-green-500' :
                                                        appointmentCount <= 6 ? 'bg-yellow-500' :
                                                            'bg-red-500'
                                                        }`}
                                                    style={{ width: `${Math.min((appointmentCount / 10) * 100, 100)}%` }}
                                                ></div>
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Monthly Stats */}
            <div className="mt-6 grid grid-cols-4 gap-4">
                <div className="p-4 bg-blue-50 rounded-lg">
                    <p className="text-sm text-blue-600 font-medium">Total Citas</p>
                    <p className="text-2xl font-bold text-blue-700">78</p>
                </div>
                <div className="p-4 bg-green-50 rounded-lg">
                    <p className="text-sm text-green-600 font-medium">Completadas</p>
                    <p className="text-2xl font-bold text-green-700">65</p>
                </div>
                <div className="p-4 bg-yellow-50 rounded-lg">
                    <p className="text-sm text-yellow-600 font-medium">Pendientes</p>
                    <p className="text-2xl font-bold text-yellow-700">10</p>
                </div>
                <div className="p-4 bg-red-50 rounded-lg">
                    <p className="text-sm text-red-600 font-medium">Inasistencias</p>
                    <p className="text-2xl font-bold text-red-700">3</p>
                </div>
            </div>
        </Card>
    );
};

// Block Time Modal
const BlockTimeModal = ({ onClose }: { onClose: () => void }) => (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <Card className="w-full max-w-md p-6">
            <h3 className="text-xl font-semibold mb-4">Bloquear Horario</h3>
            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium mb-2">Motivo</label>
                    <select className="w-full border rounded-lg px-3 py-2">
                        <option>Almuerzo</option>
                        <option>Reunión</option>
                        <option>Trámite Personal</option>
                        <option>Capacitación</option>
                        <option>Otro</option>
                    </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium mb-2">Hora Inicio</label>
                        <input type="time" className="w-full border rounded-lg px-3 py-2" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-2">Hora Fin</label>
                        <input type="time" className="w-full border rounded-lg px-3 py-2" />
                    </div>
                </div>

                <div className="flex gap-3 mt-6">
                    <Button onClick={onClose} variant="outline" className="flex-1">
                        Cancelar
                    </Button>
                    <Button className="flex-1 bg-orange-600 hover:bg-orange-700">
                        Bloquear
                    </Button>
                </div>
            </div>
        </Card>
    </div>
);

export default StaffCalendarView;
