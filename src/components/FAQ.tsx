import { useState } from "react";
import { ChevronDown, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

const FAQ = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  
  const whatsappUrl = "https://wa.me/56912345678?text=Hola! Tengo una consulta que no encontré en las preguntas frecuentes.";

  const faqs = [
    {
      question: "¿En cuánto tiempo veré resultados?",
      answer: "La mayoría de nuestros clientes comienzan a ver cambios visibles entre la 3era y 4ta semana. Los resultados dependen de tu constancia, objetivos específicos y punto de partida. Nuestro seguimiento semanal asegura que estés en el camino correcto."
    },
    {
      question: "¿Puedo entrenar si tengo dolor o alguna lesión?",
      answer: "¡Absolutamente! De hecho, es nuestra especialidad. Contamos con kinesiólogos especializados que evalúan tu condición y adaptan los ejercicios. El movimiento controlado y progresivo es una de las mejores formas de recuperación."
    },
    {
      question: "¿Trabajan con personas post-operatorias?",
      answer: "Sí, trabajamos frecuentemente con pacientes post-operatorios una vez que tienen el alta médica. Coordinamos con tu médico tratante para asegurar una rehabilitación segura y efectiva."
    },
    {
      question: "¿Qué incluye la evaluación inicial?",
      answer: "La evaluación incluye análisis postural, pruebas de movilidad, evaluación de fuerza, revisión de historial médico y deportivo, y definición de objetivos. Dura aproximadamente 60 minutos y es completamente gratuita."
    },
    {
      question: "¿Tienen planes para gente con poco tiempo?",
      answer: "¡Esa es nuestra especialidad! Nuestros entrenamientos están diseñados para ser máximo 60 minutos y súper efectivos. Tenemos horarios desde las 6 AM para que puedas entrenar antes del trabajo."
    },
    {
      question: "¿Cómo agendo mi primera sesión por WhatsApp?",
      answer: "Solo haz clic en cualquier botón de WhatsApp de esta página o envía un mensaje al +56 9 1234 5678. Te responderemos inmediatamente para coordinar tu evaluación inicial gratuita."
    },
    {
      question: "¿Qué necesito traer para entrenar?",
      answer: "Solo ropa cómoda, zapatillas deportivas y una botella de agua. Nosotros proporcionamos todo el equipamiento necesario: pesas, bandas, implementos de rehabilitación, etc."
    },
    {
      question: "¿Ofrecen planes de alimentación?",
      answer: "En nuestro plan premium incluimos orientación nutricional básica. Para planes detallados trabajamos con nutricionistas asociados que pueden complementar tu proceso."
    }
  ];

  return (
    <section className="py-20 bg-brand-light">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl lg:text-4xl font-bold text-brand-primary mb-4">
            Preguntas Frecuentes
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Resolvemos las dudas más comunes de nuestros futuros clientes
          </p>
        </div>

        <div className="max-w-3xl mx-auto">
          <div className="space-y-4 mb-12">
            {faqs.map((faq, index) => (
              <div key={index} className="bg-white rounded-lg shadow-card overflow-hidden">
                <button
                  onClick={() => setOpenIndex(openIndex === index ? null : index)}
                  className="w-full px-6 py-4 text-left flex items-center justify-between hover:bg-brand-light/50 transition-smooth"
                >
                  <h3 className="text-lg font-semibold text-brand-primary pr-4">
                    {faq.question}
                  </h3>
                  <ChevronDown 
                    className={`w-5 h-5 text-brand-primary transition-transform ${
                      openIndex === index ? 'rotate-180' : ''
                    }`} 
                  />
                </button>
                
                {openIndex === index && (
                  <div className="px-6 pb-4">
                    <p className="text-muted-foreground leading-relaxed">
                      {faq.answer}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Still have questions CTA */}
          <div className="text-center bg-white rounded-2xl p-8 shadow-card">
            <h3 className="text-xl font-bold text-brand-primary mb-4">
              ¿Tienes más preguntas?
            </h3>
            <p className="text-muted-foreground mb-6">
              Nuestro equipo está disponible para resolver cualquier duda específica sobre tu caso
            </p>
            <Button 
              variant="whatsapp"
              onClick={() => window.open(whatsappUrl, '_blank')}
              className="mx-auto"
            >
              <MessageCircle className="w-5 h-5" />
              Pregunta por WhatsApp
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default FAQ;