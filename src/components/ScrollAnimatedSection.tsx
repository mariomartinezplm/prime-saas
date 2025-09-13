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

  const getInitialTransform = () => {
    switch (direction) {
      case 'up': return { y: 30, opacity: 0 };
      case 'down': return { y: -30, opacity: 0 };
      case 'left': return { x: 30, opacity: 0 };
      case 'right': return { x: -30, opacity: 0 };
      default: return { y: 30, opacity: 0 };
    }
  };

  const getFinalTransform = () => {
    switch (direction) {
      case 'up':
      case 'down':
        return { y: 0, opacity: 1 };
      case 'left':
      case 'right':
        return { x: 0, opacity: 1 };
      default:
        return { y: 0, opacity: 1 };
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