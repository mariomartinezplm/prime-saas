import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { HERO_SURFACE } from '@/components/dashboard/brand';

interface EmptyGuideProps {
  icon: LucideIcon;
  title: string;
  description: ReactNode;
  // Acción real y permitida (botón o enlace). Si no hay ninguna que corresponda, no se inventa una.
  action?: ReactNode;
  // «Qué verás aquí»: filas informativas, sin promesas de funciones que no existen
  preview?: { icon: LucideIcon; title: string; text: string }[];
  className?: string;
}

// Estado vacío útil: explica qué es la pantalla, quién registra los datos y qué hacer. Nunca cifras en cero ni un rectángulo vacío.
const EmptyGuide = ({ icon: Icon, title, description, action, preview, className }: EmptyGuideProps) => (
  <div className={cn('space-y-4', className)}>
    <section className={cn('rounded-[22px] border p-5 text-center', HERO_SURFACE)}>
      <span aria-hidden="true" className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-[#398ca2]/45 bg-[#398ca2]/15 text-[#7cc0d2]">
        <Icon className="h-7 w-7" />
      </span>
      <h2 className="mx-auto mt-4 max-w-[22ch] text-xl font-bold leading-snug tracking-tight text-[#fff8e4]">{title}</h2>
      <p className="mx-auto mt-2 max-w-[34ch] text-sm leading-relaxed text-[#fff8e4]/75">{description}</p>
      {action && <div className="mt-5 flex justify-center [&>*]:w-full sm:[&>*]:w-auto">{action}</div>}
    </section>
    {preview && preview.length > 0 && (
      <section aria-label="Qué verás aquí" className="space-y-2">
        <h3 className="px-1 text-sm font-semibold text-[#fff8e4]/75">Qué verás aquí</h3>
        {preview.map(({ icon: PIcon, title: t, text }) => (
          <div key={t} className="flex items-center gap-3 rounded-2xl border border-[#fff8e4]/10 bg-[#fff8e4]/[0.03] px-4 py-3">
            <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#398ca2]/15 text-[#7cc0d2]">
              <PIcon className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-[15px] font-semibold text-[#fff8e4]">{t}</p>
              <p className="text-[13px] text-[#fff8e4]/70">{text}</p>
            </div>
          </div>
        ))}
      </section>
    )}
  </div>
);

export default EmptyGuide;
