import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  // Insignias junto al título (Miembro Fundador, estado...)
  badges?: ReactNode;
  // Botones de acción a la derecha; en pantallas angostas pasan debajo del título
  actions?: ReactNode;
  className?: string;
}

// Encabezado único de página: reemplaza las 4 variantes de <h1> que había.
const PageHeader = ({ title, description, badges, actions, className }: PageHeaderProps) => (
  <header className={cn('flex flex-wrap items-start justify-between gap-x-4 gap-y-3', className)}>
    <div className="min-w-0 space-y-1">
      <h1 className="flex flex-wrap items-center gap-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
        {title}
        {badges}
      </h1>
      {description && <p className="text-sm text-muted-foreground sm:text-base">{description}</p>}
    </div>
    {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
  </header>
);

export default PageHeader;
