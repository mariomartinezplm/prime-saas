import { Button } from "@/components/ui/button";
import { MessageCircle, Check, Clock, Calendar } from "lucide-react";

const Pricing = () => {
  const whatsappUrl = "https://wa.me/56956286651?text=Hola%20quiero%20agendar";

  const plans = [
    {
      name: "Plan 2x Semana",
      type: "Entrenamiento Semi-personalizado",
      price: "89.990",
      period: "mensual",
      description: "Entrenamientos efectivos dos veces por semana",
      features: [
        "8 sesiones mensuales",
        "Grupos de máx. 4 personas",
        "Plan personalizado",
        "Seguimiento semanal"
      ],
      popular: false,
      ctaText: "Comenzar ahora"
    },
    {
      name: "Plan 3x Semana",
      type: "Entrenamiento Semi-personalizado",
      price: "129.990",
      period: "mensual",
      description: "La opción más completa para resultados óptimos",
      features: [
        "12 sesiones mensuales",
        "Grupos de máx. 4 personas",
        "Plan 100% personalizado",
        "Seguimiento semanal"
      ],
      popular: true,
      ctaText: "Plan más popular"
    },
    {
      name: "10 Sesiones Kine",
      type: "Kinesiología",
      price: "199.990",
      period: "paquete",
      description: "Rehabilitación y recuperación especializada",
      features: [
        "10 sesiones individuales",
        "Evaluación kinesiológica",
        "Ejercicios terapéuticos",
        "Plan de recuperación"
      ],
      popular: false,
      ctaText: "Agendar sesiones"
    }
  ];

  const schedule = [
    { day: "Lunes - Viernes", time: "06:00 - 21:00" },
    { day: "Sábados", time: "09:00 - 13:00" },
    { day: "Domingos", time: "Cerrado" }
  ];

  return (
    <section id="precios" className="py-20 bg-brand-light">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl lg:text-4xl font-bold text-brand-primary mb-4">
            Planes y Horarios
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Opciones flexibles para que puedas entrenar y recuperarte según tu disponibilidad
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid lg:grid-cols-3 gap-8 mb-16">
          {plans.map((plan, index) => (
            <div 
              key={index} 
              className={`bg-card rounded-2xl p-8 shadow-card relative ${
                plan.popular ? 'ring-2 ring-brand-secondary' : ''
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <span className="bg-brand-secondary text-white px-6 py-2 rounded-full text-sm font-semibold">
                    Más Popular
                  </span>
                </div>
              )}
              
              <div className="text-center mb-8">
                <h3 className="text-xl font-bold text-brand-primary mb-2">
                  {plan.name}
                </h3>
                <p className="text-brand-secondary font-medium mb-4">
                  {plan.type}
                </p>
                <div className="mb-4">
                  <span className="text-4xl font-bold text-brand-primary">
                    ${plan.price.toLocaleString()}
                  </span>
                  <span className="text-muted-foreground"> /{plan.period}</span>
                </div>
                <p className="text-muted-foreground">
                  {plan.description}
                </p>
              </div>

              <div className="space-y-4 mb-8">
                {plan.features.map((feature, idx) => (
                  <div key={idx} className="flex items-center gap-3">
                    <Check className="w-5 h-5 text-brand-secondary flex-shrink-0" />
                    <span className="text-foreground">{feature}</span>
                  </div>
                ))}
              </div>

              <Button 
                variant={plan.popular ? "whatsapp" : "outline"}
                className="w-full"
                onClick={() => window.open(whatsappUrl, '_blank')}
              >
                <MessageCircle className="w-5 h-5" />
                {plan.ctaText}
              </Button>
            </div>
          ))}
        </div>

        {/* Schedule */}
        <div className="bg-card rounded-2xl p-8 shadow-card max-w-2xl mx-auto">
          <div className="text-center mb-8">
            <h3 className="text-2xl font-bold text-brand-primary mb-4 flex items-center justify-center gap-3">
              <Clock className="w-6 h-6 text-brand-secondary" />
              Horarios de Atención
            </h3>
            <p className="text-muted-foreground">
              Nos adaptamos a tu horario para que puedas entrenar cuando mejor te convenga
            </p>
          </div>

          <div className="space-y-4">
            {schedule.map((slot, index) => (
              <div key={index} className="flex justify-between items-center py-3 border-b border-border last:border-0">
                <div className="flex items-center gap-3">
                  <Calendar className="w-5 h-5 text-brand-secondary" />
                  <span className="font-medium text-brand-primary">{slot.day}</span>
                </div>
                <span className="text-muted-foreground font-medium">{slot.time}</span>
              </div>
            ))}
          </div>

          <div className="mt-8 p-4 bg-brand-light rounded-lg">
            <p className="text-sm text-center text-muted-foreground">
              <strong>Nota:</strong> Horarios pueden variar en días festivos. 
              Confirma tu horario preferido al agendar por WhatsApp.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Pricing;