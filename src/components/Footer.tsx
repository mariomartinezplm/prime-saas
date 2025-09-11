import { MessageCircle, MapPin, Phone, Clock, Instagram, Facebook } from "lucide-react";

const Footer = () => {
  const whatsappUrl = "https://wa.me/56912345678?text=Hola! Me interesa conocer más sobre Prime F%26H.";

  return (
    <footer className="bg-brand-dark text-white py-16">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
          {/* Brand & Description */}
          <div className="lg:col-span-2">
            <h3 className="text-2xl font-bold mb-4">Prime F&H</h3>
            <p className="text-white/80 mb-6 leading-relaxed">
              Centro de entrenamiento y kinesiología en Puerto Montt. Especializados en 
              entrenamientos efectivos de menos de 1 hora y rehabilitación basada en ejercicio.
            </p>
            <div className="flex gap-4">
              <a 
                href="https://instagram.com/primefh" 
                target="_blank" 
                rel="noopener noreferrer"
                className="bg-white/10 p-3 rounded-lg hover:bg-white/20 transition-smooth"
              >
                <Instagram className="w-5 h-5" />
              </a>
              <a 
                href="https://facebook.com/primefh" 
                target="_blank" 
                rel="noopener noreferrer"
                className="bg-white/10 p-3 rounded-lg hover:bg-white/20 transition-smooth"
              >
                <Facebook className="w-5 h-5" />
              </a>
              <a 
                href={whatsappUrl}
                target="_blank" 
                rel="noopener noreferrer"
                className="bg-green-600 p-3 rounded-lg hover:bg-green-700 transition-smooth"
              >
                <MessageCircle className="w-5 h-5" />
              </a>
            </div>
          </div>

          {/* Contact Info */}
          <div>
            <h4 className="text-lg font-semibold mb-4">Contacto</h4>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-brand-secondary flex-shrink-0 mt-0.5" />
                <span className="text-white/80 text-sm">
                  Av. Diego Portales 1234<br />
                  Puerto Montt, Los Lagos
                </span>
              </div>
              <div className="flex items-center gap-3">
                <Phone className="w-5 h-5 text-brand-secondary flex-shrink-0" />
                <span className="text-white/80 text-sm">+56 9 1234 5678</span>
              </div>
            </div>
          </div>

          {/* Schedule */}
          <div>
            <h4 className="text-lg font-semibold mb-4">Horarios</h4>
            <div className="space-y-2 text-sm text-white/80">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-brand-secondary" />
                <span>Lun - Vie: 06:00 - 22:00</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-brand-secondary" />
                <span>Sáb: 08:00 - 14:00</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-brand-secondary" />
                <span>Dom: Cerrado</span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Section */}
        <div className="border-t border-white/20 pt-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="text-sm text-white/60">
              © 2024 Prime F&H. Todos los derechos reservados.
            </div>
            
            <div className="flex gap-6 text-sm">
              <a 
                href="/privacidad" 
                className="text-white/60 hover:text-white transition-smooth"
              >
                Política de Privacidad
              </a>
              <a 
                href="/terminos" 
                className="text-white/60 hover:text-white transition-smooth"
              >
                Términos y Condiciones
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;