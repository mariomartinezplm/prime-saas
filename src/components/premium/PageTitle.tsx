import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { EYEBROW_SOFT } from '@/components/dashboard/brand';

interface PageTitleProps {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
  // Titular editorial en Playfair Display (Clinical Luxury): para pantallas de datos y logros
  serif?: boolean;
}

// Encabezado editorial de pantalla del paciente: etiqueta breve, título claro (no gigante) y, si hay, una acción principal debajo.
const PageTitle = ({ eyebrow, title, description, actions, className, serif }: PageTitleProps) => (
  <header className={cn('space-y-1.5', className)}>
    {eyebrow && <p className={EYEBROW_SOFT}>{eyebrow}</p>}
    <h1 className={cn(serif ? 'font-serif text-[2rem] font-medium leading-[1.1] tracking-[-0.01em] sm:text-[2.25rem]' : 'text-[1.75rem] font-extrabold leading-[1.1] tracking-tight sm:text-[2rem]', 'text-[#fff8e4]')}>{title}</h1>
    {description && <p className="max-w-[46ch] text-[15px] text-[#fff8e4]/72">{description}</p>}
    {actions && <div className="flex flex-wrap items-center gap-2 pt-2">{actions}</div>}
  </header>
);

export default PageTitle;
