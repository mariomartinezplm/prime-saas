import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ArrowLeft, MessageCircle, ShieldCheck } from 'lucide-react';
import { motion } from 'framer-motion';
import logoImage from '@/assets/prime-fh-logo.png';
import { getWhatsAppUrl } from '@/config/contact';

/**
 * Recuperación de contraseña — versión interina (Paso 01 de BLUEPRINT.md).
 *
 * El flujo anterior verificaba la identidad con RUT + fecha de nacimiento y
 * devolvía un token para cambiar la contraseña. Como esos datos son fáciles de
 * conseguir, cualquiera podía tomar control de la cuenta de un paciente, así que
 * se eliminó del backend.
 *
 * Mientras tanto, la recuperación se coordina por WhatsApp con el centro. El
 * reseteo automático por email llega en el Paso 13 del blueprint.
 */
const RecoverPassword = () => {
    const navigate = useNavigate();

    const whatsappUrl = getWhatsAppUrl(
        'Hola, necesito ayuda para recuperar el acceso a mi cuenta de la app Prime F&H.'
    );

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
                    <h1 className="text-2xl font-bold text-white">Recuperar acceso</h1>
                    <p className="text-brand-light/70 text-sm mt-1">
                        Te ayudamos a volver a entrar a tu cuenta
                    </p>
                </div>

                <Card className="p-6 bg-white/95 backdrop-blur-sm border-0 shadow-2xl">
                    <div className="flex justify-center mb-4">
                        <div className="w-14 h-14 rounded-full bg-brand-secondary/10 flex items-center justify-center">
                            <ShieldCheck className="w-7 h-7 text-brand-secondary" />
                        </div>
                    </div>

                    <p className="text-center text-gray-700 mb-2">
                        Para recuperar tu acceso, contacta a Prime F&H por WhatsApp.
                    </p>
                    <p className="text-center text-sm text-gray-500 mb-6">
                        Te confirmamos tu identidad y te dejamos entrando en minutos.
                    </p>

                    <Button asChild className="w-full bg-[#25D366] hover:bg-[#20BD5A] text-white">
                        <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
                            <MessageCircle className="w-4 h-4 mr-2" />
                            Escribir por WhatsApp
                        </a>
                    </Button>

                    <Button
                        variant="ghost"
                        className="w-full mt-2 text-gray-600"
                        onClick={() => navigate('/login')}
                    >
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Volver al inicio de sesión
                    </Button>
                </Card>

                <p className="text-center text-xs text-brand-light/50 mt-6">
                    Protegemos tus datos de salud: por eso ya no cambiamos contraseñas
                    con datos que otra persona podría conocer.
                </p>
            </motion.div>
        </div>
    );
};

export default RecoverPassword;
