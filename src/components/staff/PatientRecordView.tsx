import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import SessionForm from "./SessionForm";
import {
    User,
    Calendar,
    FileText,
    Upload,
    Download,
    TrendingUp,
    ClipboardList,
    CheckCircle,
    AlertCircle,
    Image as ImageIcon,
    Video,
    FileCheck,
    DollarSign,
    Ban,
    Plus,
    Stethoscope
} from "lucide-react";
import { Line } from "react-chartjs-2";
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend
} from "chart.js";

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend
);

interface Patient {
    id: string;
    name: string;
    rut: string;
    email: string;
    phone: string;
    age: number;
    condition: string;
    lastVisit: string;
    hasPaid: boolean; // ⚠️ Validación de pago
    paymentType: "monthly" | "per-session";
    sessionsRemaining?: number;
}

interface SOAPRecord {
    date: string;
    subjective: string;
    objective: string;
    assessment: string;
    plan: string;
    attachments?: string[];
}

const PatientRecordView = () => {
    const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
    const [activeTab, setActiveTab] = useState<"info" | "session" | "history" | "soap" | "files" | "progress" | "tasks">("info");
    const [showSOAPTemplates, setShowSOAPTemplates] = useState(false);

    // Mock patient data
    const mockPatient: Patient = {
        id: "1",
        name: "Juan Pérez González",
        rut: "12345678-9",
        email: "juan.perez@email.com",
        phone: "+56 9 1234 5678",
        age: 35,
        condition: "Tendinitis rotuliana + Fortalecimiento",
        lastVisit: "2026-02-05",
        hasPaid: false, // ⚠️ No ha pagado
        paymentType: "monthly",
        sessionsRemaining: 0
    };

    const [patient] = useState<Patient>(mockPatient);
    const [soapData, setSoapData] = useState({
        subjective: "",
        objective: "",
        assessment: "",
        plan: ""
    });

    // Predefined SOAP templates
    const soapTemplates = {
        subjective: [
            "Paciente refiere dolor moderado (EVA 5/10)",
            "Refiere mejoría significativa desde última sesión",
            "Sin quejas al momento de la evaluación",
            "Dolor agudo post-ejercicio"
        ],
        objective: [
            "ROM rodilla: Flexión 120°, Extensión completa",
            "Fuerza muscular: 4/5 en cuádriceps",
            "Marcha sin alteraciones evidentes",
            "Edema leve en región patelar"
        ],
        assessment: [
            "Evolución favorable, cumple objetivos terapéuticos",
            "Persiste limitación funcional en actividades de alto impacto",
            "Alta kinesiológica programada para próxima sesión",
            "Requiere continuidad en tratamiento"
        ],
        plan: [
            "Continuar con ejercicios de fortalecimiento 3x/semana",
            "Aplicar crioterapia post-ejercicio 15 min",
            "Progresar carga en sentadillas según tolerancia",
            "Control en 1 semana"
        ]
    };

    // Mock progress data
    const progressData = {
        labels: ["Sem 1", "Sem 2", "Sem 3", "Sem 4", "Sem 5", "Sem 6"],
        datasets: [
            {
                label: "Dolor (EVA 0-10)",
                data: [8, 7, 6, 5, 4, 3],
                borderColor: "rgb(239, 68, 68)",
                backgroundColor: "rgba(239, 68, 68, 0.1)",
                tension: 0.4
            },
            {
                label: "Rango de Movimiento (grados)",
                data: [80, 90, 100, 110, 115, 120],
                borderColor: "rgb(59, 130, 246)",
                backgroundColor: "rgba(59, 130, 246, 0.1)",
                tension: 0.4
            }
        ]
    };

    const insertTemplate = (field: keyof typeof soapData, text: string) => {
        setSoapData(prev => ({
            ...prev,
            [field]: prev[field] ? `${prev[field]}\n${text}` : text
        }));
    };

    const handleScheduleAppointment = () => {
        if (!patient.hasPaid) {
            alert("⚠️ ATENCIÓN: El paciente no ha realizado el pago. Debe registrar el pago antes de agendar una nueva sesión.");
            return;
        }

        if (patient.paymentType === "per-session" && (patient.sessionsRemaining || 0) <= 0) {
            alert("⚠️ ATENCIÓN: El paciente no tiene sesiones disponibles. Debe adquirir más sesiones antes de agendar.");
            return;
        }

        alert("✅ Pago verificado. Procediendo a agendar...");
    };

    return (
        <div className="space-y-6">
            {/* Patient Header */}
            <Card className="p-6">
                <div className="flex items-start justify-between">
                    <div className="flex gap-6">
                        <div className="w-20 h-20 bg-brand-secondary/20 rounded-full flex items-center justify-center">
                            <User className="w-10 h-10 text-brand-secondary" />
                        </div>

                        <div>
                            <h2 className="text-2xl font-bold text-brand-dark mb-1">{patient.name}</h2>
                            <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm text-gray-600">
                                <div><span className="font-medium">RUT:</span> {patient.rut}</div>
                                <div><span className="font-medium">Edad:</span> {patient.age} años</div>
                                <div><span className="font-medium">Email:</span> {patient.email}</div>
                                <div><span className="font-medium">Teléfono:</span> {patient.phone}</div>
                                <div className="col-span-2"><span className="font-medium">Diagnóstico:</span> {patient.condition}</div>
                            </div>
                        </div>
                    </div>

                    {/* Payment Status */}
                    <div className="space-y-2">
                        {patient.hasPaid ? (
                            <div className="flex items-center gap-2 px-4 py-2 bg-green-50 border border-green-200 rounded-lg">
                                <CheckCircle className="w-5 h-5 text-green-600" />
                                <div>
                                    <p className="text-sm font-semibold text-green-700">Pago al Día</p>
                                    <p className="text-xs text-green-600">
                                        {patient.paymentType === "monthly"
                                            ? "Plan Mensual Activo"
                                            : `${patient.sessionsRemaining} sesiones restantes`
                                        }
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 px-4 py-2 bg-red-50 border border-red-200 rounded-lg">
                                <AlertCircle className="w-5 h-5 text-red-600" />
                                <div>
                                    <p className="text-sm font-semibold text-red-700">Pago Pendiente</p>
                                    <p className="text-xs text-red-600">No puede agendar</p>
                                </div>
                            </div>
                        )}

                        <Button
                            onClick={handleScheduleAppointment}
                            size="sm"
                            className="w-full"
                            disabled={!patient.hasPaid}
                        >
                            <Calendar className="w-4 h-4 mr-2" />
                            Agendar Cita
                        </Button>
                    </div>
                </div>
            </Card>

            {/* Navigation Tabs */}
            <div className="flex gap-2 border-b-2 border-gray-200 overflow-x-auto">
                {[
                    { id: "info", label: "Información", icon: User },
                    { id: "session", label: "Sesión Activa", icon: Stethoscope },
                    { id: "history", label: "Historial", icon: FileText },
                    { id: "soap", label: "SOAP (Nueva Evolución)", icon: ClipboardList },
                    { id: "files", label: "Archivos", icon: Upload },
                    { id: "progress", label: "Progreso", icon: TrendingUp },
                    { id: "tasks", label: "Tareas/Ejercicios", icon: CheckCircle }
                ].map((tab) => {
                    const Icon = tab.icon;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`flex items-center gap-2 px-4 py-3 border-b-4 transition-all whitespace-nowrap ${activeTab === tab.id
                                ? "border-brand-secondary text-brand-secondary font-semibold"
                                : "border-transparent text-gray-600 hover:text-brand-dark"
                                }`}
                        >
                            <Icon className="w-5 h-5" />
                            {tab.label}
                        </button>
                    );
                })}
            </div>

            {/* Tab Content */}
            <div>
                {activeTab === "info" && <PatientInfoTab patient={patient} />}
                {activeTab === "session" && <SessionForm patientName={patient.name} sessionType="kinesiología" />}
                {activeTab === "history" && <HistoryTab />}
                {activeTab === "soap" && (
                    <SOAPTab
                        soapData={soapData}
                        setSoapData={setSoapData}
                        templates={soapTemplates}
                        insertTemplate={insertTemplate}
                    />
                )}
                {activeTab === "files" && <FilesTab />}
                {activeTab === "progress" && <ProgressTab data={progressData} />}
                {activeTab === "tasks" && <TasksTab />}
            </div>
        </div>
    );
};

