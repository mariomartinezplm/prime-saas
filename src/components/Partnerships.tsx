import { useRef, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, MessageCircle } from "lucide-react";
import transmarkoLogo from "@/assets/transmarko.png";
import skorpiosLogo from "@/assets/skorpios.png";
import bienestarLogo from "@/assets/bienestar-san-javier.jpg";

const Partnerships = () => {
  const [isPlaying, setIsPlaying] = useState(true);
  const carouselRef = useRef<HTMLDivElement>(null);

  const partners = [
    { name: "Transmarko", logo: transmarkoLogo },
    { name: "Skorpios", logo: skorpiosLogo },
    { name: "Bienestar San Javier", logo: bienestarLogo },
  ];

  // Duplicate for infinite scroll effect
  const duplicatedPartners = [...partners, ...partners, ...partners];

  useEffect(() => {
    const carousel = carouselRef.current;
    if (!carousel || !isPlaying) return;

    const scrollInterval = setInterval(() => {
      if (carousel.scrollLeft >= carousel.scrollWidth / 2) {
        carousel.scrollLeft = 0;
      } else {
        carousel.scrollLeft += 1;
      }
    }, 30);

    return () => clearInterval(scrollInterval);
  }, [isPlaying]);

  const handlePrevious = () => {
    if (carouselRef.current) {
      carouselRef.current.scrollBy({ left: -200, behavior: "smooth" });
    }
  };

  const handleNext = () => {
    if (carouselRef.current) {
      carouselRef.current.scrollBy({ left: 200, behavior: "smooth" });
    }
  };

  const handleWhatsAppContact = () => {
    const whatsappUrl =
      "https://wa.me/56956286651?text=Hola!%20Me%20gustar%C3%ADa%20hacer%20un%20convenio%20con%20ustedes";
    window.open(whatsappUrl, "_blank");
  };

  return (
    <section className="py-24 bg-brand-primary">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl lg:text-5xl font-bold text-brand-light mb-6">
            Socios Corporativos de Confianza
          </h2>
          <p className="text-xl text-brand-light/80 max-w-3xl mx-auto leading-relaxed">
            Empresas líderes confían en nosotros para mantener a sus equipos
            saludables, en forma y rindiendo al máximo
          </p>
        </div>

        {/* Carousel Container */}
        <div className="relative">
          {/* Navigation Buttons */}
          <Button
            variant="outline"
            size="icon"
            className="absolute left-4 top-1/2 -translate-y-1/2 z-10 bg-white/10 border-white/20 hover:bg-white/20 text-white"
            onClick={handlePrevious}
          >
            <ChevronLeft className="w-6 h-6" />
          </Button>

          <Button
            variant="outline"
            size="icon"
            className="absolute right-4 top-1/2 -translate-y-1/2 z-10 bg-white/10 border-white/20 hover:bg-white/20 text-white"
            onClick={handleNext}
          >
            <ChevronRight className="w-6 h-6" />
          </Button>

          {/* Carousel */}
          <div
            ref={carouselRef}
            className="flex gap-12 overflow-x-hidden py-8 px-16 items-center justify-center"
            onMouseEnter={() => setIsPlaying(false)}
            onMouseLeave={() => setIsPlaying(true)}
            style={{ scrollBehavior: "smooth" }}
          >
            {duplicatedPartners.map((partner, index) => (
              <div
                key={`${partner.name}-${index}`}
                className="flex-shrink-0 w-56 h-28 bg-white rounded-2xl p-5 flex items-center justify-center hover:shadow-lg transition-all duration-300 border border-gray-100"
              >
                <img
                  src={partner.logo}
                  alt={partner.name}
                  className="max-w-full max-h-full object-contain"
                  loading="lazy"
                />
              </div>
            ))}
          </div>
        </div>

        {/* CTA Section */}
        <div className="text-center mt-16">
          <div className="bg-white/10 backdrop-blur-sm rounded-3xl p-8 max-w-2xl mx-auto border border-white/20">
            <h3 className="text-2xl font-bold text-brand-light mb-4">
              ¿Quieres una Alianza Corporativa?
            </h3>
            <p className="text-brand-light/80 mb-6 leading-relaxed">
              Únete a líderes de la industria priorizando el bienestar de
              empleados. Ofrecemos programas corporativos de salud personalizados
              diseñados para aumentar la productividad y satisfacción laboral.
            </p>
            <Button
              onClick={handleWhatsAppContact}
              className="bg-brand-secondary hover:bg-brand-secondary/90 text-white px-8 py-4 text-lg font-semibold"
            >
              <MessageCircle className="w-5 h-5 mr-2" />
              Contáctanos por WhatsApp
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Partnerships;
