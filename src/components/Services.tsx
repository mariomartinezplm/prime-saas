import { Button } from "@/components/ui/button";
import { MessageCircle, Dumbbell, Heart, Activity } from "lucide-react";
import { motion } from "framer-motion";

const Services = () => {
  const whatsappUrlEntrenamiento = "https://wa.me/56956286651?text=Hola%20quiero%20agendar";
  const whatsappUrlRehabilitacion = "https://wa.me/56956286651?text=Hola%2C%20quiero%20hacer%20mi%20rehabilitaci%C3%B3n%20con%20ustedes";

  const featureVariants = {
    hidden: { opacity: 0, x: -20 },
    visible: (i: number) => ({
      opacity: 1,
      x: 0,
      transition: {
        delay: i * 0.1,
        type: "spring" as const,
        stiffness: 100
      }
    })
  };

  return (
    <section id="servicios" className="py-20 bg-brand-dark relative overflow-hidden">
      {/* Animated background shapes */}
      <motion.div
        className="absolute -top-20 -right-20 w-80 h-80 bg-brand-primary/5 rounded-full blur-3xl"
        animate={{
          scale: [1, 1.1, 1],
          rotate: [0, 90, 0],
        }}
        transition={{
          duration: 20,
          repeat: Infinity,
          ease: "linear"
        }}
      />
      <motion.div
        className="absolute -bottom-20 -left-20 w-96 h-96 bg-brand-secondary/5 rounded-full blur-3xl"
        animate={{
          scale: [1.1, 1, 1.1],
          rotate: [0, -90, 0],
        }}
        transition={{
          duration: 25,
          repeat: Infinity,
          ease: "linear"
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
            className="inline-block bg-brand-secondary/20 text-brand-secondary px-4 py-2 rounded-full text-sm font-semibold mb-4"
            initial={{ opacity: 0, scale: 0.8 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
          >
            🎯 Servicios Especializados
          </motion.span>
          <h2 className="text-3xl lg:text-4xl font-serif font-bold text-brand-light mb-4">
            Nuestros Servicios
          </h2>
          <p className="text-xl text-white/60 max-w-2xl mx-auto">
            Soluciones integrales para tu bienestar físico y recuperación
          </p>
        </motion.div>

        <div className="grid lg:grid-cols-2 gap-12 items-stretch">
          {/* Entrenamiento Personalizado */}
          <motion.div
            className="bg-brand-dark/80 backdrop-blur-sm rounded-2xl p-8 shadow-card hover:shadow-2xl transition-shadow duration-500 group relative overflow-hidden border border-brand-secondary/10"
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.6, type: "spring" }}
            whileHover={{ y: -8 }}
          >
            {/* Animated gradient on hover */}
            <motion.div
              className="absolute inset-0 bg-gradient-to-br from-brand-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"
            />

            <div className="relative z-10">
              <div className="flex items-center gap-4 mb-6">
                <motion.div
                  className="bg-brand-light/10 rounded-xl p-4 group-hover:bg-brand-secondary transition-colors duration-300"
                  whileHover={{ rotate: [0, -10, 10, 0], scale: 1.1 }}
                  transition={{ duration: 0.5 }}
                >
                  <Dumbbell className="w-8 h-8 text-brand-light group-hover:text-white transition-colors duration-300" />
                </motion.div>
                <h3 className="text-2xl font-bold text-brand-light">
                  Entrenamiento Personalizado
                </h3>
              </div>

              <p className="text-lg text-white/60 mb-6">
                Grupos reducidos de máximo 4 personas por hora. Cada persona sigue su propia rutina según sus objetivos y nivel de entrenamiento.
              </p>

              <div className="space-y-3 mb-8">
                {[
                  "Cada persona con su rutina personalizada",
                  "Seguimiento semanal y ajustes constantes",
                  "Grupos reducidos (máx. 4 personas)"
                ].map((feature, i) => (
                  <motion.div
                    key={i}
                    className="flex items-center gap-3"
                    custom={i}
                    variants={featureVariants}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true }}
                  >
                    <motion.div
                      whileHover={{ scale: 1.3, rotate: 360 }}
                      transition={{ duration: 0.3 }}
                    >
                      <Activity className="w-5 h-5 text-brand-secondary" />
                    </motion.div>
                    <span className="text-white/80">{feature}</span>
                  </motion.div>
                ))}
              </div>

              <motion.div
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Button
                  variant="cta"
                  className="w-full group/btn"
                  onClick={() => window.open(whatsappUrlEntrenamiento, '_blank')}
                >
                  <MessageCircle className="w-5 h-5 group-hover/btn:animate-bounce" />
                  Quiero entrenar mejor
                </Button>
              </motion.div>
            </div>
          </motion.div>

          {/* Kinesiología */}
          <motion.div
            className="bg-brand-dark/80 backdrop-blur-sm rounded-2xl p-8 shadow-card hover:shadow-2xl transition-shadow duration-500 group relative overflow-hidden border border-brand-secondary/10"
            initial={{ opacity: 0, x: 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.6, type: "spring" }}
            whileHover={{ y: -8 }}
          >
            {/* Animated gradient on hover */}
            <motion.div
              className="absolute inset-0 bg-gradient-to-br from-brand-secondary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"
            />

            <div className="relative z-10">
              <div className="flex items-center gap-4 mb-6">
                <motion.div
                  className="bg-brand-secondary/10 rounded-xl p-4 group-hover:bg-brand-secondary transition-colors duration-300"
                  whileHover={{ rotate: [0, -10, 10, 0], scale: 1.1 }}
                  transition={{ duration: 0.5 }}
                >
                  <Heart className="w-8 h-8 text-brand-secondary group-hover:text-white transition-colors duration-300" />
                </motion.div>
                <h3 className="text-2xl font-bold text-brand-light">
                  Kinesiología
                </h3>
              </div>

              <p className="text-lg text-white/60 mb-6">
                Rehabilitación basada en ejercicio para recuperación de lesiones,
                retorno deportivo y tratamiento de dolor crónico.
              </p>

              <div className="space-y-3 mb-8">
                {[
                  "Evaluación kinesiológica detallada",
                  "Recuperación de lesiones deportivas",
                  "Tratamiento de dolor crónico",
                  "Retorno deportivo funcional"
                ].map((feature, i) => (
                  <motion.div
                    key={i}
                    className="flex items-center gap-3"
                    custom={i}
                    variants={featureVariants}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true }}
                  >
                    <motion.div
                      whileHover={{ scale: 1.3, rotate: 360 }}
                      transition={{ duration: 0.3 }}
                    >
                      <Activity className="w-5 h-5 text-brand-secondary" />
                    </motion.div>
                    <span className="text-white/80">{feature}</span>
                  </motion.div>
                ))}
              </div>

              <motion.div
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Button
                  variant="outline"
                  className="w-full bg-transparent border-brand-secondary text-brand-secondary hover:bg-brand-secondary hover:text-white group/btn"
                  onClick={() => window.open(whatsappUrlRehabilitacion, '_blank')}
                >
                  <MessageCircle className="w-5 h-5 group-hover/btn:animate-bounce" />
                  Necesito rehabilitación
                </Button>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default Services;