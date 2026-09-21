import React from "react";
import { motion } from "framer-motion";
import useScrollAnimation from "@/hooks/useScrollAnimation";

interface ScrollAnimatedSectionProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  direction?: 'up' | 'down' | 'left' | 'right';
}

const ScrollAnimatedSection: React.FC<ScrollAnimatedSectionProps> = ({
  children,
  className = "",
  delay = 0,
  direction = 'up'
}) => {
  const { elementRef, isVisible } = useScrollAnimation({
    threshold: 0.1,
    triggerOnce: true
  });

  // Nota: nunca se anima "opacity" aquí. Este wrapper envuelve secciones
  // full-bleed con su propio fondo (bg-landing-dark, etc.) — si empieza en
  // opacity:0, la sección es invisible hasta que el observer dispara, y se
  // ve el blanco del <body> a través de ella (esa era una causa real del
  // bug de "la página se ve blanca"). El desplazamiento leve (x/y) es
  // suficiente para el efecto de entrada sin ese riesgo.
  const getInitialTransform = () => {
    switch (direction) {
      case 'up': return { y: 30 };
      case 'down': return { y: -30 };
      case 'left': return { x: 30 };
      case 'right': return { x: -30 };
      default: return { y: 30 };
    }
  };

  const getFinalTransform = () => {
    switch (direction) {
      case 'up':
      case 'down':
        return { y: 0 };
      case 'left':
      case 'right':
        return { x: 0 };
      default:
        return { y: 0 };
    }
  };

  return (
    <motion.section
      ref={elementRef}
      className={className}
      initial={getInitialTransform()}
      animate={isVisible ? getFinalTransform() : getInitialTransform()}
      transition={{
        duration: 0.8,
        delay: delay,
        ease: [0.21, 0.45, 0.27, 0.9]
      }}
    >
      {children}
    </motion.section>
  );
};

export default ScrollAnimatedSection;