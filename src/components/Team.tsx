import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, User } from "lucide-react";
import { motion } from "framer-motion";
import marioMartinez from "@/assets/mario-martinez.jpg";
import tomasEspinoza from "@/assets/tomas-espinoza.jpg";

const Team = () => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const isPaused = useRef(false);

  const team = [
    {
      name: "Mario Martínez P.",
      role: "Kinesiólogo - Entrenador",
      image: marioMartinez,
    },
    {
      name: "Felipe Vega",
      role: "Kinesiólogo - Entrenador",
      image: null,
    },
    {
      name: "Tomás Espinoza",
      role: "Kinesiólogo - Entrenador",
      image: tomasEspinoza,
    },
    {
      name: "Rafael Castañeda",
      role: "Kinesiólogo",
      image: null,
    },
  ];

  // Duplicate for infinite loop effect
  const duplicatedTeam = [...team, ...team];

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    let animationId: number;
    const speed = 0.8;

    const step = () => {
      if (!isPaused.current && container) {
        container.scrollLeft += speed;
        // Reset seamlessly when we've scrolled through the first set
        const halfScroll = container.scrollWidth / 2;
        if (container.scrollLeft >= halfScroll) {
          container.scrollLeft = 0;
        }
      }
      animationId = requestAnimationFrame(step);
    };

    animationId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animationId);
  }, []);

  const scrollBy = (direction: "left" | "right") => {
    if (scrollRef.current) {
      const amount = direction === "left" ? -360 : 360;
      scrollRef.current.scrollBy({ left: amount, behavior: "smooth" });
    }
  };

  return (
    <section id="equipo" className="py-24 bg-brand-dark">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl lg:text-5xl font-bold text-white mb-6">
            Nuestro Equipo
          </h2>
          <p className="text-xl text-white/70 max-w-3xl mx-auto leading-relaxed">
            Conoce a nuestros profesionales dedicados a tu salud, recuperación y
            máximo rendimiento
          </p>
        </div>

        <div className="relative overflow-hidden">
          {/* Arrow left */}
          <button
            onClick={() => scrollBy("left")}
            className="absolute left-2 top-1/2 -translate-y-1/2 z-20 bg-white/90 hover:bg-brand-secondary hover:text-white shadow-elevated rounded-full p-3 text-brand-primary transition-all duration-300"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>

          {/* Arrow right */}
          <button
            onClick={() => scrollBy("right")}
            className="absolute right-2 top-1/2 -translate-y-1/2 z-20 bg-white/90 hover:bg-brand-secondary hover:text-white shadow-elevated rounded-full p-3 text-brand-primary transition-all duration-300"
          >
            <ChevronRight className="w-6 h-6" />
          </button>

          <div
            ref={scrollRef}
            className="flex gap-8 overflow-hidden px-14"
            onMouseEnter={() => { isPaused.current = true; }}
            onMouseLeave={() => { isPaused.current = false; setHoveredIndex(null); }}
          >
            {duplicatedTeam.map((member, index) => (
              <motion.div
                key={index}
                className="relative flex-shrink-0 w-[340px] h-[440px] rounded-3xl overflow-hidden cursor-pointer"
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
                animate={{
                  scale: hoveredIndex === index ? 1.08 : 1,
                  zIndex: hoveredIndex === index ? 20 : 1,
                }}
                transition={{ type: "spring", stiffness: 300, damping: 25 }}
              >
                {/* Card background */}
                <div className="absolute inset-0 bg-brand-secondary rounded-3xl" />

                {/* Photo / Placeholder — fills entire card */}
                <div className="absolute inset-0 z-[1] overflow-hidden rounded-3xl">
                  {member.image ? (
                    <motion.img
                      src={member.image}
                      alt={member.name}
                      className="w-full h-full object-cover"
                      animate={{
                        scale: hoveredIndex === index ? 1.1 : 1,
                      }}
                      transition={{ type: "spring", stiffness: 300, damping: 20 }}
                    />
                  ) : (
                    <div className="w-full h-full bg-brand-secondary flex items-center justify-center">
                      <User className="w-24 h-24 text-white/30" />
                    </div>
                  )}
                </div>

                {/* Name strip at bottom */}
                <div className="absolute bottom-0 left-0 right-0 z-[5] px-4 py-4 rounded-b-3xl">
                  <div className="bg-brand-primary/90 backdrop-blur-sm rounded-xl px-4 py-3">
                    <h3 className="text-xl font-bold text-white">
                      {member.name}
                    </h3>
                    <p className="text-brand-secondary text-sm mt-1">{member.role}</p>
                  </div>
                </div>

                {/* Progress bar accent */}
                <motion.div
                  className="absolute bottom-0 left-0 h-1 bg-brand-secondary z-[10] rounded-bl-3xl"
                  initial={{ width: "0%" }}
                  animate={{
                    width: hoveredIndex === index ? "100%" : "30%",
                  }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                />
              </motion.div>
            ))}
          </div>

          {/* Fade edges */}
          <div className="absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-[hsl(var(--brand-dark))] to-transparent z-10 pointer-events-none" />
          <div className="absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-[hsl(var(--brand-dark))] to-transparent z-10 pointer-events-none" />
        </div>
      </div>
    </section>
  );
};

export default Team;
