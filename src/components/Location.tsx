import { MapPin, Phone, Clock, Navigation, Car, Accessibility, Bus, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { CONTACT_PHONE_DISPLAY, getWhatsAppUrl } from "@/config/contact";

const Location = () => {
  const address = "Avenida Volcán Puntiagudo 100, Puerto Montt, Los Lagos, Chile";
  const phone = CONTACT_PHONE_DISPLAY;
  const whatsappUrl = getWhatsAppUrl("Hola! Quiero saber más sobre sus planes");

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
    <section id="ubicacion" className="py-20 bg-landing-dark relative overflow-hidden">
      {/* Animated background */}
      <motion.div
        className="absolute top-0 left-0 w-[500px] h-[500px] bg-[#398CA2]/5 rounded-full blur-3xl"
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
          className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 mb-16"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
        >
          <div>
            <span className="inline-flex items-center gap-2 text-[#4BA5BC] text-sm font-semibold uppercase tracking-wider mb-3">
              <MapPin className="w-4 h-4" /> Encuéntranos
            </span>
            <h2 className="text-3xl lg:text-4xl font-serif font-bold text-white max-w-lg">
              Nuestra Ubicación
            </h2>
          </div>
          <p className="text-lg text-white/60 max-w-sm lg:text-right">
            Fácil acceso desde cualquier lugar de Puerto Montt con amplio estacionamiento gratis
          </p>
        </motion.div>

        <div className="grid lg:grid-cols-2 gap-12 items-start">
          {/* Map */}
          <motion.div
            className="bg-white/5 backdrop-blur-sm rounded-2xl overflow-hidden border border-white/10"
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
              className="bg-white/5 backdrop-blur-sm rounded-2xl p-8 border border-white/10"
              initial={{ opacity: 0, x: 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.6, type: "spring" }}
              whileHover={{ y: -5 }}
            >
              <h3 className="text-2xl font-bold text-white mb-6">
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
                      className="bg-[#398CA2]/15 rounded-xl p-3 group-hover:bg-[#398CA2] transition-colors duration-300"
                      whileHover={{ rotate: [0, -10, 10, 0], scale: 1.1 }}
                      transition={{ duration: 0.4 }}
                    >
                      <item.icon className="w-6 h-6 text-[#4BA5BC] group-hover:text-white transition-colors duration-300" />
                    </motion.div>
                    <div>
                      <h4 className="font-semibold text-white mb-1">{item.title}</h4>
                      {item.content && (
                        <p className="text-white/60">{item.content}</p>
                      )}
                      {item.schedule && (
                        <div className="text-white/60 space-y-1">
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
              className="bg-gradient-to-br from-[#398CA2]/15 to-landing-dark/50 backdrop-blur-sm rounded-2xl p-8 border border-white/10"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.6, delay: 0.2 }}
              whileHover={{ y: -3 }}
            >
              <h4 className="text-xl font-bold text-white mb-4">
                ¿Cómo llegar?
              </h4>
              <p className="text-white/60 mb-6">
                Estamos ubicados en Avenida Volcán Puntiagudo 100, Puerto Montt, con fácil acceso desde cualquier punto de la ciudad.
                Contamos con amplio estacionamiento gratis para que no te preocupes de nada.
              </p>

              <div className="flex flex-col sm:flex-row gap-4">
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="flex-1">
                  <Button
                    variant="outline"
                    onClick={() => window.open(`https://maps.google.com/?q=${encodeURIComponent(address)}`, '_blank')}
                    className="w-full group bg-transparent border-white/20 text-white hover:bg-white/10"
                  >
                    <Navigation className="w-5 h-5 group-hover:animate-pulse" />
                    Google Maps
                  </Button>
                </motion.div>

                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="flex-1">
                  <Button
                    variant="outline"
                    onClick={() => window.open(`https://waze.com/ul?q=${encodeURIComponent(address)}&navigate=yes`, '_blank')}
                    className="w-full group bg-transparent border-white/20 text-white hover:bg-white/10"
                  >
                    <Navigation className="w-5 h-5 group-hover:animate-pulse" />
                    Waze
                  </Button>
                </motion.div>

                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="flex-1">
                  <Button
                    variant="whatsapp"
                    onClick={() => window.open(whatsappUrl, '_blank')}
                    className="w-full"
                  >
                    WhatsApp
                  </Button>
                </motion.div>
              </div>
            </motion.div>

            {/* Accessibility & Parking */}
            <motion.div
              className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.6, delay: 0.3 }}
              whileHover={{ y: -3 }}
            >
              <h4 className="font-semibold text-white mb-4">Facilidades</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                {facilities.map((facility, index) => (
                  <motion.div
                    key={index}
                    className="flex items-center gap-3 group text-white/70"
                    initial={{ opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.1 * index }}
                    whileHover={{ x: 5 }}
                  >
                    <motion.div
                      className="w-8 h-8 bg-emerald-500/15 rounded-full flex items-center justify-center"
                      whileHover={{ scale: 1.2, rotate: 360 }}
                      transition={{ duration: 0.3 }}
                    >
                      <facility.icon className="w-4 h-4 text-emerald-400" />
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