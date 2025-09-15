import { Button } from "@/components/ui/button";
import { MessageCircle, Dumbbell, Heart, Activity } from "lucide-react";
import physiotherapyImage from "@/assets/physiotherapy.jpg";

const Services = () => {
  const whatsappUrl = "https://wa.me/56912345678?text=Hola! Me interesa conocer más sobre los servicios de Prime F%26H.";

  return (
    <section id="servicios" className="py-20 bg-brand-light">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl lg:text-4xl font-bold text-brand-primary mb-4">
            Nuestros Servicios
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Soluciones integrales para tu bienestar físico y recuperación
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Entrenamiento Semi-personalizado */}
          <div className="bg-white rounded-2xl p-8 shadow-card">
            <div className="flex items-center gap-4 mb-6">
              <div className="bg-brand-primary/10 rounded-lg p-3">
                <Dumbbell className="w-8 h-8 text-brand-primary" />
              </div>
              <h3 className="text-2xl font-bold text-brand-dark">
                Entrenamiento Semi-personalizado
              </h3>
            </div>
            
            <p className="text-lg text-muted-foreground mb-6">
              Entrenamientos efectivos de máximo 60 minutos diseñados para personas ocupadas 
              que buscan resultados reales sin perder tiempo.
            </p>

            <div className="space-y-3 mb-8">
              <div className="flex items-center gap-3">
                <Activity className="w-5 h-5 text-brand-primary" />
                <span>Evaluación inicial completa</span>
              </div>
              <div className="flex items-center gap-3">
                <Activity className="w-5 h-5 text-brand-primary" />
                <span>Rutinas personalizadas a tu objetivo</span>
              </div>
              <div className="flex items-center gap-3">
                <Activity className="w-5 h-5 text-brand-primary" />
                <span>Seguimiento semanal y ajustes</span>
              </div>
              <div className="flex items-center gap-3">
                <Activity className="w-5 h-5 text-brand-primary" />
                <span>Grupos reducidos (máx. 4 personas)</span>
              </div>
            </div>

            <Button 
              variant="cta" 
              className="w-full"
              onClick={() => window.open(whatsappUrl, '_blank')}
            >
              <MessageCircle className="w-5 h-5" />
              Quiero entrenar mejor
            </Button>
          </div>

          {/* Kinesiología */}
          <div className="bg-white rounded-2xl p-8 shadow-card">
            <div className="flex items-center gap-4 mb-6">
              <div className="bg-brand-secondary/10 rounded-lg p-3">
                <Heart className="w-8 h-8 text-brand-secondary" />
              </div>
              <h3 className="text-2xl font-bold text-brand-dark">
                Kinesiología Deportiva
              </h3>
            </div>
            
            <p className="text-lg text-muted-foreground mb-6">
              Rehabilitación basada en ejercicio para recuperación de lesiones, 
              retorno deportivo y tratamiento de dolor crónico.
            </p>

            <div className="space-y-3 mb-8">
              <div className="flex items-center gap-3">
                <Activity className="w-5 h-5 text-brand-secondary" />
                <span>Evaluación kinesiológica detallada</span>
              </div>
              <div className="flex items-center gap-3">
                <Activity className="w-5 h-5 text-brand-secondary" />
                <span>Recuperación de lesiones deportivas</span>
              </div>
              <div className="flex items-center gap-3">
                <Activity className="w-5 h-5 text-brand-secondary" />
                <span>Tratamiento de dolor crónico</span>
              </div>
              <div className="flex items-center gap-3">
                <Activity className="w-5 h-5 text-brand-secondary" />
                <span>Retorno deportivo funcional</span>
              </div>
            </div>

            <Button 
              variant="outline" 
              className="w-full border-brand-secondary text-brand-secondary hover:bg-brand-secondary hover:text-white"
              onClick={() => window.open(whatsappUrl, '_blank')}
            >
              <MessageCircle className="w-5 h-5" />
              Necesito rehabilitación
            </Button>
          </div>
        </div>

        {/* Image Section */}
        <div className="mt-16 text-center">
          <img 
            src={physiotherapyImage} 
            alt="Sesión de kinesiología en Prime F&H"
            className="rounded-2xl shadow-lg mx-auto max-w-2xl w-full"
          />
          <p className="text-sm text-muted-foreground mt-4">
            Atención personalizada con enfoque en ejercicio terapéutico
          </p>
        </div>
      </div>
    </section>
  );
};

export default Services;