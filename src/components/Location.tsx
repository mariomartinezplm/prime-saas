import { MapPin, Phone, Clock, Navigation, Car, Accessibility, Bus, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

const Location = () => {
  const address = "Avenida Volcán Puntiagudo 100, Puerto Montt, Los Lagos, Chile";
  const phone = "+56 9 5628 6651";
  const whatsappUrl = "https://wa.me/56956286651?text=Hola!%20Quiero%20saber%20m%C3%A1s%20sobre%20sus%20planes";

  const facilities = [
    { icon: Car, text: "Amplio estacionamiento gratis" },
    { icon: Accessibility, text: "Acceso para discapacitados" },
    { icon: Bus, text: "Transporte público cerca" },
    { icon: ShoppingCart, text: "Supermercado en el mismo recinto" }
  ];

  const contactInfo = [
    {
      icon: MapPin,
      title: "Dirección",
      content: address
    },
    {
      icon: Phone,
      title: "Teléfono",
      content: phone
    },
    {
      icon: Clock,
      title: "Horarios",
      content: null,
      schedule: [
        "Lun - Vie: 07:00 - 21:00",
        "Sábados: 09:00 - 13:00",
        "Domingos: Cerrado"
      ]
    }
  ];

  return (
    <section id="ubicacion" className="py-20 bg-background relative overflow-hidden">
      {/* Animated background */}
      <motion.div
        className="absolute top-0 left-0 w-[500px] h-[500px] bg-brand-primary/5 rounded-full blur-3xl"
        animate={{
          x: [-50, 50, -50],
          y: [0, 30, 0],
        }}
        transition={{
          duration: 15,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      />

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
        >
          <motion.span
            className="inline-block bg-brand-primary/10 text-brand-primary px-4 py-2 rounded-full text-sm font-semibold mb-4"
            initial={{ opacity: 0, scale: 0.8 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
          >
            📍 Encuéntranos
          </motion.span>
          <h2 className="text-3xl lg:text-4xl font-bold text-brand-primary mb-4">
            Nuestra Ubicación
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Fácil acceso desde cualquier lugar de Puerto Montt con amplio estacionamiento gratis
          </p>
        </motion.div>

        <div className="grid lg:grid-cols-2 gap-12 items-start">
          {/* Map */}
          <motion.div
            className="bg-card rounded-2xl overflow-hidden shadow-xl"
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.6, type: "spring" }}
            whileHover={{ y: -5 }}
          >
            <iframe
              src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2881.4685915088027!2d-72.94479368426982!3d-41.46895597925968!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x961422c736c7c60b%3A0x8a2c867b8238b2c7!2sAv.%20Volc%C3%A1n%20Puntiagudo%20100%2C%20Puerto%20Montt%2C%20Los%20Lagos!5e0!3m2!1ses!2scl!4v1704902500000!5m2!1ses!2scl"
              width="100%"
              height="400"
              style={{ border: 0 }}
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              title="Ubicación Prime F&H en Puerto Montt"
            />
          </motion.div>

          {/* Contact Info */}
          <div className="space-y-6">
            <motion.div
              className="bg-card rounded-2xl p-8 shadow-card"
              initial={{ opacity: 0, x: 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.6, type: "spring" }}
              whileHover={{ y: -5 }}
            >
              <h3 className="text-2xl font-bold text-brand-primary mb-6">
                Información de Contacto
              </h3>

              <div className="space-y-6">
                {contactInfo.map((item, index) => (
                  <motion.div
                    key={index}
                    className="flex items-start gap-4 group"
                    initial={{ opacity: 0, x: 20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.1 * index }}
                  >
                    <motion.div
                      className="bg-brand-soft rounded-xl p-3 group-hover:bg-brand-primary transition-colors duration-300"
                      whileHover={{ rotate: [0, -10, 10, 0], scale: 1.1 }}
                      transition={{ duration: 0.4 }}
                    >
                      <item.icon className="w-6 h-6 text-brand-primary group-hover:text-white transition-colors duration-300" />
                    </motion.div>
                    <div>
                      <h4 className="font-semibold text-brand-primary mb-1">{item.title}</h4>
                      {item.content && (
                        <p className="text-muted-foreground">{item.content}</p>
                      )}
                      {item.schedule && (
                        <div className="text-muted-foreground space-y-1">
                          {item.schedule.map((s, i) => (
                            <p key={i}>{s}</p>
                          ))}
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            {/* Directions & Contact */}
            <motion.div
              className="bg-gradient-to-br from-brand-soft to-brand-light rounded-2xl p-8"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.6, delay: 0.2 }}
              whileHover={{ y: -3 }}
            >
              <h4 className="text-xl font-bold text-brand-primary mb-4">
                ¿Cómo llegar?
              </h4>
              <p className="text-muted-foreground mb-6">
                Estamos ubicados en Avenida Volcán Puntiagudo 100, Puerto Montt, con fácil acceso desde cualquier punto de la ciudad.
                Contamos con amplio estacionamiento gratis para que no te preocupes de nada.
              </p>

              <div className="flex flex-col sm:flex-row gap-4">
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="flex-1">
                  <Button
                    variant="outline"
                    onClick={() => window.open(`https://maps.google.com/?q=${encodeURIComponent(address)}`, '_blank')}
                    className="w-full group"
                  >
                    <Navigation className="w-5 h-5 group-hover:animate-pulse" />
                    Ver en Google Maps
                  </Button>
                </motion.div>

                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="flex-1">
                  <Button
                    variant="outline"
                    onClick={() => window.open(`https://waze.com/ul?q=${encodeURIComponent(address)}&navigate=yes`, '_blank')}
                    className="w-full group"
                  >
                    <Navigation className="w-5 h-5 group-hover:animate-pulse" />
                    Ver en Waze
                  </Button>
                </motion.div>

                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="flex-1">
                  <Button
                    variant="whatsapp"
                    onClick={() => window.open(whatsappUrl, '_blank')}
                    className="w-full"
                  >
                    Contactar por WhatsApp
                  </Button>
                </motion.div>
              </div>
            </motion.div>

            {/* Accessibility & Parking */}
            <motion.div
              className="bg-card rounded-2xl p-6 shadow-card"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.6, delay: 0.3 }}
              whileHover={{ y: -3 }}
            >
              <h4 className="font-semibold text-brand-primary mb-4">Facilidades</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                {facilities.map((facility, index) => (
                  <motion.div
                    key={index}
                    className="flex items-center gap-3 group"
                    initial={{ opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.1 * index }}
                    whileHover={{ x: 5 }}
                  >
                    <motion.div
                      className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center"
                      whileHover={{ scale: 1.2, rotate: 360 }}
                      transition={{ duration: 0.3 }}
                    >
                      <facility.icon className="w-4 h-4 text-green-600" />
                    </motion.div>
                    <span>{facility.text}</span>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Location;