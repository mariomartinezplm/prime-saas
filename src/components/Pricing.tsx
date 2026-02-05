import { Button } from "@/components/ui/button";
import { MessageCircle, Check, Clock, Calendar, Sparkles } from "lucide-react";
import { motion } from "framer-motion";

const Pricing = () => {
  const whatsappUrl = "https://wa.me/56956286651?text=Hola!%20Quiero%20conocer%20sus%20planes";

  const benefits = [
    "Mejora tu salud y calidad de vida",
    "Plan 100% personalizado a tus objetivos",
    "Seguimiento semanal y ajustes constantes",
    "Grupos reducidos de máx. 4 personas",
    "Sesiones de menos de 60 minutos",
    "Corrección en tiempo real"
  ];

  const schedule = [
    { day: "Lunes - Viernes", time: "07:00 - 21:00" },
    { day: "Sábados", time: "09:00 - 13:00" },
    { day: "Domingos", time: "Cerrado" }
  ];

  const benefitVariants = {
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
    <section id="precios" className="py-20 bg-brand-light relative overflow-hidden">
      {/* Animated background */}
      <motion.div
        className="absolute top-0 right-0 w-[600px] h-[600px] bg-brand-secondary/5 rounded-full blur-3xl"
        animate={{
          x: [0, 50, 0],
          y: [0, -30, 0],
        }}
        transition={{
          duration: 15,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      />
      <motion.div
        className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-brand-primary/5 rounded-full blur-3xl"
        animate={{
          x: [0, -30, 0],
          y: [0, 50, 0],
        }}
        transition={{
          duration: 12,
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
            className="inline-block bg-brand-secondary/10 text-brand-secondary px-4 py-2 rounded-full text-sm font-semibold mb-4"
            initial={{ opacity: 0, scale: 0.8 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
          >
            💰 Invierte en Ti
          </motion.span>
          <h2 className="text-3xl lg:text-4xl font-bold text-brand-primary mb-4">
            Planes y Horarios
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Comienza a entrenar con nosotros y transforma tu salud
          </p>
        </motion.div>

        {/* Single Plan Card */}
        <motion.div
          className="max-w-lg mx-auto mb-16"
          initial={{ opacity: 0, y: 50, scale: 0.95 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.6, type: "spring" }}
        >
          <motion.div
            className="bg-card rounded-3xl p-10 shadow-xl ring-2 ring-brand-secondary relative overflow-hidden group"
            whileHover={{
              y: -10,
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)"
            }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
          >
            {/* Animated shine effect */}
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full"
              animate={{ translateX: ["−100%", "200%"] }}
              transition={{
                duration: 3,
                repeat: Infinity,
                repeatDelay: 5,
                ease: "easeInOut"
              }}
            />

            {/* Popular badge */}
            <motion.div
              className="absolute -top-1 -right-1 bg-brand-secondary text-white px-4 py-2 rounded-bl-2xl rounded-tr-2xl text-sm font-bold flex items-center gap-1"
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.5 }}
            >
              <Sparkles className="w-4 h-4" />
              Más Popular
            </motion.div>

            <div className="text-center mb-8 relative z-10">
              <motion.h3
                className="text-2xl font-bold text-brand-primary mb-2"
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.2 }}
              >
                Entrenamiento Personalizado
              </motion.h3>
              <div className="mb-2">
                <span className="text-sm text-muted-foreground">desde</span>
              </div>
              <motion.div
                className="mb-4"
                initial={{ opacity: 0, scale: 0.5 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.3, type: "spring" }}
              >
                <span className="text-6xl font-bold text-brand-primary">
                  $89.990
                </span>
                <span className="text-muted-foreground"> /mensual</span>
              </motion.div>
            </div>

            <div className="space-y-4 mb-8 relative z-10">
              {benefits.map((benefit, idx) => (
                <motion.div
                  key={idx}
                  className="flex items-center gap-3 group/item"
                  custom={idx}
                  variants={benefitVariants}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true }}
                >
                  <motion.div
                    className="bg-brand-secondary/10 rounded-full p-1 group-hover/item:bg-brand-secondary transition-colors duration-300"
                    whileHover={{ scale: 1.2, rotate: 360 }}
                    transition={{ duration: 0.3 }}
                  >
                    <Check className="w-4 h-4 text-brand-secondary group-hover/item:text-white transition-colors duration-300" />
                  </motion.div>
                  <span className="text-foreground">{benefit}</span>
                </motion.div>
              ))}
            </div>

            <motion.div
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              className="relative z-10"
            >
              <Button
                variant="whatsapp"
                className="w-full py-6 text-lg font-semibold shadow-lg group/btn"
                onClick={() => window.open(whatsappUrl, '_blank')}
              >
                <MessageCircle className="w-5 h-5 group-hover/btn:animate-bounce" />
                Comenzar ahora
              </Button>
            </motion.div>
          </motion.div>
        </motion.div>

        {/* Schedule */}
        <motion.div
          className="bg-card rounded-2xl p-8 shadow-card max-w-2xl mx-auto"
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.6, delay: 0.2 }}
          whileHover={{ y: -5 }}
        >
          <motion.div
            className="text-center mb-8"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3 }}
          >
            <div className="flex items-center justify-center gap-3 mb-4">
              <motion.div
                animate={{ rotate: [0, 360] }}
                transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
              >
                <Clock className="w-8 h-8 text-brand-secondary" />
              </motion.div>
              <h3 className="text-2xl font-bold text-brand-primary">
                Horarios de Atención
              </h3>
            </div>
            <p className="text-muted-foreground">
              Nos adaptamos a tu horario para que puedas entrenar cuando mejor te convenga
            </p>
          </motion.div>

          <div className="space-y-4">
            {schedule.map((slot, index) => (
              <motion.div
                key={index}
                className="flex justify-between items-center py-4 px-4 border-b border-border last:border-0 rounded-lg hover:bg-brand-light/50 transition-colors duration-300"
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.4 + index * 0.1 }}
                whileHover={{ x: 5 }}
              >
                <div className="flex items-center gap-3">
                  <motion.div
                    whileHover={{ rotate: [0, -10, 10, 0] }}
                    transition={{ duration: 0.3 }}
                  >
                    <Calendar className="w-5 h-5 text-brand-secondary" />
                  </motion.div>
                  <span className="font-medium text-brand-primary">{slot.day}</span>
                </div>
                <span className="text-muted-foreground font-semibold bg-brand-light px-3 py-1 rounded-full">
                  {slot.time}
                </span>
              </motion.div>
            ))}
          </div>

          <motion.div
            className="mt-8 p-4 bg-gradient-to-r from-brand-light to-brand-soft rounded-xl"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.7 }}
          >
            <p className="text-sm text-center text-muted-foreground">
              <strong>Nota:</strong> Horarios pueden variar en días festivos.
              Confirma tu horario preferido al agendar por WhatsApp.
            </p>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
};

export default Pricing;