import type { ReactNode } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { useSlowLoading } from '@/hooks/useSlowLoading';
import { SLOW_LOADING_MESSAGE } from '@/components/shared/LoadingState';
import { cn } from '@/lib/utils';

// Esqueletos: la silueta gris de la pantalla mientras carga. Se ven más rápidos que un círculo girando
// y evitan que el contenido salte cuando llega. Se quedan quietos si el sistema pide menos movimiento.

const Bone = ({ className }: { className?: string }) => (
  <Skeleton className={cn('bg-accent motion-reduce:animate-none', className)} aria-hidden="true" />
);

// Envoltorio accesible: un lector de pantalla oye `label` una vez (no cada bloque gris) y, si tarda,
// el aviso de lentitud.
export const SkeletonRegion = ({ label, children, className }: { label: string; children: ReactNode; className?: string }) => {
  const slow = useSlowLoading();
  return (
    <div role="status" aria-live="polite" aria-busy="true" className={className}>
      <span className="sr-only">{label}</span>
      {children}
      {slow && <p className="mt-4 text-center text-xs text-muted-foreground">{SLOW_LOADING_MESSAGE}</p>}
    </div>
  );
};

// Título y subtítulo de una página
export const HeaderSkeleton = () => (
  <div className="space-y-2" aria-hidden="true">
    <Bone className="h-8 w-56 max-w-full" />
    <Bone className="h-4 w-72 max-w-full" />
  </div>
);

// Fila de tarjetas con una cifra (paneles, ficha)
export const StatsSkeleton = ({ count = 4 }: { count?: number }) => (
  <div className="grid grid-cols-2 gap-4 lg:grid-cols-4" aria-hidden="true">
    {Array.from({ length: count }, (_, i) => (
      <div key={i} className="space-y-3 rounded-lg border border-border bg-card p-4">
        <Bone className="h-4 w-20" />
        <Bone className="h-7 w-16" />
      </div>
    ))}
  </div>
);

// Lista de filas con avatar (pacientes, planes, citas)
export const ListSkeleton = ({ rows = 6 }: { rows?: number }) => (
  <ul className="space-y-3" aria-hidden="true">
    {Array.from({ length: rows }, (_, i) => (
      <li key={i} className="flex items-center gap-3 rounded-lg border border-border bg-card p-4">
        <Bone className="h-10 w-10 shrink-0 rounded-full" />
        <div className="min-w-0 flex-1 space-y-2">
          <Bone className="h-4 w-40 max-w-full" />
          <Bone className="h-3 w-64 max-w-full" />
        </div>
        <Bone className="hidden h-6 w-16 rounded-full sm:block" />
      </li>
    ))}
  </ul>
);

// Tarjetas con título y cuerpo (gráficos, secciones)
export const CardsSkeleton = ({ count = 2, bodyHeight = 'h-40' }: { count?: number; bodyHeight?: string }) => (
  <div className="grid gap-4 md:grid-cols-2" aria-hidden="true">
    {Array.from({ length: count }, (_, i) => (
      <div key={i} className="space-y-4 rounded-lg border border-border bg-card p-5">
        <Bone className="h-5 w-36" />
        <Bone className={cn('w-full', bodyHeight)} />
      </div>
    ))}
  </div>
);

// Un bloque grande (calendario, editor de horario)
export const BlockSkeleton = ({ className = 'h-[420px]' }: { className?: string }) => (
  <Bone className={cn('w-full rounded-lg', className)} />
);

// Página completa: encabezado + lo que se le pase
export const PageSkeleton = ({ label, children }: { label: string; children: ReactNode }) => (
  <SkeletonRegion label={label} className="space-y-6">
    <HeaderSkeleton />
    {children}
  </SkeletonRegion>
);
