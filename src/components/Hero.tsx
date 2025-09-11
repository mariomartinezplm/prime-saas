import { Button } from "@/components/ui/button";
import { MessageCircle, Star, Users, Clock } from "lucide-react";
import heroImage from "@/assets/hero-training.jpg";

const Hero = () => {
  const whatsappUrl = "https://wa.me/56912345678?text=Hola! Me interesa conocer más sobre Prime F%26H. Me gustaría agendar una evaluación inicial.";

  return (
    <section className="relative min-h-screen flex items-center bg-gradient-to-br from-brand-primary via-brand-primary to-primary/80">
      {/* Background Image Overlay */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-20"
        style={{ backgroundImage: `url(${heroImage})` }}
      />
      
      <div className="relative z-10 container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center text-white">
          {/* Social Proof Pills */}
          <div className="flex flex-wrap justify-center gap-4 mb-8">
            <div className="flex items-center gap-2 bg-white/20 backdrop-blur-sm rounded-full px-4 py-2">
              <Star className="w-4 h-4 text-yellow-400 fill-current" />
              <span className="text-sm">5.0 estrellas</span>
            </div>
            <div className="flex items-center gap-2 bg-white/20 backdrop-blur-sm rounded-full px-4 py-2">
              <Users className="w-4 h-4" />
              <span className="text-sm">+200 clientes</span>
            </div>
            <div className="flex items-center gap-2 bg-white/20 backdrop-blur-sm rounded-full px-4 py-2">
              <Clock className="w-4 h-4" />
              <span className="text-sm">Resultados en 4 semanas</span>
            </div>
          </div>

          {/* Main Headlines */}
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6 leading-tight">
            Entrena mejor en
            <span className="block text-yellow-300">menos de 1 hora</span>
          </h1>
          
          <p className="text-xl lg:text-2xl mb-8 text-white/90 max-w-3xl mx-auto leading-relaxed">
            Kinesiología y entrenamiento en Puerto Montt. Rehabilitación basada en ejercicio 
            y rutinas efectivas para gente ocupada.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12">
            <Button 
              variant="hero" 
              size="lg"
              onClick={() => window.open(whatsappUrl, '_blank')}
              className="text-lg px-8 py-4 h-auto"
            >
              <MessageCircle className="w-5 h-5" />
              Agenda por WhatsApp
            </Button>
            
            <Button 
              variant="ghost"
              size="lg"
              onClick={() => {
                const element = document.getElementById('como-funciona');
                if (element) element.scrollIntoView({ behavior: 'smooth' });
              }}
              className="text-white border-white hover:bg-white/20 text-lg px-8 py-4 h-auto"
            >
              Conocer más
            </Button>
          </div>

          {/* Trust Indicators */}
          <div className="flex flex-wrap justify-center gap-8 text-white/80">
            <div className="text-center">
              <div className="text-2xl font-bold">7+</div>
              <div className="text-sm">años experiencia</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">98%</div>
              <div className="text-sm">satisfacción</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">30min</div>
              <div className="text-sm">sesiones promedio</div>
            </div>
          </div>
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 animate-bounce">
        <div className="w-6 h-10 border-2 border-white/50 rounded-full flex justify-center">
          <div className="w-1 h-3 bg-white/50 rounded-full mt-2"></div>
        </div>
      </div>
    </section>
  );
};

export default Hero;