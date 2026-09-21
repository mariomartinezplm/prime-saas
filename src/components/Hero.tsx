import { Button } from "@/components/ui/button";
import { MessageCircle, Clock, ChevronDown, Users, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import heroBackground from "@/assets/hero-background.jpg";
import { getWhatsAppUrl } from "@/config/contact";

const Hero = () => {
  const scrollToServices = () => {
    const element = document.getElementById('servicios');
    if (element) element.scrollIntoView({ behavior: 'smooth' });
  };

  const stats = [
    { icon: Clock, value: "<60min", label: "por sesión" },
    { icon: Users, value: "Máx. 4", label: "personas/hora" },
    { icon: Sparkles, value: "100%", label: "personalizado" },
  ];

  return (
    <section className="relative overflow-hidden bg-landing-dark pt-40 pb-24 lg:pt-48 lg:pb-32">
      {/* Ambient glow */}
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-brand-secondary/10 rounded-full blur-3xl -translate-y-1/3 translate-x-1/4 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-brand-secondary/5 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-16 items-center">
          {/* Text column */}
          <div className="text-center lg:text-left">
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="inline-flex items-center gap-2 text-brand-secondary text-sm font-semibold uppercase tracking-wider mb-6"
            >
              <span className="h-px w-8 bg-brand-secondary/60" />
              Kinesiología &amp; Entrenamiento en Puerto Montt
            </motion.div>

            <motion.h1
              className="text-5xl md:text-6xl lg:text-[4.5rem] font-serif font-bold text-brand-light mb-6 leading-[1.05]"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
            >
              Recupera tu cuerpo.
              <br />
              <span className="text-brand-secondary">Entrena sin perder</span>
              <br />
              tiempo.
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-lg md:text-xl text-brand-light/70 max-w-xl mx-auto lg:mx-0 mb-10 leading-relaxed"
            >
              Rehabilitación basada en ejercicio y rutinas efectivas para personas ocupadas y que valoran su tiempo.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="flex justify-center lg:justify-start mb-14"
            >
              <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                <Button
                  size="lg"
                  onClick={() => window.open(getWhatsAppUrl("Hola! Quiero más información sobre los entrenamientos en Prime F&H."), "_blank")}
                  className="bg-brand-secondary hover:bg-brand-secondary/90 text-white px-10 py-7 text-lg font-semibold shadow-cta"
                >
                  <MessageCircle className="w-5 h-5" />
                  Agendar hora por WhatsApp
                </Button>
              </motion.div>
            </motion.div>

            {/* Stat row */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="flex flex-wrap justify-center lg:justify-start gap-x-10 gap-y-6"
            >
              {stats.map((stat, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="bg-brand-secondary/15 rounded-lg p-2.5">
                    <stat.icon className="w-5 h-5 text-brand-secondary" />
                  </div>
                  <div className="text-left">
                    <div className="text-xl font-bold text-brand-secondary leading-none">{stat.value}</div>
                    <div className="text-xs text-brand-light/50 mt-1">{stat.label}</div>
                  </div>
                </div>
              ))}
            </motion.div>
          </div>

          {/* Image column */}
          <motion.div
            className="relative hidden lg:block"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            <div className="absolute -inset-4 bg-gradient-to-br from-brand-secondary/30 to-transparent rounded-[2.5rem] blur-2xl" />
            <div className="relative rounded-[2rem] overflow-hidden border border-white/10 shadow-elevated aspect-[4/5]">
              <img
                src={heroBackground}
                alt="Prime Fit & Health local"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-landing-dark/70 via-transparent to-transparent" />
            </div>
            {/* Floating badge */}
            <motion.div
              className="absolute -bottom-6 -left-6 bg-brand-dark/95 backdrop-blur-md border border-white/10 rounded-2xl px-6 py-4 shadow-elevated"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 }}
            >
              <div className="flex items-center gap-2 text-brand-light">
                <Clock className="w-5 h-5 text-brand-secondary" />
                <span className="font-semibold">Sesiones de menos de 60 min</span>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </div>

      {/* Scroll indicator */}
      <motion.div
        className="hidden sm:block absolute bottom-10 left-1/2 -translate-x-1/2 cursor-pointer"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2 }}
        onClick={scrollToServices}
      >
        <motion.div
          animate={{ y: [0, 10, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          className="text-white/40 hover:text-white transition-colors"
        >
          <ChevronDown className="w-8 h-8" />
        </motion.div>
      </motion.div>
    </section>
  );
};

export default Hero;