// Patient Info Tab
const PatientInfoTab = ({ patient }: { patient: Patient }) => (
    <Card className="p-6">
        <div className="grid grid-cols-2 gap-6">
            <div>
                <h3 className="text-lg font-semibold mb-4">Datos Personales</h3>
                <div className="space-y-3">
                    <InfoField label="Nombre Completo" value={patient.name} />
                    <InfoField label="RUT" value={patient.rut} />
                    <InfoField label="Edad" value={`${patient.age} años`} />
                    <InfoField label="Email" value={patient.email} />
                    <InfoField label="Teléfono" value={patient.phone} />
                </div>
            </div>

            <div>
                <h3 className="text-lg font-semibold mb-4">Estado de Pagos</h3>
                <div className="space-y-3">
                    <InfoField
                        label="Tipo de Plan"
                        value={patient.paymentType === "monthly" ? "Mensual" : "Por Sesión"}
                    />
                    <InfoField
                        label="Estado"
                        value={patient.hasPaid ? "✅ Pagado" : "❌ Pendiente"}
                    />
                    {patient.paymentType === "per-session" && (
                        <InfoField
                            label="Sesiones Restantes"
                            value={patient.sessionsRemaining?.toString() || "0"}
                        />
                    )}
                    <div className="pt-4">
                        <Button size="sm" className="w-full bg-green-600 hover:bg-green-700">
                            <DollarSign className="w-4 h-4 mr-2" />
                            Registrar Pago
                        </Button>
                    </div>
                </div>
            </div>

            <div className="col-span-2">
                <h3 className="text-lg font-semibold mb-4">Consentimientos Informados</h3>
                <div className="space-y-2">
                    <ConsentItem name="Consentimiento Informado General" signed={true} date="2026-01-15" />
                    <ConsentItem name="Autorización de Tratamiento" signed={true} date="2026-01-15" />
                    <ConsentItem name="Política de Privacidad RGPD" signed={false} />
                </div>
            </div>
        </div>
    </Card>
);

