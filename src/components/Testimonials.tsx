import { Star, Quote } from "lucide-react";

const Testimonials = () => {
  const testimonials = [
    {
      name: "",
      age: "",
      problem: "",
      result: "",
      text: "",
      rating: 5
    },
    {
      name: "", 
      age: "",
      problem: "",
      result: "",
      text: "",
      rating: 5
    },
    {
      name: "",
      age: "",
      problem: "",
      result: "",
      text: "",
      rating: 5
    }
  ];

  return (
    <section className="py-20 bg-background">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl lg:text-4xl font-bold text-brand-primary mb-4">
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
                <h4 className="font-bold text-brand-primary mb-1">
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

      </div>
    </section>
  );
};

export default Testimonials;