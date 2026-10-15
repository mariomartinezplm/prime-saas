import { Skeleton } from '@/components/ui/skeleton';
import { useSlowLoading } from '@/hooks/useSlowLoading';
import { cn } from '@/lib/utils';

// Alturas mínimas de los bloques mientras esperan sus datos. Se midieron en el caso más habitual (plan vigente y dos tareas en «Para hoy»)
// en móvil (375 px) y en escritorio, para que al llegar los datos el resto de la pantalla casi no se mueva. Son aproximadas: la altura
// final depende del contenido (p. ej. «Para hoy» tiene entre 0 y 3 filas).
export const RESERVED = {
  today: 'min-h-[25rem] sm:min-h-[14rem]',
  readiness: 'min-h-[15.25rem] sm:min-h-[11.5rem]',
  card: 'min-h-[16.5rem] md:min-h-[17.5rem]',
  progress: 'min-h-[15rem] sm:min-h-[13.25rem]',
} as const;

// Esqueleto de un bloque: anuncia UNA vez qué se está cargando (los bloques grises son decorativos), no se enfoca con el teclado,
// se queda quieto con «menos movimiento» y, si tarda, lo dice en lugar de dejar una pantalla muda.
export const SkeletonBones = ({ label, className, lines = [60, 100, 40] }: { label: string; className?: string; lines?: number[] }) => {
  const slow = useSlowLoading();
  return (
    <div role="status" aria-label={label} className={cn('space-y-3', className)}>
      {lines.map((width, i) => (
        <Skeleton
          key={i}
          aria-hidden="true"
          className={cn('bg-[#fff8e4]/10 motion-reduce:animate-none', i === 1 ? 'h-14' : 'h-4')}
          style={{ width: `${width}%`, maxWidth: i === 1 ? undefined : '16rem' }}
        />
      ))}
      {slow && <p className="text-xs text-[#fff8e4]/60">Está tardando más de lo normal. Seguimos intentando.</p>}
    </div>
  );
};