const InfoField = ({ label, value }: { label: string; value: string }) => (
    <div>
        <p className="text-sm text-gray-600">{label}</p>
        <p className="font-medium text-brand-dark">{value}</p>
    </div>
);

const ConsentItem = ({ name, signed, date }: { name: string; signed: boolean; date?: string }) => (
    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
        <div className="flex items-center gap-3">
            {signed ? (
                <CheckCircle className="w-5 h-5 text-green-600" />
            ) : (
                <AlertCircle className="w-5 h-5 text-orange-600" />
            )}
            <div>
                <p className="font-medium text-sm">{name}</p>
                {date && <p className="text-xs text-gray-600">Firmado: {date}</p>}
            </div>
        </div>
        {!signed && (
            <Button size="sm" variant="outline">
                Solicitar Firma
            </Button>
        )}
    </div>
);

// History Tab (Historial Longitudinal)
const HistoryTab = () => (
    <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Historial de Sesiones</h3>
        <div className="space-y-3">
            <HistoryItem
                date="2026-02-05"
                type="Kinesiología"
                summary="Ejercicios de fortalecimiento. EVA 4/10. Buena evolución."
                professional="Mario Martínez P."
            />
            <HistoryItem
                date="2026-02-01"
                type="Entrenamiento"
                summary="Rutina de bajo impacto. Tolerancia adecuada."
                professional="Felipe Vega P."
            />
            <HistoryItem
                date="2026-01-29"
                type="Kinesiología"
                summary="Evaluación inicial. ROM limitado. Dolor EVA 7/10."
                professional="Tomás Espinoza"
            />
        </div>
    </Card>
);

const HistoryItem = ({ date, type, summary, professional }: any) => (
    <div className="p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer">
        <div className="flex items-start justify-between mb-2">
            <div>
                <span className="text-sm font-semibold text-brand-dark">{date}</span>
                <span className="mx-2 text-gray-400">•</span>
                <span className="text-sm text-brand-secondary font-medium">{type}</span>
            </div>
            <FileText className="w-5 h-5 text-gray-400" />
        </div>
        <p className="text-sm text-gray-700 mb-1">{summary}</p>
        <p className="text-xs text-gray-500">Atendido por: {professional}</p>
    </div>
);

