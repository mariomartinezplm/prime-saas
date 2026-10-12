import { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import logoImage from '@/assets/prime-fh-logo.png';
import { hasShownWelcome, markWelcomeShown } from '@/lib/welcomeSplash';

const DURATION = 1.5;
const REDUCED_DURATION = 0.6;
// Tope por si la imagen o la animación fallan: la pantalla nunca queda tapada.
const FAILSAFE_MS = 3500;

// Bienvenida con el logo, una vez por sesión del navegador. Vive dentro de AppLayout, que
// solo se monta cuando la sesión ya fue verificada; el panel se carga debajo mientras tanto.
const WelcomeSplash = () => {
  const [visible, setVisible] = useState(() => !hasShownWelcome());
  const [ready, setReady] = useState(false);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (!visible) return;
    markWelcomeShown();
    const timer = setTimeout(() => setVisible(false), FAILSAFE_MS);
    return () => clearTimeout(timer);
  }, [visible]);

  if (!visible) return null;

  const duration = reduceMotion ? REDUCED_DURATION : DURATION;

  return (
    <motion.div
      aria-hidden="true"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-[#070A12]"
      style={{
        minHeight: '100dvh',
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
      initial={{ opacity: 1 }}
      animate={ready ? { opacity: [1, 1, 0] } : { opacity: 1 }}
      transition={{ duration, times: [0, 0.67, 1], ease: 'easeInOut' }}
      onAnimationComplete={() => ready && setVisible(false)}
    >
      <motion.img
        src={logoImage}
        alt=""
        width={1920}
        height={1590}
        draggable={false}
        decoding="async"
        style={{ width: 'min(60vw, 280px)', height: 'auto' }}
        ref={(el) => {
          if (el?.complete) setReady(true);
        }}
        onLoad={() => setReady(true)}
        onError={() => setReady(true)}
        initial={{ opacity: reduceMotion ? 1 : 0, scale: reduceMotion ? 1 : 0.85 }}
        animate={
          ready && !reduceMotion
            ? { opacity: [0, 1, 1, 0], scale: [0.85, 1.06, 1, 0.78] }
            : undefined
        }
        transition={{
          duration: DURATION,
          times: [0, 0.4, 0.67, 1],
          ease: [
            [0.22, 1, 0.36, 1],
            [0.4, 0, 0.2, 1],
            [0.4, 0, 1, 1],
          ],
        }}
      />
    </motion.div>
  );
};

export default WelcomeSplash;
