import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { authService } from "@/services/authService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Lock, Eye, EyeOff, Loader2, ShieldAlert, MessageCircle, ArrowLeft } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import logoImage from "@/assets/prime-fh-logo.png";
import { getWhatsAppUrl } from "@/config/contact";

const MIN_PASSWORD_LENGTH = 8;

const ResetPassword = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { updateUser } = useAuth();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [tokenInvalid, setTokenInvalid] = useState(false);

  const whatsappUrl = getWhatsAppUrl(
    "Hola, el link para restablecer mi contraseña de Prime F&H ya no funciona. ¿Me pueden ayudar?"
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password.length < MIN_PASSWORD_LENGTH) {
      toast.error(`La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres`);
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Las contraseñas no coinciden");
      return;
    }

    setIsLoading(true);
    try {
      const response = await authService.resetPassword(token!, password);
      updateUser(response.data.user);
      toast.success("Contraseña actualizada");
      navigate(response.data.user.role === "patient" ? "/app/dashboard" : "/app/admin");
    } catch (error: any) {
      if (error.response?.data?.code === "RESET_TOKEN_INVALID") {
        setTokenInvalid(true);
      } else {
        toast.error(error.response?.data?.message || "No se pudo restablecer la contraseña. Intenta de nuevo.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (tokenInvalid) {
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
            <h1 className="text-2xl font-bold text-white">Link no válido</h1>
            <p className="text-brand-light/70 text-sm mt-1">
              Este link de recuperación ya se usó o venció
            </p>
          </div>

          <Card className="p-6 bg-white/95 backdrop-blur-sm border-0 shadow-2xl">
            <div className="flex justify-center mb-4">
              <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center">
                <ShieldAlert className="w-7 h-7 text-red-500" />
              </div>
            </div>

            <p className="text-center text-gray-700 mb-2">
              Los links de recuperación son de un solo uso y duran solo 10 minutos.
            </p>
            <p className="text-center text-sm text-gray-500 mb-6">
              Solicita uno nuevo o escríbenos por WhatsApp.
            </p>

            <Button
              className="w-full bg-brand-secondary hover:bg-brand-secondary/90 mb-2"
              onClick={() => navigate("/recuperar-contrasena")}
            >
              Solicitar un nuevo link
            </Button>

            <Button asChild className="w-full bg-[#25D366] hover:bg-[#20BD5A] text-white">
              <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
                <MessageCircle className="w-4 h-4 mr-2" />
                Escribir por WhatsApp
              </a>
            </Button>

            <Button
              variant="ghost"
              className="w-full mt-2 text-gray-600"
              onClick={() => navigate("/login")}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Volver al inicio de sesión
            </Button>
          </Card>
        </motion.div>
      </div>
    );
  }

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
          <h1 className="text-2xl font-bold text-white">Restablecer contraseña</h1>
          <p className="text-brand-light/70 text-sm mt-1">
            Elige tu nueva contraseña
          </p>
        </div>

        <Card className="p-6 bg-white/95 backdrop-blur-sm shadow-2xl border-0">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="password">Nueva contraseña</Label>
              <div className="relative mt-1">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Mínimo 8 caracteres"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
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

            <div>
              <Label htmlFor="confirmPassword">Confirmar contraseña</Label>
              <div className="relative mt-1">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <Input
                  id="confirmPassword"
                  type={showPassword ? "text" : "password"}
                  placeholder="Repite tu contraseña"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
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
                  Guardando...
                </>
              ) : (
                "Restablecer contraseña"
              )}
            </Button>
          </form>
        </Card>
      </motion.div>
    </div>
  );
};

export default ResetPassword;