// SOAP Tab
const SOAPTab = ({ soapData, setSoapData, templates, insertTemplate }: any) => (
    <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold">Nueva Evolución SOAP</h3>
            <Button size="sm" variant="outline">
                <Download className="w-4 h-4 mr-2" />
                Guardar Evolución
            </Button>
        </div>

        <div className="space-y-6">
            {Object.keys(soapData).map((field) => {
                const labels = {
                    subjective: "S - Subjetivo (lo que refiere el paciente)",
                    objective: "O - Objetivo (lo que observas/mides)",
                    assessment: "A - Análisis (tu interpretación clínica)",
                    plan: "P - Plan (qué harás a continuación)"
                };

                return (
                    <div key={field}>
                        <div className="flex items-center justify-between mb-2">
                            <Label className="font-semibold text-brand-dark">
                                {labels[field as keyof typeof labels]}
                            </Label>
                            <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => { }}
                                className="text-xs"
                            >
                                Ver Plantillas
                            </Button>
                        </div>

                        {/* Template Quick Buttons */}
                        <div className="flex flex-wrap gap-2 mb-2">
                            {templates[field].slice(0, 2).map((template: string, idx: number) => (
                                <button
                                    key={idx}
                                    onClick={() => insertTemplate(field, template)}
                                    className="text-xs px-2 py-1 bg-gray-100 hover:bg-brand-secondary/10 rounded border border-gray-200 hover:border-brand-secondary transition-all"
                                >
                                    + {template.slice(0, 40)}...
                                </button>
                            ))}
                        </div>

                        <Textarea
                            value={soapData[field]}
                            onChange={(e) => setSoapData((prev: any) => ({ ...prev, [field]: e.target.value }))}
                            placeholder={`Describe ${field === "subjective" ? "lo que el paciente refiere" : field === "objective" ? "tus observaciones" : field === "assessment" ? "tu análisis" : "el plan terapéutico"}...`}
                            rows={4}
                            className="resize-none"
                        />
                    </div>
                );
            })}
        </div>
    </Card>
);

const Label = ({ children, className }: any) => (
    <label className={`block text-sm font-medium mb-1 ${className}`}>{children}</label>
);

// Files Tab
const FilesTab = () => (
    <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold">Archivos y Multimedia</h3>
            <Button size="sm">
                <Upload className="w-4 h-4 mr-2" />
                Subir Archivo
            </Button>
        </div>

        <div className="grid grid-cols-3 gap-4">
            <FileItem name="Radiografía_rodilla.jpg" type="image" date="2026-01-29" />
            <FileItem name="Orden_medica.pdf" type="pdf" date="2026-01-28" />
            <FileItem name="Video_ejercicio_sentadilla.mp4" type="video" date="2026-02-01" />
        </div>
    </Card>
);

const FileItem = ({ name, type, date }: any) => {
    const icons = {
        image: ImageIcon,
        pdf: FileCheck,
        video: Video
    };
    const Icon = icons[type as keyof typeof icons];

    return (
        <div className="p-4 border-2 border-gray-200 rounded-lg hover:border-brand-secondary transition-all cursor-pointer">
            <Icon className="w-8 h-8 text-gray-400 mb-2" />
            <p className="text-sm font-medium text-brand-dark truncate">{name}</p>
            <p className="text-xs text-gray-500 mt-1">{date}</p>
        </div>
    );
};

