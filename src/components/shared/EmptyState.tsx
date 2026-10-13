import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: ReactNode;
  // Botón o enlace con la siguiente acción posible
  action?: ReactNode;
  className?: string;
}

// Estado vacío único: dice qué falta y, si hay, qué hacer.
const EmptyState = ({ icon: Icon, title, description, action, className }: EmptyStateProps) => (
  <div
    className={cn(
      'flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border px-6 py-10 text-center',
      className
    )}
  >
    {Icon && (
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icon className="h-6 w-6" aria-hidden="true" />
      </span>
    )}
    <div className="space-y-1">
      <p className="font-medium text-foreground">{title}</p>
      {description && <p className="mx-auto max-w-sm text-sm text-muted-foreground">{description}</p>}
    </div>
    {action}
  </div>
);

export default EmptyState;
