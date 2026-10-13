import type { ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { useAppDarkTheme } from '@/hooks/useAppDarkTheme';
import logoImage from '@/assets/prime-fh-logo.png';

interface AuthLayoutProps {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  // Enlaces o ayuda bajo la tarjeta (volver, instalar…)
  footer?: ReactNode;
}

// Molde único de las pantallas de acceso (ingresar, recuperar, activar cuenta, restablecer):
// antes cada una repetía su propio fondo, logo y tarjeta blanca.
const AuthLayout = ({ title, subtitle, children, footer }: AuthLayoutProps) => {
  useAppDarkTheme();
  const reduceMotion = useReducedMotion();

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      {/* Resplandor de marca fijo: sin animación continua que distraiga o gaste batería */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[420px] bg-[radial-gradient(ellipse_at_top,hsl(var(--primary)/0.22),transparent_70%)]"
      />
      <main id="contenido" className="relative z-10 mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-4 py-10">
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
        >
          <header className="mb-6 text-center">
            <img src={logoImage} alt="Prime F&H" className="mx-auto mb-4 h-14" />
            <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">{title}</h1>
            {subtitle && <p className="mt-1 text-sm text-muted-foreground sm:text-base">{subtitle}</p>}
          </header>

          <Card className="p-5 shadow-elevated sm:p-6">{children}</Card>

          {footer && <div className="mt-5 space-y-3 text-center text-sm">{footer}</div>}
        </motion.div>
      </main>
    </div>
  );
};

export default AuthLayout;
