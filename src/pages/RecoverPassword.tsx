import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { ArrowLeft, Mail, MessageCircle, MailCheck, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import logoImage from '@/assets/prime-fh-logo.png';
import { getWhatsAppUrl } from '@/config/contact';
import { authService } from '@/services/authService';

/**
 * Recuperación de contraseña (Paso 13 de BLUEPRINT.md).
 *
 * Reemplaza la versión interina que solo derivaba a WhatsApp (Paso 01):
 * ahora el reseteo automático por email ya existe (Paso 11 + 13), así que
 * esta pantalla vuelve a pedir el correo. El WhatsApp queda como red de
 * seguridad secundaria, por si el correo nunca llega.
 */
const RecoverPassword = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const whatsappUrl = getWhatsAppUrl(
    'Hola, solicité restablecer mi contraseña de Prime F&H pero no me llegó el correo. ¿Me pueden ayudar?'
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      // El backend SIEMPRE responde 200 genérico (exista o no el email) —
      // no revela qué correos están registrados.
      await authService.forgotPassword(email);
    } catch {
      // Falla de red/servidor: se muestra igual el mensaje genérico, mismo
      // criterio que el backend — no se confirma ni se niega nada del email.
    } finally {
      setIsLoading(false);
      setSent(true);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-dark via-brand-dark/95 to-brand-secondary/20 flex items-center justify-center p-4">
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
        <div className="text-center mb-6">
          <img src={logoImage} alt="Prime F&H" className="h-14 mx-auto mb-3" />
          <h1 className="text-2xl font-bold text-white">Recuperar acceso</h1>
          <p className="text-brand-light/70 text-sm mt-1">
            Te ayudamos a volver a entrar a tu cuenta
          </p>
        </div>

        <Card className="p-6 bg-white/95 backdrop-blur-sm border-0 shadow-2xl">
          {sent ? (
            <>
              <div className="flex justify-center mb-4">
                <div className="w-14 h-14 rounded-full bg-brand-secondary/10 flex items-center justify-center">
                  <MailCheck className="w-7 h-7 text-brand-secondary" />
                </div>
              </div>

              <p className="text-center text-gray-700 mb-2">
                Si <strong>{email}</strong> está registrado, te llegará un correo
                con instrucciones para restablecer tu contraseña.
              </p>
              <p className="text-center text-sm text-gray-500 mb-6">
                El link es válido por 10 minutos. Revisa también spam/promociones.
              </p>

              <Button
                variant="ghost"
                className="w-full text-gray-600"
                onClick={() => navigate('/login')}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Volver al inicio de sesión
              </Button>

              <div className="mt-6 pt-4 border-t border-gray-200">
                <p className="text-center text-xs text-gray-400 mb-2">
                  ¿No te llegó el correo?
                </p>
                <Button asChild variant="outline" className="w-full border-[#25D366] text-[#20BD5A] hover:bg-[#25D366]/10">
                  <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
                    <MessageCircle className="w-4 h-4 mr-2" />
                    Escribir por WhatsApp
                  </a>
                </Button>
              </div>
            </>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <p className="text-center text-gray-700 mb-2">
                Ingresa el correo con el que te registraste.
              </p>

              <div>
                <Label htmlFor="email">Correo electrónico</Label>
                <div className="relative mt-1">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="tu@correo.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10"
                    required
                    disabled={isLoading}
                  />
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
                    Enviando...
                  </>
                ) : (
                  "Enviar instrucciones"
                )}
              </Button>

              <Button
                type="button"
                variant="ghost"
                className="w-full text-gray-600"
                onClick={() => navigate('/login')}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Volver al inicio de sesión
              </Button>
            </form>
          )}
        </Card>
      </motion.div>
    </div>
  );
};

export default RecoverPassword;
