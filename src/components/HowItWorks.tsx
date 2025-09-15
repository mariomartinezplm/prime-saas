import { Button } from "@/components/ui/button";
import { MessageCircle, Calendar, User, TrendingUp } from "lucide-react";

const HowItWorks = () => {
  const whatsappUrl = "https://wa.me/56956286651?text=Hola! Me gustaría agendar mi evaluación inicial en Prime F%26H.";

  const steps = [
    {
      icon: Calendar,
      number: "01",
      title: "Evaluación inicial",
      description: "Analizamos tus objetivos, historial médico y nivel actual para diseñar tu plan personalizado",
      highlight: "Gratuita y sin compromiso"
    },
    {
      icon: User,
      number: "02", 
      title: "Plan personalizado",
      description: "Creamos tu programa de entrenamiento o rehabilitación específico para tus necesidades",
      highlight: "100% adaptado a ti"
    },
    {
      icon: TrendingUp,
      number: "03",
      title: "Seguimiento y ajustes",
      description: "Monitoreo constante de tu progreso con ajustes semanales para optimizar resultados",
      highlight: "Resultados garantizados"
    }
  ];

  return (
    <section id="como-funciona" className="py-20 bg-background">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl lg:text-4xl font-bold text-brand-dark mb-4">
            ¿Cómo funciona?
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Proceso simple y efectivo para llevarte a tus objetivos
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-8 mb-16">
          {steps.map((step, index) => (
            <div key={index} className="relative">
              {/* Connection line for desktop */}
              {index < steps.length - 1 && (
                <div className="hidden lg:block absolute top-16 left-full w-full h-0.5 bg-brand-primary/20 transform translate-x-4 z-0">
                  <div className="absolute right-0 w-3 h-3 bg-brand-primary rounded-full transform translate-x-1.5 -translate-y-1.5"></div>
                </div>
              )}
              
              <div className="bg-card rounded-2xl p-8 shadow-card hover:shadow-lg transition-smooth relative z-10">
                <div className="flex items-center gap-4 mb-6">
                  <div className="bg-brand-primary rounded-full p-4">
                    <step.icon className="w-8 h-8 text-white" />
                  </div>
                  <span className="text-3xl font-bold text-brand-primary/20">
                    {step.number}
                  </span>
                </div>
                
                <h3 className="text-xl font-bold text-brand-dark mb-4">
                  {step.title}
                </h3>
                
                <p className="text-muted-foreground mb-4 leading-relaxed">
                  {step.description}
                </p>
                
                <div className="bg-brand-soft rounded-lg p-3">
                  <span className="text-sm font-semibold text-brand-primary">
                    ✓ {step.highlight}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* CTA Section */}
        <div className="text-center bg-brand-soft rounded-2xl p-12">
          <h3 className="text-2xl font-bold text-brand-dark mb-4">
            ¿Listo para comenzar?
          </h3>
          <p className="text-lg text-muted-foreground mb-8 max-w-xl mx-auto">
            Agenda tu evaluación inicial gratuita y descubre cómo podemos ayudarte 
            a alcanzar tus objetivos de forma eficiente.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              variant="whatsapp" 
              size="lg"
              onClick={() => window.open(whatsappUrl, '_blank')}
              className="text-lg px-8 py-4"
            >
              <MessageCircle className="w-5 h-5" />
              Quiero mi evaluación gratuita
            </Button>
            
            <Button 
              variant="outline" 
              size="lg"
              onClick={() => {
                const element = document.getElementById('precios');
                if (element) element.scrollIntoView({ behavior: 'smooth' });
              }}
              className="text-lg px-8 py-4"
            >
              Ver precios
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;