import { Star, Quote } from "lucide-react";

const Testimonials = () => {
  const testimonials = [
    {
      name: "Andrea Morales",
      age: "32 años",
      problem: "Dolor lumbar crónico",
      result: "Sin dolor después de 6 semanas",
      text: "Llegué con dolor lumbar que tenía hace 2 años. Con el enfoque de ejercicio terapéutico de Prime F&H logré eliminar completamente el dolor y ahora entreno sin problemas.",
      rating: 5
    },
    {
      name: "Roberto Silva",
      age: "28 años", 
      problem: "Falta de tiempo para entrenar",
      result: "Bajó 8kg en 3 meses",
      text: "Como ingeniero trabajo muchas horas. Los entrenamientos de 45 minutos fueron perfectos para mi horario. Bajé 8kg y gané mucha fuerza sin sacrificar tiempo familiar.",
      rating: 5
    },
    {
      name: "Carolina Pérez",
      age: "45 años",
      problem: "Lesión de rodilla post-cirugía",
      result: "Volvió a correr en 4 meses",
      text: "Después de mi cirugía de menisco pensé que no volvería a correr. El equipo me ayudó paso a paso y ahora corro medio maratón sin molestias. Increíble.",
      rating: 5
    }
  ];

  return (
    <section className="py-20 bg-background">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl lg:text-4xl font-bold text-brand-dark mb-4">
            Historias de Éxito
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Resultados reales de personas como tú que transformaron su vida
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {testimonials.map((testimonial, index) => (
            <div key={index} className="bg-card rounded-2xl p-8 shadow-card hover:shadow-lg transition-smooth">
              {/* Rating */}
              <div className="flex items-center gap-1 mb-4">
                {[...Array(testimonial.rating)].map((_, i) => (
                  <Star key={i} className="w-5 h-5 text-yellow-400 fill-current" />
                ))}
              </div>

              {/* Quote */}
              <div className="relative mb-6">
                <Quote className="absolute -top-2 -left-1 w-8 h-8 text-brand-primary/20" />
                <p className="text-muted-foreground italic leading-relaxed pl-6">
                  "{testimonial.text}"
                </p>
              </div>

              {/* Client Info */}
              <div className="border-t border-border pt-6">
                <h4 className="font-bold text-brand-dark mb-1">
                  {testimonial.name}
                </h4>
                <p className="text-sm text-muted-foreground mb-3">
                  {testimonial.age}
                </p>
                
                <div className="space-y-2">
                  <div className="bg-red-50 text-red-700 rounded-lg px-3 py-2 text-sm">
                    <strong>Problema:</strong> {testimonial.problem}
                  </div>
                  <div className="bg-green-50 text-green-700 rounded-lg px-3 py-2 text-sm">
                    <strong>Resultado:</strong> {testimonial.result}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Overall Stats */}
        <div className="mt-16 text-center bg-brand-soft rounded-2xl p-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div>
              <div className="text-3xl font-bold text-brand-primary mb-2">4.9/5</div>
              <div className="text-sm text-muted-foreground">Calificación promedio</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-brand-primary mb-2">98%</div>
              <div className="text-sm text-muted-foreground">Clientes satisfechos</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-brand-primary mb-2">6 sem</div>
              <div className="text-sm text-muted-foreground">Tiempo promedio resultados</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-brand-primary mb-2">200+</div>
              <div className="text-sm text-muted-foreground">Casos de éxito</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Testimonials;