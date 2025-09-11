import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Menu, X, MessageCircle } from "lucide-react";

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
      setIsMenuOpen(false);
    }
  };

  const whatsappUrl = "https://wa.me/56912345678?text=Hola! Me interesa conocer más sobre Prime F%26H. Me gustaría agendar una evaluación inicial.";

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-sm border-b border-border">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center">
            <h1 className="text-2xl font-bold text-brand-dark">Prime F&H</h1>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-8">
            <button 
              onClick={() => scrollToSection('servicios')}
              className="text-foreground hover:text-brand-primary transition-smooth"
            >
              Servicios
            </button>
            <button 
              onClick={() => scrollToSection('como-funciona')}
              className="text-foreground hover:text-brand-primary transition-smooth"
            >
              Cómo funciona
            </button>
            <button 
              onClick={() => scrollToSection('equipo')}
              className="text-foreground hover:text-brand-primary transition-smooth"
            >
              Equipo
            </button>
            <button 
              onClick={() => scrollToSection('precios')}
              className="text-foreground hover:text-brand-primary transition-smooth"
            >
              Precios
            </button>
            <button 
              onClick={() => scrollToSection('ubicacion')}
              className="text-foreground hover:text-brand-primary transition-smooth"
            >
              Ubicación
            </button>
          </nav>

          {/* WhatsApp CTA */}
          <div className="flex items-center space-x-4">
            <Button 
              variant="whatsapp" 
              size="sm"
              onClick={() => window.open(whatsappUrl, '_blank')}
              className="hidden sm:inline-flex"
            >
              <MessageCircle className="w-4 h-4" />
              Agenda por WhatsApp
            </Button>

            {/* Mobile menu button */}
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="md:hidden p-2"
            >
              {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <div className="md:hidden py-4 border-t border-border bg-white">
            <nav className="flex flex-col space-y-4">
              <button 
                onClick={() => scrollToSection('servicios')}
                className="text-left text-foreground hover:text-brand-primary transition-smooth"
              >
                Servicios
              </button>
              <button 
                onClick={() => scrollToSection('como-funciona')}
                className="text-left text-foreground hover:text-brand-primary transition-smooth"
              >
                Cómo funciona
              </button>
              <button 
                onClick={() => scrollToSection('equipo')}
                className="text-left text-foreground hover:text-brand-primary transition-smooth"
              >
                Equipo
              </button>
              <button 
                onClick={() => scrollToSection('precios')}
                className="text-left text-foreground hover:text-brand-primary transition-smooth"
              >
                Precios
              </button>
              <button 
                onClick={() => scrollToSection('ubicacion')}
                className="text-left text-foreground hover:text-brand-primary transition-smooth"
              >
                Ubicación
              </button>
              <Button 
                variant="whatsapp" 
                size="sm"
                onClick={() => window.open(whatsappUrl, '_blank')}
                className="w-full"
              >
                <MessageCircle className="w-4 h-4" />
                Agenda por WhatsApp
              </Button>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;