// Progress Tab - EXPANDIDO con múltiples métricas
const ProgressTab = ({ data }: any) => {
    const [selectedMetric, setSelectedMetric] = useState<"dolor" | "medidas" | "pesos" | "saltos">("dolor");

    // Data para cada métrica
    const painData = {
        labels: ["Sem 1", "Sem 2", "Sem 3", "Sem 4", "Sem 5", "Sem 6"],
        datasets: [
            {
                label: "Dolor en Reposo (EVA 0-10)",
                data: [8, 7, 6, 5, 4, 3],
                borderColor: "rgb(239, 68, 68)",
                backgroundColor: "rgba(239, 68, 68, 0.1)",
                tension: 0.4
            },
            {
                label: "Dolor en Actividad (EVA 0-10)",
                data: [9, 8, 7, 6, 5, 4],
                borderColor: "rgb(251, 146, 60)",
                backgroundColor: "rgba(251, 146, 60, 0.1)",
                tension: 0.4
            }
        ]
    };

    const measurementsData = {
        labels: ["Sem 1", "Sem 2", "Sem 3", "Sem 4", "Sem 5", "Sem 6"],
        datasets: [
            {
                label: "Perímetro Muslo (cm)",
                data: [52, 53, 54, 54.5, 55, 55.5],
                borderColor: "rgb(59, 130, 246)",
                backgroundColor: "rgba(59, 130, 246, 0.1)",
                tension: 0.4
            },
            {
                label: "Rango de Movimiento (grados)",
                data: [80, 90, 100, 110, 115, 120],
                borderColor: "rgb(16, 185, 129)",
                backgroundColor: "rgba(16, 185, 129, 0.1)",
                tension: 0.4
            },
            {
                label: "Peso Corporal (kg)",
                data: [75, 74.5, 74, 73.5, 73, 72.5],
                borderColor: "rgb(168, 85, 247)",
                backgroundColor: "rgba(168, 85, 247, 0.1)",
                tension: 0.4
            }
        ]
    };

    const weightsData = {
        labels: ["Sem 1", "Sem 2", "Sem 3", "Sem 4", "Sem 5", "Sem 6"],
        datasets: [
            {
                label: "Sentadilla (kg)",
                data: [20, 25, 30, 35, 40, 45],
                borderColor: "rgb(239, 68, 68)",
                backgroundColor: "rgba(239, 68, 68, 0.1)",
                tension: 0.4
            },
            {
                label: "Press de Pierna (kg)",
                data: [40, 50, 60, 70, 80, 85],
                borderColor: "rgb(59, 130, 246)",
                backgroundColor: "rgba(59, 130, 246, 0.1)",
                tension: 0.4
            },
            {
                label: "Extensión de Rodilla (kg)",
                data: [10, 12, 15, 18, 20, 22],
                borderColor: "rgb(16, 185, 129)",
                backgroundColor: "rgba(16, 185, 129, 0.1)",
                tension: 0.4
            }
        ]
    };

    const jumpsData = {
        labels: ["Sem 1", "Sem 2", "Sem 3", "Sem 4", "Sem 5", "Sem 6"],
        datasets: [
            {
                label: "Salto Vertical (cm)",
                data: [25, 28, 32, 35, 38, 42],
                borderColor: "rgb(139, 92, 246)",
                backgroundColor: "rgba(139, 92, 246, 0.1)",
                tension: 0.4
            },
            {
                label: "Salto Horizontal (cm)",
                data: [120, 130, 140, 150, 160, 165],
                borderColor: "rgb(236, 72, 153)",
                backgroundColor: "rgba(236, 72, 153, 0.1)",
                tension: 0.4
            },
            {
                label: "Triple Salto (cm)",
                data: [300, 320, 340, 360, 380, 400],
                borderColor: "rgb(251, 146, 60)",
                backgroundColor: "rgba(251, 146, 60, 0.1)",
                tension: 0.4
            }
        ]
    };

    const metrics = {
        dolor: {
            title: "Evolución del Dolor",
            data: painData,
            color: "red"
        },
        medidas: {
            title: "Medidas y Antropometría",
            data: measurementsData,
            color: "blue"
        },
        pesos: {
            title: "Progreso de Fuerza (Pesos)",
            data: weightsData,
            color: "green"
        },
        saltos: {
            title: "Capacidad de Salto",
            data: jumpsData,
            color: "purple"
        }
    };

    const currentMetric = metrics[selectedMetric];

    return (
        <div className="space-y-6">
            {/* Metric Selector */}
            <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4">Selecciona la Métrica a Visualizar</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <MetricButton
                        icon="📊"
                        title="Dolor"
                        subtitle="Escala EVA"
                        active={selectedMetric === "dolor"}
                        onClick={() => setSelectedMetric("dolor")}
                        color="red"
                    />
                    <MetricButton
                        icon="📏"
                        title="Medidas"
                        subtitle="Antropometría"
                        active={selectedMetric === "medidas"}
                        onClick={() => setSelectedMetric("medidas")}
                        color="blue"
                    />
                    <MetricButton
                        icon="💪"
                        title="Pesos"
                        subtitle="Fuerza"
                        active={selectedMetric === "pesos"}
                        onClick={() => setSelectedMetric("pesos")}
                        color="green"
                    />
                    <MetricButton
                        icon="🦘"
                        title="Saltos"
                        subtitle="Potencia"
                        active={selectedMetric === "saltos"}
                        onClick={() => setSelectedMetric("saltos")}
                        color="purple"
                    />
                </div>
            </Card>

            {/* Chart Display */}
            <Card className="p-6">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-semibold">{currentMetric.title}</h3>
                    <Button size="sm" variant="outline">
                        <Download className="w-4 h-4 mr-2" />
                        Exportar Datos
                    </Button>
                </div>
                <div className="h-96">
                    <Line
                        data={currentMetric.data}
                        options={{
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: {
                                legend: {
                                    position: "top" as const
                                },
                                title: {
                                    display: true,
                                    text: `${currentMetric.title} - Últimas 6 Semanas`
                                }
                            },
                            scales: {
                                y: {
                                    beginAtZero: true
                                }
                            }
                        }}
                    />
                </div>
            </Card>

            {/* Summary Stats */}
            <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4">Resumen de Progreso</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <StatItem
                        label="Primera Sesión"
                        value={selectedMetric === "dolor" ? "EVA 8/10" : selectedMetric === "medidas" ? "80°" : selectedMetric === "pesos" ? "20 kg" : "25 cm"}
                        color="gray"
                    />
                    <StatItem
                        label="Última Sesión"
                        value={selectedMetric === "dolor" ? "EVA 3/10" : selectedMetric === "medidas" ? "120°" : selectedMetric === "pesos" ? "45 kg" : "42 cm"}
                        color="green"
                    />
                    <StatItem
                        label="Mejora Total"
                        value={selectedMetric === "dolor" ? "-62.5%" : selectedMetric === "medidas" ? "+50%" : selectedMetric === "pesos" ? "+125%" : "+68%"}
                        color="blue"
                    />
                    <StatItem
                        label="Tendencia"
                        value="📈 Positiva"
                        color="green"
                    />
                </div>
            </Card>
        </div>
    );
};

