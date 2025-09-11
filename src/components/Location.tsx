import { MapPin, Phone, Clock, Navigation } from "lucide-react";
import { Button } from "@/components/ui/button";

const Location = () => {
  const address = "Av. Diego Portales 1234, Puerto Montt, Los Lagos";
  const phone = "+56 9 1234 5678";
  const whatsappUrl = "https://wa.me/56912345678?text=Hola! Me gustaría conocer la ubicación de Prime F%26H y agendar una visita.";

  return (
    <section id="ubicacion" className="py-20 bg-background">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl lg:text-4xl font-bold text-brand-dark mb-4">
            Nuestra Ubicación
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Fácil acceso en el centro de Puerto Montt con estacionamiento disponible
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-12 items-start">
          {/* Map */}
          <div className="bg-card rounded-2xl overflow-hidden shadow-card">
            <iframe
              src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3151.8354345093754!2d-72.94247892501436!3d-41.46890117129649!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x961422c6e21b8f2b%3A0x8d9b8e63e42b5c25!2sPuerto%20Montt%2C%20Los%20Lagos!5e0!3m2!1ses!2scl!4v1704902400000!5m2!1ses!2scl"
              width="100%"
              height="400"
              style={{ border: 0 }}
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              title="Ubicación Prime F&H en Puerto Montt"
            />
          </div>

          {/* Contact Info */}
          <div className="space-y-8">
            <div className="bg-card rounded-2xl p-8 shadow-card">
              <h3 className="text-2xl font-bold text-brand-dark mb-6">
                Información de Contacto
              </h3>
              
              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  <div className="bg-brand-soft rounded-lg p-3">
                    <MapPin className="w-6 h-6 text-brand-primary" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-brand-dark mb-1">Dirección</h4>
                    <p className="text-muted-foreground">{address}</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="bg-brand-soft rounded-lg p-3">
                    <Phone className="w-6 h-6 text-brand-primary" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-brand-dark mb-1">Teléfono</h4>
                    <p className="text-muted-foreground">{phone}</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="bg-brand-soft rounded-lg p-3">
                    <Clock className="w-6 h-6 text-brand-primary" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-brand-dark mb-1">Horarios</h4>
                    <div className="text-muted-foreground space-y-1">
                      <p>Lun - Vie: 06:00 - 22:00</p>
                      <p>Sábados: 08:00 - 14:00</p>
                      <p>Domingos: Cerrado</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Directions & Contact */}
            <div className="bg-brand-soft rounded-2xl p-8">
              <h4 className="text-xl font-bold text-brand-dark mb-4">
                ¿Cómo llegar?
              </h4>
              <p className="text-muted-foreground mb-6">
                Estamos ubicados en pleno centro de Puerto Montt, cerca del mall Paseo Costanera. 
                Contamos con estacionamiento gratuito para nuestros clientes.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4">
                <Button 
                  variant="outline"
                  onClick={() => window.open(`https://maps.google.com/?q=${encodeURIComponent(address)}`, '_blank')}
                  className="flex-1"
                >
                  <Navigation className="w-5 h-5" />
                  Ver en Google Maps
                </Button>
                
                <Button 
                  variant="whatsapp"
                  onClick={() => window.open(whatsappUrl, '_blank')}
                  className="flex-1"
                >
                  Contactar por WhatsApp
                </Button>
              </div>
            </div>

            {/* Accessibility & Parking */}
            <div className="bg-card rounded-2xl p-6 shadow-card">
              <h4 className="font-semibold text-brand-dark mb-4">Facilidades</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span>Estacionamiento gratuito</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span>Acceso para discapacitados</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span>Transporte público cerca</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span>Vestuarios equipados</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Location;