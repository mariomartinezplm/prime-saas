import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { EYEBROW_SOFT } from '@/components/dashboard/brand';

interface PageTitleProps {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

// Encabezado editorial de pantalla del paciente: etiqueta breve, título claro (no gigante) y, si hay, una acción principal debajo.
const PageTitle = ({ eyebrow, title, description, actions, className }: PageTitleProps) => (
  <header className={cn('space-y-1.5', className)}>
    {eyebrow && <p className={EYEBROW_SOFT}>{eyebrow}</p>}
    <h1 className="text-[1.75rem] font-extrabold leading-[1.1] tracking-tight text-[#fff8e4] sm:text-[2rem]">{title}</h1>
    {description && <p className="max-w-[46ch] text-[15px] text-[#fff8e4]/72">{description}</p>}
    {actions && <div className="flex flex-wrap items-center gap-2 pt-2">{actions}</div>}
  </header>
);

export default PageTitle;