// Metric Button Component
const MetricButton = ({ icon, title, subtitle, active, onClick, color }: any) => {
    const colors = {
        red: active ? "bg-red-50 border-red-500 text-red-700" : "border-gray-200 hover:border-red-300",
        blue: active ? "bg-blue-50 border-blue-500 text-blue-700" : "border-gray-200 hover:border-blue-300",
        green: active ? "bg-green-50 border-green-500 text-green-700" : "border-gray-200 hover:border-green-300",
        purple: active ? "bg-purple-50 border-purple-500 text-purple-700" : "border-gray-200 hover:border-purple-300"
    };

    return (
        <button
            onClick={onClick}
            className={`p-4 rounded-lg border-2 transition-all text-left ${colors[color as keyof typeof colors]}`}
        >
            <div className="text-2xl mb-2">{icon}</div>
            <p className="font-semibold text-sm">{title}</p>
            <p className="text-xs opacity-70">{subtitle}</p>
        </button>
    );
};

// Stat Item Component
const StatItem = ({ label, value, color }: any) => {
    const colors = {
        gray: "bg-gray-50 text-gray-700",
        green: "bg-green-50 text-green-700",
        blue: "bg-blue-50 text-blue-700"
    };

    return (
        <div className={`p-4 rounded-lg ${colors[color as keyof typeof colors]}`}>
            <p className="text-xs opacity-70 mb-1">{label}</p>
            <p className="text-lg font-bold">{value}</p>
        </div>
    );
};

// Tasks Tab
const TasksTab = () => (
    <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold">Ejercicios para Casa</h3>
            <Button size="sm">
                <Plus className="w-4 h-4 mr-2" />
                Nueva Tarea
            </Button>
        </div>

        <div className="space-y-3">
            <TaskItem
                title="Sentadillas con peso corporal"
                description="3 series de 12 repeticiones, 2 veces al día"
                status="active"
            />
            <TaskItem
                title="Estiramiento de cuádriceps"
                description="Mantener 30 segundos, 3 repeticiones cada pierna"
                status="active"
            />
            <TaskItem
                title="Aplicar hielo después de ejercicios"
                description="15 minutos, 2 veces al día"
                status="completed"
            />
        </div>
    </Card>
);

const TaskItem = ({ title, description, status }: any) => (
    <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg">
        {status === "active" ? (
            <div className="w-5 h-5 border-2 border-brand-secondary rounded mt-0.5" />
        ) : (
            <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
        )}
        <div className="flex-1">
            <p className="font-medium text-brand-dark">{title}</p>
            <p className="text-sm text-gray-600 mt-1">{description}</p>
        </div>
    </div>
);

export default PatientRecordView;
