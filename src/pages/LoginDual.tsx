import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Mail, Lock, User, Eye, EyeOff, UserCircle, Briefcase, Loader2 } from "lucide-react";
import logoImage from "@/assets/prime-fh-logo.png";
import { motion } from "framer-motion";
import { toast } from "sonner";

const LoginDual = () => {
    const navigate = useNavigate();
    const { login } = useAuth();
    const [activeTab, setActiveTab] = useState("paciente");
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    // Estado para login de paciente
    const [patientIdentifier, setPatientIdentifier] = useState("");
    const [patientPassword, setPatientPassword] = useState("");
    const [loginMethod, setLoginMethod] = useState<"email" | "rut">("email");

    // Estado para login de personal
    const [staffEmail, setStaffEmail] = useState("");
    const [staffPassword, setStaffPassword] = useState("");

    const formatRUT = (value: string) => {
        // Formato: sin puntos, con guión (ej: 12345678-9)
        const cleaned = value.replace(/[^\dkK]/g, '');
        if (cleaned.length <= 1) return cleaned;

        const rut = cleaned.slice(0, -1);
        const dv = cleaned.slice(-1);
        return `${rut}-${dv}`;
    };

    const handleLogin = async (e: React.FormEvent, type: 'patient' | 'staff') => {
        e.preventDefault();
        setIsLoading(true);

        try {
            const identifier = type === 'patient' ? patientIdentifier : staffEmail;
            const password = type === 'patient' ? patientPassword : staffPassword;

            if (type === 'patient' && loginMethod === "rut") {
                const rutPattern = /^\d{7,8}-[\dkK]$/;
                if (!rutPattern.test(patientIdentifier)) {
                    toast.error("RUT inválido. Formato: 12345678-9 (sin puntos, con guión)");
                    setIsLoading(false);
                    return;
                }
            }

            await login({ identifier, password });

            toast.success("Bienvenido a Prime F&H");

            // Redireccionar según el tipo de usuario/tab
            if (type === 'patient') {
                navigate("/app/dashboard");
            } else {
                navigate("/staff-dashboard");
            }
        } catch (error: any) {
            console.error(error);
            toast.error(error.response?.data?.message || "Error al iniciar sesión. Verifica tus credenciales.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-brand-dark via-brand-dark/95 to-brand-secondary/20 flex items-center justify-center p-4">
            {/* Floating background elements */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-brand-secondary/10 rounded-full blur-3xl animate-pulse"></div>
                <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-brand-primary/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
            </div>

            <motion.div
                className="w-full max-w-md relative z-10"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
            >
                {/* Logo */}
                <div className="text-center mb-8">
                    <img
                        src={logoImage}
                        alt="Prime F&H"
                        className="h-16 mx-auto mb-4"
                    />
                    <h1 className="text-3xl font-bold text-white mb-2">Portal Prime F&H</h1>
                    <p className="text-brand-light/70">Accede a tu cuenta</p>
                </div>

                <Card className="bg-white/95 backdrop-blur-sm shadow-elevated border-none p-6">
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                        <TabsList className="grid w-full grid-cols-2 mb-6">
                            <TabsTrigger value="paciente" className="flex items-center gap-2">
                                <UserCircle className="w-4 h-4" />
                                Paciente
                            </TabsTrigger>
                            <TabsTrigger value="personal" className="flex items-center gap-2">
                                <Briefcase className="w-4 h-4" />
                                Personal
                            </TabsTrigger>
                        </TabsList>

                        {/* Login de Paciente */}
                        <TabsContent value="paciente">
                            <form onSubmit={(e) => handleLogin(e, 'patient')} className="space-y-4">
                                <div className="text-center mb-4">
                                    <h2 className="text-xl font-semibold text-brand-dark">Portal del Paciente</h2>
                                    <p className="text-sm text-gray-600 mt-1">Ingresa con tu email o RUT</p>
                                </div>

                                {/* Toggle Email/RUT */}
                                <div className="flex gap-2 p-1 bg-gray-100 rounded-lg">
                                    <button
                                        type="button"
                                        onClick={() => setLoginMethod("email")}
                                        className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-all ${loginMethod === "email"
                                            ? "bg-white text-brand-dark shadow-sm"
                                            : "text-gray-600 hover:text-brand-dark"
                                            }`}
                                    >
                                        Email
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setLoginMethod("rut")}
                                        className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-all ${loginMethod === "rut"
                                            ? "bg-white text-brand-dark shadow-sm"
                                            : "text-gray-600 hover:text-brand-dark"
                                            }`}
                                    >
                                        RUT
                                    </button>
                                </div>

                                <div>
                                    <Label htmlFor="patient-identifier">
                                        {loginMethod === "email" ? "Correo electrónico" : "RUT"}
                                    </Label>
                                    <div className="relative mt-1">
                                        {loginMethod === "email" ? (
                                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                        ) : (
                                            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                        )}
                                        <Input
                                            id="patient-identifier"
                                            type={loginMethod === "email" ? "email" : "text"}
                                            placeholder={loginMethod === "email" ? "tu@correo.com" : "12345678-9"}
                                            value={patientIdentifier}
                                            onChange={(e) => {
                                                if (loginMethod === "rut") {
                                                    setPatientIdentifier(formatRUT(e.target.value));
                                                } else {
                                                    setPatientIdentifier(e.target.value);
                                                }
                                            }}
                                            className="pl-10"
                                            required
                                            disabled={isLoading}
                                        />
                                    </div>
                                    {loginMethod === "rut" && (
                                        <p className="text-xs text-gray-500 mt-1">Sin puntos, con guión (ej: 12345678-9)</p>
                                    )}
                                </div>

                                <div>
                                    <Label htmlFor="patient-password">Contraseña</Label>
                                    <div className="relative mt-1">
                                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                        <Input
                                            id="patient-password"
                                            type={showPassword ? "text" : "password"}
                                            placeholder="Tu contraseña"
                                            value={patientPassword}
                                            onChange={(e) => setPatientPassword(e.target.value)}
                                            className="pl-10 pr-10"
                                            required
                                            disabled={isLoading}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-brand-dark"
                                        >
                                            {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                        </button>
                                    </div>
                                </div>

                                <Button
                                    type="submit"
                                    className="w-full bg-brand-secondary hover:bg-brand-secondary/90"
                                    disabled={isLoading}
                                >
                                    {isLoading ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Ingresando...
                                        </>
                                    ) : (
                                        "Ingresar al Portal"
                                    )}
                                </Button>

                                <div className="text-center space-y-2">
                                    <button
                                        type="button"
                                        onClick={() => navigate('/recuperar-contrasena')}
                                        className="text-sm text-brand-secondary hover:underline"
                                    >
                                        ¿Olvidaste tu contraseña?
                                    </button>
                                    <p className="text-xs text-gray-400">
                                        ¿Primera vez aquí? Usa "Recuperar contraseña" para crear tu acceso.
                                    </p>
                                </div>
                            </form>
                        </TabsContent>

                        {/* Login de Personal */}
                        <TabsContent value="personal">
                            <form onSubmit={(e) => handleLogin(e, 'staff')} className="space-y-4">
                                <div className="text-center mb-4">
                                    <h2 className="text-xl font-semibold text-brand-dark">Personal Prime</h2>
                                    <p className="text-sm text-gray-600 mt-1">Acceso exclusivo para el equipo</p>
                                </div>

                                <div>
                                    <Label htmlFor="staff-email">Correo corporativo</Label>
                                    <div className="relative mt-1">
                                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                        <Input
                                            id="staff-email"
                                            type="email"
                                            placeholder="tu@primefh.cl"
                                            value={staffEmail}
                                            onChange={(e) => setStaffEmail(e.target.value)}
                                            className="pl-10"
                                            required
                                            disabled={isLoading}
                                        />
                                    </div>
                                </div>

                                <div>
                                    <Label htmlFor="staff-password">Contraseña</Label>
                                    <div className="relative mt-1">
                                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                        <Input
                                            id="staff-password"
                                            type={showPassword ? "text" : "password"}
                                            placeholder="Tu contraseña"
                                            value={staffPassword}
                                            onChange={(e) => setStaffPassword(e.target.value)}
                                            className="pl-10 pr-10"
                                            required
                                            disabled={isLoading}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-brand-dark"
                                        >
                                            {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                        </button>
                                    </div>
                                </div>

                                <Button
                                    type="submit"
                                    className="w-full bg-brand-dark hover:bg-brand-dark/90"
                                    disabled={isLoading}
                                >
                                    {isLoading ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Accediendo...
                                        </>
                                    ) : (
                                        "Acceder al Dashboard"
                                    )}
                                </Button>
                            </form>
                        </TabsContent>
                    </Tabs>

                    <div className="mt-6 pt-6 border-t border-gray-200 text-center">
                        <button
                            onClick={() => navigate("/")}
                            className="text-sm text-gray-600 hover:text-brand-dark transition-colors"
                        >
                            ← Volver al sitio
                        </button>
                    </div>
                </Card>
            </motion.div>
        </div>
    );
};

export default LoginDual;
