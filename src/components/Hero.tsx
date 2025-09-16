import { Button } from "@/components/ui/button";
import { MessageCircle, ArrowDown, Star, Users, Clock, TrendingUp } from "lucide-react";
import { motion } from "framer-motion";
import heroImage from "@/assets/hero-training.jpg";

const Hero = () => {
  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const whatsappUrl = "https://wa.me/56956286651?text=Hola! Me interesa conocer más sobre Prime Fit %26 Health. Me gustaría agendar una evaluación inicial.";

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-dark">
      {/* Video Background */}
      <motion.div 
        className="absolute inset-0 z-0"
        initial={{ scale: 1.1 }}
        animate={{ scale: 1 }}
        transition={{ duration: 10, ease: "easeOut" }}
      >
        <video 
          autoPlay
          muted
          loop
          playsInline
          className="w-full h-full object-cover opacity-30"
        >
          <source src="https://cdn.pixabay.com/video/2023/04/25/158094-822049803_large.mp4" type="video/mp4" />
          <img 
            src={heroImage}
            alt="Entrenamiento profesional y fisioterapia en Prime Fit & Health"
            className="w-full h-full object-cover opacity-30"
          />
        </video>
        <div className="absolute inset-0 bg-gradient-to-b from-brand-primary/60 via-brand-primary/40 to-brand-primary/80"></div>
      </motion.div>

      <div className="relative z-10 container mx-auto px-4 sm:px-6 lg:px-8 text-center">
        {/* Social Proof Bar */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="flex flex-wrap justify-center items-center gap-8 mb-12 bg-white/10 backdrop-blur-md rounded-2xl py-4 px-8 border border-white/20"
        >
          <div className="flex items-center gap-2 text-brand-light">
            <Star className="w-5 h-5 fill-yellow-400 text-yellow-400" />
            <span className="font-semibold">4.9/5</span>
            <span className="text-sm opacity-80">Calificación</span>
          </div>
          <div className="flex items-center gap-2 text-brand-light">
            <Users className="w-5 h-5" />
            <span className="font-semibold">+100</span>
            <span className="text-sm opacity-80">Clientes Satisfechos</span>
          </div>
          <div className="flex items-center gap-2 text-brand-light">
            <Clock className="w-5 h-5" />
            <span className="font-semibold">&lt;60min</span>
            <span className="text-sm opacity-80">Sesiones</span>
          </div>
        </motion.div>

        {/* Main Headline */}
        <motion.h1 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.4 }}
          className="text-5xl md:text-6xl lg:text-7xl font-bold text-brand-light mb-8 leading-tight"
        >
          Recupera tu cuerpo.
          <br />
          <span className="text-brand-secondary">Entrena sin perder tiempo.</span>
        </motion.h1>

        {/* Subheading */}
        <motion.p 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.6 }}
          className="text-xl md:text-2xl text-brand-light/90 max-w-4xl mx-auto mb-12 leading-relaxed font-light"
        >
          Kinesiología experta y entrenamiento semi-personalizado en Puerto Montt. 
          <br className="hidden md:block" />
          Rehabilitación basada en ejercicio y rutinas efectivas para personas ocupadas.
        </motion.p>

        {/* CTA Buttons */}
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.8 }}
          className="flex flex-col sm:flex-row gap-6 justify-center items-center mb-16"
        >
          <Button
            onClick={() => window.open(whatsappUrl, '_blank')}
            size="lg"
            className="bg-brand-secondary hover:bg-brand-secondary/90 text-white px-8 py-6 text-lg font-semibold shadow-cta transform hover:scale-105 transition-all duration-300"
          >
            <MessageCircle className="w-6 h-6 mr-2" />
            Reservar por WhatsApp
          </Button>
        </motion.div>
      </div>
    </section>
  );
};

export default Hero;