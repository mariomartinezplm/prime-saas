import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { CheckCircle, MessageCircle, Home } from "lucide-react";
import { Link } from "react-router-dom";

const ThankYou = () => {
  const whatsappUrl = "https://wa.me/56912345678?text=Hola! Acabo de completar el formulario y me gustaría confirmar mi evaluación inicial.";

  useEffect(() => {
    // Analytics event
    if (typeof (window as any).gtag !== 'undefined') {
      (window as any).gtag('event', 'conversion', {
        'send_to': 'AW-XXXXXXXXX/XXXXXXXXX', // Replace with actual conversion ID
        'transaction_id': Date.now().toString()
      });
    }
  }, []);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="max-w-2xl mx-auto text-center">
        <div className="bg-card rounded-2xl p-12 shadow-card">
          {/* Success Icon */}
          <div className="bg-green-100 rounded-full p-6 w-24 h-24 mx-auto mb-8 flex items-center justify-center">
            <CheckCircle className="w-12 h-12 text-green-600" />
          </div>

          {/* Main Message */}
          <h1 className="text-3xl lg:text-4xl font-bold text-brand-dark mb-6">
            ¡Gracias por tu interés!
          </h1>
          
          <p className="text-xl text-muted-foreground mb-8 leading-relaxed">
            Hemos recibido tu información y nos pondremos en contacto contigo por WhatsApp 
            en los próximos minutos para coordinar tu evaluación inicial gratuita.
          </p>

          {/* Next Steps */}
          <div className="bg-brand-soft rounded-xl p-6 mb-8 text-left">
            <h3 className="font-semibold text-brand-dark mb-4">¿Qué sigue ahora?</h3>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="bg-brand-primary rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-white text-sm font-bold">1</span>
                </div>
                <span className="text-muted-foreground">Revisaremos tu información y te contactaremos por WhatsApp</span>
              </div>
              <div className="flex items-start gap-3">
                <div className="bg-brand-primary rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-white text-sm font-bold">2</span>
                </div>
                <span className="text-muted-foreground">Coordinaremos tu evaluación inicial gratuita</span>
              </div>
              <div className="flex items-start gap-3">
                <div className="bg-brand-primary rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-white text-sm font-bold">3</span>
                </div>
                <span className="text-muted-foreground">Diseñaremos tu plan personalizado</span>
              </div>
            </div>
          </div>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              variant="whatsapp" 
              size="lg"
              onClick={() => window.open(whatsappUrl, '_blank')}
              className="text-lg px-8 py-4"
            >
              <MessageCircle className="w-5 h-5" />
              Ir a WhatsApp ahora
            </Button>
            
            <Link to="/">
              <Button 
                variant="outline" 
                size="lg"
                className="text-lg px-8 py-4 w-full sm:w-auto"
              >
                <Home className="w-5 h-5" />
                Volver al inicio
              </Button>
            </Link>
          </div>

          {/* Contact Info */}
          <div className="mt-8 pt-6 border-t border-border">
            <p className="text-sm text-muted-foreground">
              ¿Prefieres llamar? También puedes contactarnos directamente al{" "}
              <a 
                href="tel:+56912345678" 
                className="text-brand-primary font-semibold hover:underline"
              >
                +56 9 1234 5678
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ThankYou;