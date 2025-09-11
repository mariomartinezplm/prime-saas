import { Clock, Target, TrendingUp, Shield, Heart, Zap } from "lucide-react";

const Benefits = () => {
  const trainingBenefits = [
    {
      icon: Target,
      title: "Planes personalizados a tu objetivo",
      description: "Diseñamos rutinas específicas según tus metas y nivel actual"
    },
    {
      icon: Clock,
      title: "Menos de 60 min, sin perder eficacia",
      description: "Entrenamientos optimizados para personas con poco tiempo"
    },
    {
      icon: TrendingUp,
      title: "Acompañamiento profesional y progresión clara",
      description: "Seguimiento constante y ajustes semanales para garantizar resultados"
    },
    {
      icon: Zap,
      title: "Ahorra tiempo, gana resultados",
      description: "Maximiza tu inversión de tiempo con métodos comprobados"
    }
  ];

  const kineBenefits = [
    {
      icon: Heart,
      title: "Dolor y lesiones tratados con ejercicio",
      description: "Enfoque basado en movimiento para una recuperación integral"
    },
    {
      icon: Shield,
      title: "Retorno a la vida diaria y deportiva igual o mejor",
      description: "No solo recuperamos, te llevamos a un nivel superior"
    },
    {
      icon: TrendingUp,
      title: "Prevención de recaídas, fuerza y control",
      description: "Fortalecemos las bases para evitar futuras lesiones"
    },
    {
      icon: Target,
      title: "Rehabilitación funcional personalizada",
      description: "Ejercicios específicos para tus actividades y objetivos"
    }
  ];

  return (
    <section className="py-20 bg-background">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Training Benefits */}
        <div className="mb-20">
          <div className="text-center mb-12">
            <h2 className="text-3xl lg:text-4xl font-bold text-brand-dark mb-4">
              Entrenamiento Semi-personalizado
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Resultados reales para personas ocupadas que buscan eficiencia
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {trainingBenefits.map((benefit, index) => (
              <div key={index} className="bg-card rounded-lg p-6 shadow-card hover:shadow-lg transition-smooth">
                <div className="bg-brand-soft rounded-lg p-3 w-fit mb-4">
                  <benefit.icon className="w-6 h-6 text-brand-primary" />
                </div>
                <h3 className="text-lg font-semibold text-brand-dark mb-3">
                  {benefit.title}
                </h3>
                <p className="text-muted-foreground">
                  {benefit.description}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Kinesiología Benefits */}
        <div>
          <div className="text-center mb-12">
            <h2 className="text-3xl lg:text-4xl font-bold text-brand-dark mb-4">
              Kinesiología Deportiva
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Recuperación, retorno deportivo y tratamiento de dolor crónico
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {kineBenefits.map((benefit, index) => (
              <div key={index} className="bg-card rounded-lg p-6 shadow-card hover:shadow-lg transition-smooth">
                <div className="bg-brand-soft rounded-lg p-3 w-fit mb-4">
                  <benefit.icon className="w-6 h-6 text-brand-secondary" />
                </div>
                <h3 className="text-lg font-semibold text-brand-dark mb-3">
                  {benefit.title}
                </h3>
                <p className="text-muted-foreground">
                  {benefit.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default Benefits;