import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Menu, X, Calendar } from "lucide-react";
import logoImage from "@/assets/prime-fh-logo.png";
import { motion } from "framer-motion";

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 100);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
      setIsMenuOpen(false);
    }
  };

  return (
    <motion.header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${isScrolled
        ? 'bg-brand-dark/95 backdrop-blur-md shadow-elevated py-2'
        : 'bg-brand-dark/90 backdrop-blur-sm py-4'
        } border-b border-brand-secondary/20`}
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.6 }}
    >
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <motion.div
            className="flex items-center"
            whileHover={{ scale: 1.05 }}
            transition={{ duration: 0.2 }}
          >
            <img
              src={logoImage}
              alt="Prime Fit & Health - Kinesiología y Entrenamiento"
              className={`transition-all duration-300 ${isScrolled ? 'h-8' : 'h-12'
                } w-auto`}
            />
          </motion.div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-8">
            {[
              { label: "Servicios", id: "servicios" },
              { label: "Cómo Funciona", id: "como-funciona" },
              { label: "Equipo", id: "equipo" },
              { label: "Precios", id: "precios" },
              { label: "Ubicación", id: "ubicacion" }
            ].map((item, index) => (
              <motion.button
                key={item.id}
                onClick={() => scrollToSection(item.id)}
                className="text-brand-light hover:text-brand-secondary transition-colors font-medium"
                whileHover={{ y: -2 }}
                transition={{ duration: 0.2 }}
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                {item.label}
              </motion.button>
            ))}
          </nav>

          {/* WhatsApp CTA */}
          <div className="flex items-center space-x-4">
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Button
                variant="default"
                size="sm"
                className="hidden sm:inline-flex bg-brand-secondary hover:bg-brand-secondary/90 text-white"
                onClick={() => navigate('/login')}
              >
                <Calendar className="w-4 h-4 mr-2" />
                Portal del Paciente
              </Button>
            </motion.div>

            {/* Mobile menu button */}
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="md:hidden p-2 text-brand-light"
            >
              {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <motion.div
            className="md:hidden py-6 border-t border-brand-secondary/20 bg-brand-dark/95 backdrop-blur-sm mt-4 rounded-lg"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            <nav className="flex flex-col space-y-4">
              {[
                { label: "Servicios", id: "servicios" },
                { label: "Cómo Funciona", id: "como-funciona" },
                { label: "Equipo", id: "equipo" },
                { label: "Precios", id: "precios" },
                { label: "Ubicación", id: "ubicacion" }
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => scrollToSection(item.id)}
                  className="text-left text-brand-light hover:text-brand-secondary transition-colors font-medium py-2"
                >
                  {item.label}
                </button>
              ))}
              <Button
                variant="default"
                size="sm"
                className="w-full mt-4 bg-brand-secondary hover:bg-brand-secondary/90 text-white"
                onClick={() => navigate('/login')}
              >
                <Calendar className="w-4 h-4 mr-2" />
                Portal del Paciente
              </Button>
            </nav>
          </motion.div>
        )}
      </div>
    </motion.header>
  );
};

export default Header;