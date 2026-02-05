import { Clock, Target, TrendingUp, Shield, Heart, Zap } from "lucide-react";
import { motion } from "framer-motion";

const Benefits = () => {
  const trainingBenefits = [
    {
      icon: Target,
      title: "Tu rutina, tu objetivo",
      description: "Cada persona tiene su propia rutina diseñada según sus metas y nivel. Aquí nadie hace lo mismo."
    },
    {
      icon: Clock,
      title: "Menos de 60 min, sin perder eficacia",
      description: "Entrenamientos optimizados para personas con poco tiempo"
    },
    {
      icon: TrendingUp,
      title: "Máximo 4 personas por hora",
      description: "Seguimiento constante, corrección en tiempo real y ajustes semanales para mejores resultados"
    },
    {
      icon: Zap,
      title: "Ahorra tiempo, gana resultados",
      description: "Maximiza tu inversión de tiempo con métodos comprobados"
    }
  ];

  const kineBenefits = [
    {
      icon: Heart,
      title: "Dolor y lesiones tratados con ejercicio",
      description: "Enfoque basado en movimiento para una recuperación integral"
    },
    {
      icon: Shield,
      title: "Retorno a la vida diaria y deportiva igual o mejor",
      description: "No solo recuperamos, te llevamos a un nivel superior"
    },
    {
      icon: TrendingUp,
      title: "Prevención de recaídas, fuerza y control",
      description: "Fortalecemos las bases para evitar futuras lesiones"
    },
    {
      icon: Target,
      title: "Rehabilitación funcional personalizada",
      description: "Ejercicios específicos para tus actividades y objetivos"
    }
  ];

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const cardVariants = {
    hidden: { opacity: 0, y: 40, scale: 0.95 },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        type: "spring" as const,
        stiffness: 100,
        damping: 15
      }
    }
  };

  return (
    <section className="py-20 bg-background relative overflow-hidden">
      {/* Subtle animated background */}
      <motion.div
        className="absolute top-0 right-0 w-[500px] h-[500px] bg-brand-primary/5 rounded-full blur-3xl"
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
        className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-brand-secondary/5 rounded-full blur-3xl"
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
        {/* Training Benefits */}
        <div className="mb-20">
          <motion.div
            className="text-center mb-12"
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
              💪 Entrenamiento
            </motion.span>
            <h2 className="text-3xl lg:text-4xl font-bold text-brand-primary mb-4">
              Entrenamiento Personalizado
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Resultados reales para personas ocupadas que buscan eficiencia
            </p>
          </motion.div>

          <motion.div
            className="grid md:grid-cols-2 lg:grid-cols-4 gap-8"
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
          >
            {trainingBenefits.map((benefit, index) => (
              <motion.div
                key={index}
                variants={cardVariants}
                whileHover={{
                  y: -12,
                  scale: 1.03,
                  transition: { type: "spring", stiffness: 400, damping: 17 }
                }}
                className="bg-card rounded-xl p-6 shadow-card hover:shadow-xl transition-shadow duration-300 cursor-default group"
              >
                <motion.div
                  className="bg-brand-light rounded-xl p-3 w-fit mb-4 group-hover:bg-brand-primary transition-colors duration-300"
                  whileHover={{ rotate: [0, -5, 5, 0] }}
                  transition={{ duration: 0.4 }}
                >
                  <benefit.icon className="w-6 h-6 text-brand-primary group-hover:text-white transition-colors duration-300" />
                </motion.div>
                <h3 className="text-lg font-semibold text-brand-primary mb-3">
                  {benefit.title}
                </h3>
                <p className="text-muted-foreground">
                  {benefit.description}
                </p>
              </motion.div>
            ))}
          </motion.div>
        </div>

        {/* Kinesiología Benefits */}
        <div>
          <motion.div
            className="text-center mb-12"
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
              🩺 Rehabilitación
            </motion.span>
            <h2 className="text-3xl lg:text-4xl font-bold text-brand-primary mb-4">
              Kinesiología
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Recuperación, retorno deportivo y tratamiento de dolor crónico
            </p>
          </motion.div>

          <motion.div
            className="grid md:grid-cols-2 lg:grid-cols-4 gap-8"
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
          >
            {kineBenefits.map((benefit, index) => (
              <motion.div
                key={index}
                variants={cardVariants}
                whileHover={{
                  y: -12,
                  scale: 1.03,
                  transition: { type: "spring", stiffness: 400, damping: 17 }
                }}
                className="bg-card rounded-xl p-6 shadow-card hover:shadow-xl transition-shadow duration-300 cursor-default group"
              >
                <motion.div
                  className="bg-brand-light rounded-xl p-3 w-fit mb-4 group-hover:bg-brand-secondary transition-colors duration-300"
                  whileHover={{ rotate: [0, -5, 5, 0] }}
                  transition={{ duration: 0.4 }}
                >
                  <benefit.icon className="w-6 h-6 text-brand-secondary group-hover:text-white transition-colors duration-300" />
                </motion.div>
                <h3 className="text-lg font-semibold text-brand-primary mb-3">
                  {benefit.title}
                </h3>
                <p className="text-muted-foreground">
                  {benefit.description}
                </p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default Benefits;