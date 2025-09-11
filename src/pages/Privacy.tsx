import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

const Privacy = () => {
  return (
    <div className="min-h-screen bg-background py-16">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">
        <div className="mb-8">
          <Link to="/">
            <Button variant="ghost" className="mb-4">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Volver al inicio
            </Button>
          </Link>
          <h1 className="text-3xl lg:text-4xl font-bold text-brand-dark mb-4">
            Política de Privacidad
          </h1>
          <p className="text-muted-foreground">
            Última actualización: {new Date().toLocaleDateString('es-CL')}
          </p>
        </div>

        <div className="bg-card rounded-2xl p-8 shadow-card prose prose-lg max-w-none">
          <h2 className="text-2xl font-bold text-brand-dark mb-4">1. Información que recopilamos</h2>
          <p className="text-muted-foreground mb-6">
            En Prime F&H recopilamos únicamente la información necesaria para brindarte nuestros servicios:
          </p>
          <ul className="text-muted-foreground mb-6 space-y-2">
            <li>• Datos personales básicos: nombre, teléfono, correo electrónico</li>
            <li>• Información de salud relevante para tu entrenamiento y rehabilitación</li>
            <li>• Historial de entrenamientos y progreso</li>
            <li>• Datos de contacto para comunicaciones del servicio</li>
          </ul>

          <h2 className="text-2xl font-bold text-brand-dark mb-4">2. Cómo utilizamos tu información</h2>
          <p className="text-muted-foreground mb-6">
            Utilizamos tu información exclusivamente para:
          </p>
          <ul className="text-muted-foreground mb-6 space-y-2">
            <li>• Diseñar y personalizar tu programa de entrenamiento</li>
            <li>• Realizar seguimiento de tu progreso y ajustes necesarios</li>
            <li>• Comunicarnos contigo sobre citas, cambios de horario y recordatorios</li>
            <li>• Mejorar nuestros servicios basándose en tu experiencia</li>
          </ul>

          <h2 className="text-2xl font-bold text-brand-dark mb-4">3. Protección de datos</h2>
          <p className="text-muted-foreground mb-6">
            Tu información está protegida mediante:
          </p>
          <ul className="text-muted-foreground mb-6 space-y-2">
            <li>• Acceso restringido solo al personal autorizado</li>
            <li>• Sistemas seguros de almacenamiento de datos</li>
            <li>• Cumplimiento de la Ley 19.628 de Protección de Datos Personales de Chile</li>
            <li>• No compartimos tu información con terceros sin tu consentimiento</li>
          </ul>

          <h2 className="text-2xl font-bold text-brand-dark mb-4">4. Tus derechos</h2>
          <p className="text-muted-foreground mb-6">
            Tienes derecho a:
          </p>
          <ul className="text-muted-foreground mb-6 space-y-2">
            <li>• Acceder a tu información personal</li>
            <li>• Solicitar corrección de datos incorrectos</li>
            <li>• Solicitar eliminación de tus datos</li>
            <li>• Revocar tu consentimiento en cualquier momento</li>
          </ul>

          <h2 className="text-2xl font-bold text-brand-dark mb-4">5. Cookies y seguimiento web</h2>
          <p className="text-muted-foreground mb-6">
            Nuestro sitio web utiliza cookies para mejorar tu experiencia y analizar el tráfico. 
            Puedes configurar tu navegador para rechazar cookies si lo prefieres.
          </p>

          <h2 className="text-2xl font-bold text-brand-dark mb-4">6. Contacto</h2>
          <p className="text-muted-foreground mb-6">
            Para ejercer tus derechos o resolver dudas sobre privacidad, contáctanos:
          </p>
          <ul className="text-muted-foreground mb-6 space-y-2">
            <li>• WhatsApp: +56 9 1234 5678</li>
            <li>• Dirección: Av. Diego Portales 1234, Puerto Montt</li>
            <li>• Email: privacidad@primefh.cl</li>
          </ul>

          <div className="bg-brand-soft rounded-lg p-6 mt-8">
            <p className="text-sm text-muted-foreground">
              Esta política puede actualizarse ocasionalmente. Te notificaremos sobre 
              cambios importantes por WhatsApp o durante tu próxima visita.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Privacy;