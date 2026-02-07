import { Button } from "@/components/ui/button";
import { MessageCircle, Clock, ChevronDown } from "lucide-react";
import { motion } from "framer-motion";
import heroBackground from "@/assets/hero-background.jpg";

const Hero = () => {
  const scrollToServices = () => {
    const element = document.getElementById('servicios');
    if (element) element.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-black">
      {/* Image Background with parallax effect */}
      <motion.div
        className="absolute inset-0 z-0"
        initial={{ scale: 1.2 }}
        animate={{ scale: 1 }}
        transition={{ duration: 20, ease: "easeOut" }}
      >
        <img
          src={heroBackground}
          alt="Prime Fit & Health local"
          className="w-full h-full object-cover opacity-30"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/50 to-black/80"></div>
      </motion.div>

      {/* Animated floating particles */}
      <div className="absolute inset-0 z-[1] overflow-hidden">
        {[...Array(6)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-2 h-2 bg-brand-secondary/20 rounded-full"
            style={{
              left: `${15 + i * 15}%`,
              top: `${20 + (i % 3) * 25}%`,
            }}
            animate={{
              y: [0, -30, 0],
              opacity: [0.3, 0.8, 0.3],
              scale: [1, 1.5, 1],
            }}
            transition={{
              duration: 4 + i * 0.5,
              repeat: Infinity,
              ease: "easeInOut",
              delay: i * 0.5,
            }}
          />
        ))}
      </div>

      <div className="relative z-10 container mx-auto px-4 sm:px-6 lg:px-8 text-center">
        {/* Social Proof Bar */}
        <motion.div
          initial={{ opacity: 0, y: -30, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.2, type: "spring" }}
          className="flex flex-wrap justify-center items-center gap-8 mb-12 bg-white/10 backdrop-blur-md rounded-2xl py-4 px-8 border border-white/20"
        >
          <motion.div
            className="flex items-center gap-2 text-brand-light"
            whileHover={{ scale: 1.1 }}
          >
            <motion.div
              animate={{ rotate: [0, 360] }}
              transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
            >
              <Clock className="w-5 h-5" />
            </motion.div>
            <span className="font-semibold">&lt;60min</span>
            <span className="text-sm opacity-80">Sesiones</span>
          </motion.div>
        </motion.div>

        {/* Main Headline with word animation */}
        <motion.h1
          className="text-5xl md:text-6xl lg:text-7xl font-serif font-bold text-brand-light mb-8 leading-tight"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          <motion.span
            className="inline-block"
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5 }}
          >
            Recupera tu cuerpo.
          </motion.span>
          <br />
          <motion.span
            className="inline-block text-brand-secondary"
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.7 }}
          >
            Entrena sin perder tiempo.
          </motion.span>
        </motion.h1>

        {/* Subheading */}
        <motion.p
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.9 }}
          className="text-xl md:text-2xl text-brand-light/90 max-w-4xl mx-auto mb-12 leading-relaxed font-light"
        >
          Kinesiología y entrenamiento personal en Puerto Montt.
          <br className="hidden md:block" />
          Rehabilitación basada en ejercicio y rutinas efectivas para personas ocupadas y que valoran su tiempo.
        </motion.p>

        {/* CTA Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 1.1 }}
          className="flex flex-col sm:flex-row gap-6 justify-center items-center mb-16"
        >
          <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Button
              size="lg"
              onClick={() => window.open("https://wa.me/56956286651?text=Hola!%20Quiero%20más%20información%20sobre%20los%20entrenamientos%20en%20Prime%20F%26H.", "_blank")}
              className="bg-brand-secondary hover:bg-brand-secondary/90 text-white px-10 py-7 text-lg font-semibold shadow-2xl relative overflow-hidden group"
            >
              {/* Shine effect */}
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full"
                animate={{ translateX: ["-100%", "200%"] }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  repeatDelay: 3,
                  ease: "easeInOut"
                }}
              />
              <motion.div
                className="flex items-center gap-2 relative z-10"
                animate={{ x: [0, 3, 0] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                <MessageCircle className="w-6 h-6" />
                Agendar hora por WhatsApp
              </motion.div>
            </Button>
          </motion.div>
        </motion.div>

        {/* Scroll indicator */}
        <motion.div
          className="absolute bottom-10 left-1/2 -translate-x-1/2 cursor-pointer"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2 }}
          onClick={scrollToServices}
        >
          <motion.div
            animate={{ y: [0, 10, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            className="text-white/50 hover:text-white transition-colors"
          >
            <ChevronDown className="w-10 h-10" />
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
};

export default Hero;