import { Button } from "@/components/ui/button";
import { MessageCircle, Calendar, User, TrendingUp } from "lucide-react";
import { motion } from "framer-motion";

const HowItWorks = () => {
  const whatsappUrl = "https://wa.me/56956286651?text=Hola%2C%20me%20interesa%20saber%20sobre%20sus%20planes";

  const steps = [
    {
      icon: Calendar,
      number: "01",
      title: "Agendas tu hora",
      description: "Elige el horario que mejor se adapte a tu día. Sin excusas, sin complicaciones. Tu primer paso hacia una mejor versión de ti.",
      highlight: "Simple y rápido",
      cta: true
    },
    {
      icon: User,
      number: "02",
      title: "Plan personalizado",
      description: "Creamos tu programa de entrenamiento o rehabilitación específico para tus necesidades",
      highlight: "100% adaptado a ti",
      cta: false
    },
    {
      icon: TrendingUp,
      number: "03",
      title: "Seguimiento y ajustes",
      description: "Monitoreo constante de tu progreso con ajustes semanales para optimizar resultados",
      highlight: "Resultados garantizados",
      cta: false
    }
  ];

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2
      }
    }
  };

  const cardVariants = {
    hidden: { opacity: 0, y: 50 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        type: "spring" as const,
        stiffness: 100,
        damping: 15
      }
    }
  };

  return (
    <section id="como-funciona" className="py-20 bg-background relative overflow-hidden">
      {/* Animated background */}
      <motion.div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-brand-primary/3 rounded-full blur-3xl"
        animate={{
          scale: [1, 1.1, 1],
          opacity: [0.5, 0.3, 0.5],
        }}
        transition={{
          duration: 10,
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
            📋 Proceso Simple
          </motion.span>
          <h2 className="text-3xl lg:text-4xl font-bold text-brand-dark mb-4">
            ¿Cómo funciona?
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Proceso simple y efectivo para llevarte a tus objetivos
          </p>
        </motion.div>

        <motion.div
          className="grid lg:grid-cols-3 gap-8 mb-16"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-50px" }}
        >
          {steps.map((step, index) => (
            <motion.div
              key={index}
              className="relative"
              variants={cardVariants}
            >
              {/* Animated connection line for desktop */}
              {index < steps.length - 1 && (
                <motion.div
                  className="hidden lg:block absolute top-16 left-full w-full h-0.5 bg-brand-primary/20 transform translate-x-4 z-0"
                  initial={{ scaleX: 0 }}
                  whileInView={{ scaleX: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.5 + index * 0.2, duration: 0.5 }}
                  style={{ originX: 0 }}
                >
                  <motion.div
                    className="absolute right-0 w-3 h-3 bg-brand-primary rounded-full transform translate-x-1.5 -translate-y-1.5"
                    initial={{ scale: 0 }}
                    whileInView={{ scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: 1 + index * 0.2 }}
                  />
                </motion.div>
              )}

              <motion.div
                className="bg-card rounded-2xl p-8 shadow-card hover:shadow-xl transition-shadow duration-500 relative z-10 group cursor-default"
                whileHover={{
                  y: -10,
                  transition: { type: "spring", stiffness: 400, damping: 17 }
                }}
              >
                <div className="flex items-center gap-4 mb-6">
                  <motion.div
                    className="bg-brand-primary rounded-full p-4 group-hover:scale-110 transition-transform duration-300"
                    whileHover={{ rotate: 360 }}
                    transition={{ duration: 0.5 }}
                  >
                    <step.icon className="w-8 h-8 text-white" />
                  </motion.div>
                  <motion.span
                    className="text-5xl font-bold text-brand-primary/10 group-hover:text-brand-primary/30 transition-colors duration-300"
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.3 + index * 0.1 }}
                  >
                    {step.number}
                  </motion.span>
                </div>

                <h3 className="text-xl font-bold text-brand-dark mb-4">
                  {step.title}
                </h3>

                <p className="text-muted-foreground mb-4 leading-relaxed">
                  {step.description}
                </p>

                <motion.div
                  className="bg-brand-soft rounded-lg p-3 mb-4"
                  whileHover={{ scale: 1.02 }}
                >
                  <span className="text-sm font-semibold text-brand-primary">
                    ✓ {step.highlight}
                  </span>
                </motion.div>

                {step.cta && (
                  <motion.div
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Button
                      variant="cta"
                      className="w-full group/btn"
                      onClick={() => window.open(whatsappUrl, '_blank')}
                    >
                      <Calendar className="w-5 h-5 mr-2 group-hover/btn:animate-pulse" />
                      Agenda aquí
                    </Button>
                  </motion.div>
                )}
              </motion.div>
            </motion.div>
          ))}
        </motion.div>

        {/* CTA Section */}
        <motion.div
          className="text-center bg-gradient-to-br from-brand-soft to-brand-light rounded-3xl p-12 relative overflow-hidden"
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.6 }}
        >
          {/* Animated decorations */}
          <motion.div
            className="absolute top-4 right-4 w-20 h-20 bg-brand-primary/10 rounded-full"
            animate={{
              scale: [1, 1.2, 1],
              opacity: [0.5, 0.8, 0.5],
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          />
          <motion.div
            className="absolute bottom-4 left-4 w-16 h-16 bg-brand-secondary/10 rounded-full"
            animate={{
              scale: [1.2, 1, 1.2],
              opacity: [0.8, 0.5, 0.8],
            }}
            transition={{
              duration: 4,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          />

          <motion.h3
            className="text-2xl lg:text-3xl font-bold text-brand-dark mb-4 relative z-10"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
          >
            ¿Listo para comenzar?
          </motion.h3>
          <motion.p
            className="text-lg text-muted-foreground mb-8 max-w-xl mx-auto relative z-10"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3 }}
          >
            Agenda una cita y descubre cómo podemos ayudarte
            a alcanzar tus objetivos de forma eficiente.
          </motion.p>

          <motion.div
            className="flex flex-col sm:flex-row gap-4 justify-center relative z-10"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.4 }}
          >
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Button
                variant="whatsapp"
                size="lg"
                onClick={() => window.open(whatsappUrl, '_blank')}
                className="text-lg px-8 py-6 shadow-lg hover:shadow-xl transition-shadow"
              >
                <MessageCircle className="w-5 h-5" />
                Agendar cita
              </Button>
            </motion.div>

            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Button
                variant="outline"
                size="lg"
                onClick={() => {
                  const element = document.getElementById('precios');
                  if (element) element.scrollIntoView({ behavior: 'smooth' });
                }}
                className="text-lg px-8 py-6"
              >
                Ver precios
              </Button>
            </motion.div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
};

export default HowItWorks;
