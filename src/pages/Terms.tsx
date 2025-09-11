import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

const Terms = () => {
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
            Términos y Condiciones
          </h1>
          <p className="text-muted-foreground">
            Última actualización: {new Date().toLocaleDateString('es-CL')}
          </p>
        </div>

        <div className="bg-card rounded-2xl p-8 shadow-card prose prose-lg max-w-none">
          <h2 className="text-2xl font-bold text-brand-dark mb-4">1. Servicios ofrecidos</h2>
          <p className="text-muted-foreground mb-6">
            Prime F&H ofrece servicios de:
          </p>
          <ul className="text-muted-foreground mb-6 space-y-2">
            <li>• Entrenamiento físico semi-personalizado</li>
            <li>• Kinesiología y rehabilitación</li>
            <li>• Evaluaciones físicas y de movimiento</li>
            <li>• Asesoría en ejercicio terapéutico</li>
          </ul>

          <h2 className="text-2xl font-bold text-brand-dark mb-4">2. Responsabilidades del cliente</h2>
          <p className="text-muted-foreground mb-6">
            Al utilizar nuestros servicios, te comprometes a:
          </p>
          <ul className="text-muted-foreground mb-6 space-y-2">
            <li>• Proporcionar información médica completa y veraz</li>
            <li>• Seguir las indicaciones del profesional</li>
            <li>• Informar cualquier molestia o cambio en tu condición</li>
            <li>• Cumplir con los horarios acordados</li>
            <li>• Respetar las instalaciones y equipamiento</li>
          </ul>

          <h2 className="text-2xl font-bold text-brand-dark mb-4">3. Política de cancelaciones</h2>
          <ul className="text-muted-foreground mb-6 space-y-2">
            <li>• Cancelaciones con más de 24 horas: sin costo</li>
            <li>• Cancelaciones con menos de 24 horas: se descuenta de tu plan</li>
            <li>• No presentarse a la cita: se considera sesión utilizada</li>
            <li>• Emergencias médicas: flexibilidad según el caso</li>
          </ul>

          <h2 className="text-2xl font-bold text-brand-dark mb-4">4. Política de pagos</h2>
          <ul className="text-muted-foreground mb-6 space-y-2">
            <li>• Los planes mensuales se pagan por adelantado</li>
            <li>• Las sesiones individuales se pagan el día de la cita</li>
            <li>• Aceptamos efectivo, transferencia y tarjetas</li>
            <li>• No hay reembolsos por sesiones no utilizadas</li>
          </ul>

          <h2 className="text-2xl font-bold text-brand-dark mb-4">5. Limitaciones de responsabilidad</h2>
          <p className="text-muted-foreground mb-6">
            Prime F&H y sus profesionales:
          </p>
          <ul className="text-muted-foreground mb-6 space-y-2">
            <li>• Actúan bajo protocolos profesionales establecidos</li>
            <li>• No garantizan resultados específicos en tiempos determinados</li>
            <li>• Recomiendan evaluación médica cuando sea necesario</li>
            <li>• No se responsabilizan por lesiones resultado de no seguir indicaciones</li>
          </ul>

          <h2 className="text-2xl font-bold text-brand-dark mb-4">6. Confidencialidad médica</h2>
          <p className="text-muted-foreground mb-6">
            Toda tu información de salud es tratada con estricta confidencialidad según 
            la normativa chilena de protección de datos y secreto profesional.
          </p>

          <h2 className="text-2xl font-bold text-brand-dark mb-4">7. Uso de instalaciones</h2>
          <ul className="text-muted-foreground mb-6 space-y-2">
            <li>• Horarios de atención: Lun-Vie 6:00-22:00, Sáb 8:00-14:00</li>
            <li>• Uso obligatorio de ropa deportiva adecuada</li>
            <li>• Prohibido el uso de equipos sin supervisión</li>
            <li>• Mantener higiene y orden en las instalaciones</li>
          </ul>

          <h2 className="text-2xl font-bold text-brand-dark mb-4">8. Modificaciones</h2>
          <p className="text-muted-foreground mb-6">
            Prime F&H se reserva el derecho de modificar estos términos. 
            Los cambios se comunicarán con al menos 30 días de anticipación.
          </p>

          <h2 className="text-2xl font-bold text-brand-dark mb-4">9. Resolución de conflictos</h2>
          <p className="text-muted-foreground mb-6">
            Cualquier disputa se resolverá preferentemente mediante diálogo directo. 
            En caso necesario, se aplicará la legislación chilena y jurisdicción de Puerto Montt.
          </p>

          <div className="bg-brand-soft rounded-lg p-6 mt-8">
            <h3 className="font-semibold text-brand-dark mb-2">Contacto para dudas legales</h3>
            <p className="text-sm text-muted-foreground">
              WhatsApp: +56 9 1234 5678<br />
              Email: legal@primefh.cl<br />
              Dirección: Av. Diego Portales 1234, Puerto Montt, Los Lagos
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Terms;