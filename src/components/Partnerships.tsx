import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, MessageCircle } from "lucide-react";

const Partnerships = () => {
  const [isPlaying, setIsPlaying] = useState(true);
  const carouselRef = useRef<HTMLDivElement>(null);

  // Placeholder logos - replace with actual company logos
  const partners = [
    { name: "Microsoft", logo: "https://images.unsplash.com/photo-1633409361618-c73427e4e206?w=200&h=100&fit=crop&crop=center" },
    { name: "Google", logo: "https://images.unsplash.com/photo-1573804633927-bfcbcd909acd?w=200&h=100&fit=crop&crop=center" },
    { name: "Apple", logo: "https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=200&h=100&fit=crop&crop=center" },
    { name: "Amazon", logo: "https://images.unsplash.com/photo-1523474253046-8cd2748b5fd2?w=200&h=100&fit=crop&crop=center" },
    { name: "Tesla", logo: "https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=200&h=100&fit=crop&crop=center" },
    { name: "Netflix", logo: "https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?w=200&h=100&fit=crop&crop=center" },
    { name: "Spotify", logo: "https://images.unsplash.com/photo-1614680376573-df3480f0c6ff?w=200&h=100&fit=crop&crop=center" },
    { name: "Meta", logo: "https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=200&h=100&fit=crop&crop=center" },
  ];

  // Duplicate for infinite scroll effect
  const duplicatedPartners = [...partners, ...partners];

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
      carouselRef.current.scrollBy({ left: -200, behavior: 'smooth' });
    }
  };

  const handleNext = () => {
    if (carouselRef.current) {
      carouselRef.current.scrollBy({ left: 200, behavior: 'smooth' });
    }
  };

  const handleWhatsAppContact = () => {
    const whatsappUrl = "https://wa.me/56912345678?text=Hola! Nos interesa explorar una alianza corporativa con Prime Fit %26 Health. ¿Podrían contactarnos para conversar sobre opciones?";
    window.open(whatsappUrl, '_blank');
  };

  return (
    <section className="py-24 bg-brand-primary">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl lg:text-5xl font-bold text-brand-light mb-6">
            Trusted Corporate Partners
          </h2>
          <p className="text-xl text-brand-light/80 max-w-3xl mx-auto leading-relaxed">
            Leading companies trust us to keep their teams healthy, fit, and performing at their best
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
            className="flex gap-8 overflow-x-hidden py-8 cursor-grab active:cursor-grabbing"
            onMouseEnter={() => setIsPlaying(false)}
            onMouseLeave={() => setIsPlaying(true)}
            style={{ scrollBehavior: 'smooth' }}
          >
            {duplicatedPartners.map((partner, index) => (
              <div
                key={`${partner.name}-${index}`}
                className="flex-shrink-0 w-48 h-24 bg-white/10 backdrop-blur-sm rounded-2xl p-4 flex items-center justify-center hover:bg-white/20 transition-all duration-300 border border-white/20"
              >
                <img
                  src={partner.logo}
                  alt={partner.name}
                  className="max-w-full max-h-full object-contain filter brightness-0 invert opacity-80 hover:opacity-100 transition-opacity duration-300"
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
              Want a Corporate Partnership?
            </h3>
            <p className="text-brand-light/80 mb-6 leading-relaxed">
              Join industry leaders in prioritizing employee wellness. We offer customized corporate health programs designed to boost productivity and employee satisfaction.
            </p>
            <Button
              onClick={handleWhatsAppContact}
              className="bg-brand-secondary hover:bg-brand-secondary/90 text-white px-8 py-4 text-lg font-semibold"
            >
              <MessageCircle className="w-5 h-5 mr-2" />
              Contact us on WhatsApp
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Partnerships;