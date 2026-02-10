import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';
import {
    Mail,
    CreditCard,
    Phone,
    Calendar,
    Eye,
    EyeOff,
    Loader2,
    ArrowLeft,
    ShieldCheck,
    KeyRound,
    CheckCircle2,
    User
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import logoImage from '@/assets/prime-fh-logo.png';
import api from '@/lib/api';

type Step = 'identify' | 'verify' | 'set-password' | 'success';

const RecoverPassword = () => {
    const navigate = useNavigate();
    const { loginWithToken } = useAuth();

    const [step, setStep] = useState<Step>('identify');
    const [loading, setLoading] = useState(false);

    // Step 1: Identificación
    const [identifyMethod, setIdentifyMethod] = useState<'rut' | 'email'>('rut');
    const [identifier, setIdentifier] = useState('');

    // Step 2: Verificación
    const [verifyMethod, setVerifyMethod] = useState<'phone' | 'dob'>('phone');
    const [phone, setPhone] = useState('');
    const [dateOfBirth, setDateOfBirth] = useState('');

    // Step 3: Nueva contraseña
    const [verifyToken, setVerifyToken] = useState('');
    const [firstName, setFirstName] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    const formatRUT = (value: string) => {
        const cleaned = value.replace(/[^\dkK]/g, '');
        if (cleaned.length <= 1) return cleaned;
        const rut = cleaned.slice(0, -1);
        const dv = cleaned.slice(-1);
        return `${rut}-${dv}`;
    };

    // ─── Step 1 → Step 2: Enviar identificación ───────────────────────
    const handleIdentify = (e: React.FormEvent) => {
        e.preventDefault();
        if (!identifier.trim()) {
            toast.error('Ingresa tu RUT o correo electrónico');
            return;
        }
        setStep('verify');
    };

    // ─── Step 2 → Step 3: Verificar identidad ─────────────────────────
    const handleVerify = async (e: React.FormEvent) => {
        e.preventDefault();
        if (verifyMethod === 'phone' && !phone.trim()) {
            toast.error('Ingresa tu número de teléfono');
            return;
        }
        if (verifyMethod === 'dob' && !dateOfBirth) {
            toast.error('Ingresa tu fecha de nacimiento');
            return;
        }

        setLoading(true);
        try {
            const response = await api.post('/auth/verify-identity', {
                identifier: identifier.trim(),
                phone: verifyMethod === 'phone' ? phone.trim() : undefined,
                dateOfBirth: verifyMethod === 'dob' ? dateOfBirth : undefined
            });

            setVerifyToken(response.data.data.verifyToken);
            setFirstName(response.data.data.firstName);
            setStep('set-password');
            toast.success('¡Identidad verificada!');
        } catch (err: unknown) {
            const error = err as { response?: { data?: { message?: string } } };
            toast.error(error.response?.data?.message || 'Error al verificar identidad');
        } finally {
            setLoading(false);
        }
    };

    // ─── Step 3: Establecer contraseña ─────────────────────────────────
    const handleSetPassword = async (e: React.FormEvent) => {
        e.preventDefault();

        if (newPassword.length < 6) {
            toast.error('La contraseña debe tener al menos 6 caracteres');
            return;
        }
        if (newPassword !== confirmPassword) {
            toast.error('Las contraseñas no coinciden');
            return;
        }

        setLoading(true);
        try {
            const response = await api.put(`/auth/set-password/${verifyToken}`, {
                newPassword,
                confirmPassword
            });

            // Login automático
            if (response.data.data?.token) {
                loginWithToken(response.data.data.token, response.data.data.user);
            }

            setStep('success');
            toast.success('¡Contraseña creada exitosamente!');
        } catch (err: unknown) {
            const error = err as { response?: { data?: { message?: string } } };
            toast.error(error.response?.data?.message || 'Error al crear contraseña');
        } finally {
            setLoading(false);
        }
    };

    const goBack = () => {
        if (step === 'verify') setStep('identify');
        else if (step === 'set-password') setStep('verify');
        else navigate('/login');
    };

    // ─── Indicador de fortaleza ────────────────────────────────────────
    const getPasswordStrength = (pw: string) => {
        let score = 0;
        if (pw.length >= 6) score++;
        if (pw.length >= 8) score++;
        if (/[A-Z]/.test(pw)) score++;
        if (/[0-9]/.test(pw)) score++;
        if (/[^A-Za-z0-9]/.test(pw)) score++;
        return score;
    };

    const strength = getPasswordStrength(newPassword);
    const strengthLabels = ['', 'Muy débil', 'Débil', 'Aceptable', 'Fuerte', 'Muy fuerte'];
    const strengthColors = ['', 'bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-green-500', 'bg-emerald-500'];

    return (
        <div className="min-h-screen bg-gradient-to-br from-brand-dark via-brand-dark/95 to-brand-secondary/20 flex items-center justify-center p-4">
            {/* Background */}
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
                <div className="text-center mb-6">
                    <img src={logoImage} alt="Prime F&H" className="h-14 mx-auto mb-3" />
                    <h1 className="text-2xl font-bold text-white">
                        {step === 'success' ? '¡Listo!' : 'Crear / Recuperar Contraseña'}
                    </h1>
                    <p className="text-brand-light/70 text-sm mt-1">
                        {step === 'identify' && 'Ingresa tu RUT o correo para comenzar'}
                        {step === 'verify' && 'Verifica tu identidad'}
                        {step === 'set-password' && 'Elige tu nueva contraseña'}
                        {step === 'success' && 'Tu cuenta está lista'}
                    </p>
                </div>

                {/* Progress Steps */}
                {step !== 'success' && (
                    <div className="flex items-center justify-center gap-2 mb-6">
                        {[
                            { step: 'identify', label: '1', icon: User },
                            { step: 'verify', label: '2', icon: ShieldCheck },
                            { step: 'set-password', label: '3', icon: KeyRound }
                        ].map((s, i) => {
                            const stepOrder = ['identify', 'verify', 'set-password'];
                            const currentIndex = stepOrder.indexOf(step);
                            const thisIndex = stepOrder.indexOf(s.step);
                            const isActive = thisIndex === currentIndex;
                            const isCompleted = thisIndex < currentIndex;

                            return (
                                <div key={s.step} className="flex items-center gap-2">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold  transition-all ${isActive ? 'bg-brand-secondary text-white scale-110' :
                                            isCompleted ? 'bg-green-500 text-white' :
                                                'bg-white/20 text-white/40'
                                        }`}>
                                        {isCompleted ? <CheckCircle2 className="w-4 h-4" /> : s.label}
                                    </div>
                                    {i < 2 && (
                                        <div className={`w-8 h-0.5 ${isCompleted ? 'bg-green-500' : 'bg-white/20'}`} />
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}

                <Card className="bg-white/95 backdrop-blur-sm shadow-elevated border-none p-6">
                    <AnimatePresence mode="wait">

                        {/* ═══ STEP 1: Identificación ═══ */}
                        {step === 'identify' && (
                            <motion.form
                                key="identify"
                                onSubmit={handleIdentify}
                                className="space-y-4"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                            >
                                <div className="text-center mb-4">
                                    <div className="w-14 h-14 bg-blue-100 rounded-xl flex items-center justify-center mx-auto mb-3">
                                        <User className="w-7 h-7 text-blue-600" />
                                    </div>
                                    <h2 className="text-lg font-semibold text-brand-dark">¿Cómo te identificas?</h2>
                                    <p className="text-xs text-gray-500 mt-1">
                                        Si fuiste inscrito por el equipo Prime F&H, tu cuenta ya existe. Solo necesitas crear tu contraseña.
                                    </p>
                                </div>

                                {/* Toggle RUT/Email */}
                                <div className="flex gap-2 p-1 bg-gray-100 rounded-lg">
                                    <button
                                        type="button"
                                        onClick={() => { setIdentifyMethod('rut'); setIdentifier(''); }}
                                        className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${identifyMethod === 'rut' ? 'bg-white text-brand-dark shadow-sm' : 'text-gray-600'
                                            }`}
                                    >
                                        <CreditCard className="w-4 h-4" /> RUT
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => { setIdentifyMethod('email'); setIdentifier(''); }}
                                        className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${identifyMethod === 'email' ? 'bg-white text-brand-dark shadow-sm' : 'text-gray-600'
                                            }`}
                                    >
                                        <Mail className="w-4 h-4" /> Email
                                    </button>
                                </div>

                                <div>
                                    <Label>{identifyMethod === 'rut' ? 'RUT' : 'Correo electrónico'}</Label>
                                    <div className="relative mt-1">
                                        {identifyMethod === 'rut' ? (
                                            <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                        ) : (
                                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                        )}
                                        <Input
                                            type={identifyMethod === 'email' ? 'email' : 'text'}
                                            placeholder={identifyMethod === 'rut' ? '12345678-9' : 'tu@correo.com'}
                                            value={identifier}
                                            onChange={(e) => setIdentifier(
                                                identifyMethod === 'rut' ? formatRUT(e.target.value) : e.target.value
                                            )}
                                            className="pl-10"
                                            required
                                        />
                                    </div>
                                    {identifyMethod === 'rut' && (
                                        <p className="text-xs text-gray-500 mt-1">Sin puntos, con guión</p>
                                    )}
                                </div>

                                <Button type="submit" className="w-full bg-brand-secondary hover:bg-brand-secondary/90">
                                    Continuar
                                </Button>
                            </motion.form>
                        )}

                        {/* ═══ STEP 2: Verificación ═══ */}
                        {step === 'verify' && (
                            <motion.form
                                key="verify"
                                onSubmit={handleVerify}
                                className="space-y-4"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                            >
                                <div className="text-center mb-4">
                                    <div className="w-14 h-14 bg-green-100 rounded-xl flex items-center justify-center mx-auto mb-3">
                                        <ShieldCheck className="w-7 h-7 text-green-600" />
                                    </div>
                                    <h2 className="text-lg font-semibold text-brand-dark">Verificación de Identidad</h2>
                                    <p className="text-xs text-gray-500 mt-1">
                                        Para proteger tu cuenta, necesitamos verificar tu identidad con un dato personal.
                                    </p>
                                </div>

                                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                                    <p className="text-xs text-blue-700">
                                        <strong>Cuenta:</strong> {identifier}
                                    </p>
                                </div>

                                {/* Toggle Teléfono/Fecha */}
                                <div className="flex gap-2 p-1 bg-gray-100 rounded-lg">
                                    <button
                                        type="button"
                                        onClick={() => setVerifyMethod('phone')}
                                        className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${verifyMethod === 'phone' ? 'bg-white text-brand-dark shadow-sm' : 'text-gray-600'
                                            }`}
                                    >
                                        <Phone className="w-4 h-4" /> Teléfono
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setVerifyMethod('dob')}
                                        className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${verifyMethod === 'dob' ? 'bg-white text-brand-dark shadow-sm' : 'text-gray-600'
                                            }`}
                                    >
                                        <Calendar className="w-4 h-4" /> Fecha de Nac.
                                    </button>
                                </div>

                                {verifyMethod === 'phone' ? (
                                    <div>
                                        <Label>Número de teléfono registrado</Label>
                                        <div className="relative mt-1">
                                            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                            <Input
                                                type="tel"
                                                placeholder="+569 1234 5678"
                                                value={phone}
                                                onChange={(e) => setPhone(e.target.value)}
                                                className="pl-10"
                                                required
                                            />
                                        </div>
                                        <p className="text-xs text-gray-500 mt-1">Ingresa el teléfono que registraste con Prime F&H</p>
                                    </div>
                                ) : (
                                    <div>
                                        <Label>Fecha de nacimiento</Label>
                                        <div className="relative mt-1">
                                            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                            <Input
                                                type="date"
                                                value={dateOfBirth}
                                                onChange={(e) => setDateOfBirth(e.target.value)}
                                                className="pl-10"
                                                required
                                            />
                                        </div>
                                    </div>
                                )}

                                <Button type="submit" className="w-full bg-brand-secondary hover:bg-brand-secondary/90" disabled={loading}>
                                    {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Verificando...</> : 'Verificar Identidad'}
                                </Button>
                            </motion.form>
                        )}

                        {/* ═══ STEP 3: Nueva Contraseña ═══ */}
                        {step === 'set-password' && (
                            <motion.form
                                key="set-password"
                                onSubmit={handleSetPassword}
                                className="space-y-4"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                            >
                                <div className="text-center mb-4">
                                    <div className="w-14 h-14 bg-purple-100 rounded-xl flex items-center justify-center mx-auto mb-3">
                                        <KeyRound className="w-7 h-7 text-purple-600" />
                                    </div>
                                    <h2 className="text-lg font-semibold text-brand-dark">
                                        ¡Hola, {firstName}! 👋
                                    </h2>
                                    <p className="text-xs text-gray-500 mt-1">
                                        Crea tu contraseña personal para acceder a tu Portal del Paciente
                                    </p>
                                </div>

                                <div>
                                    <Label>Nueva contraseña</Label>
                                    <div className="relative mt-1">
                                        <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                        <Input
                                            type={showPassword ? 'text' : 'password'}
                                            placeholder="Mínimo 6 caracteres"
                                            value={newPassword}
                                            onChange={(e) => setNewPassword(e.target.value)}
                                            className="pl-10 pr-10"
                                            required
                                            minLength={6}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-brand-dark"
                                        >
                                            {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                        </button>
                                    </div>

                                    {/* Password strength indicator */}
                                    {newPassword.length > 0 && (
                                        <div className="mt-2 space-y-1">
                                            <div className="flex gap-1">
                                                {[1, 2, 3, 4, 5].map((i) => (
                                                    <div
                                                        key={i}
                                                        className={`h-1.5 flex-1 rounded-full transition-all ${i <= strength ? strengthColors[strength] : 'bg-gray-200'
                                                            }`}
                                                    />
                                                ))}
                                            </div>
                                            <p className="text-xs text-gray-500">
                                                Seguridad: <span className="font-medium">{strengthLabels[strength]}</span>
                                            </p>
                                        </div>
                                    )}
                                </div>

                                <div>
                                    <Label>Confirmar contraseña</Label>
                                    <div className="relative mt-1">
                                        <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                        <Input
                                            type={showPassword ? 'text' : 'password'}
                                            placeholder="Repite tu contraseña"
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                            className="pl-10"
                                            required
                                        />
                                    </div>
                                    {confirmPassword.length > 0 && newPassword !== confirmPassword && (
                                        <p className="text-xs text-red-500 mt-1">Las contraseñas no coinciden</p>
                                    )}
                                    {confirmPassword.length > 0 && newPassword === confirmPassword && (
                                        <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                                            <CheckCircle2 className="w-3 h-3" /> Las contraseñas coinciden
                                        </p>
                                    )}
                                </div>

                                <Button
                                    type="submit"
                                    className="w-full bg-brand-secondary hover:bg-brand-secondary/90"
                                    disabled={loading || newPassword.length < 6 || newPassword !== confirmPassword}
                                >
                                    {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creando...</> : 'Crear Mi Contraseña'}
                                </Button>
                            </motion.form>
                        )}

                        {/* ═══ STEP 4: Éxito ═══ */}
                        {step === 'success' && (
                            <motion.div
                                key="success"
                                className="text-center py-4 space-y-4"
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                            >
                                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                                    <CheckCircle2 className="w-10 h-10 text-green-600" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold text-brand-dark">¡Contraseña Creada!</h2>
                                    <p className="text-sm text-gray-600 mt-1">
                                        Tu cuenta está lista, {firstName}. Ya puedes acceder al Portal del Paciente.
                                    </p>
                                </div>

                                <div className="space-y-3 pt-2">
                                    <Button
                                        onClick={() => navigate('/app/dashboard')}
                                        className="w-full bg-brand-secondary hover:bg-brand-secondary/90"
                                    >
                                        Ir al Portal del Paciente
                                    </Button>
                                    <Button
                                        variant="outline"
                                        onClick={() => navigate('/login')}
                                        className="w-full"
                                    >
                                        Ir a Iniciar Sesión
                                    </Button>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Botón Atrás */}
                    {step !== 'success' && (
                        <div className="mt-6 pt-4 border-t border-gray-200 flex justify-between items-center">
                            <button
                                type="button"
                                onClick={goBack}
                                className="flex items-center gap-1 text-sm text-gray-600 hover:text-brand-dark transition-colors"
                            >
                                <ArrowLeft className="w-4 h-4" />
                                {step === 'identify' ? 'Volver al login' : 'Paso anterior'}
                            </button>

                            <button
                                type="button"
                                onClick={() => navigate('/login')}
                                className="text-sm text-brand-secondary hover:underline"
                            >
                                Ya tengo contraseña
                            </button>
                        </div>
                    )}
                </Card>

                {/* Ayuda */}
                {step !== 'success' && (
                    <div className="text-center mt-4">
                        <p className="text-xs text-white/50">
                            ¿Necesitas ayuda? Contacta al equipo Prime F&H{' '}
                            <a href="https://wa.me/56912345678" className="text-brand-secondary hover:underline" target="_blank" rel="noreferrer">
                                por WhatsApp
                            </a>
                        </p>
                    </div>
                )}
            </motion.div>
        </div>
    );
};

export default RecoverPassword;
