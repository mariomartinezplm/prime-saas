import type { ReactNode } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

interface BottomSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}

// Hoja inferior oscura para elegir o editar sin salir de la pantalla (en escritorio queda centrada). Cierra con Escape y mantiene el foco.
const BottomSheet = ({ open, onOpenChange, title, description, children, className }: BottomSheetProps) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent
      className={cn(
        'bottom-0 top-auto flex max-h-[92dvh] translate-y-0 flex-col gap-0 rounded-b-none rounded-t-[28px] border-[#fff8e4]/12 bg-[#1f1c21] p-0 text-[#fff8e4] data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom sm:bottom-auto sm:top-[50%] sm:max-w-md sm:translate-y-[-50%] sm:rounded-[28px] [&>button]:text-[#cdc6b6]',
        className
      )}
    >
      <div className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-[#fff8e4]/20" aria-hidden="true" />
      <div className="shrink-0 px-5 pb-2 pt-3">
        <DialogTitle className="text-lg font-extrabold tracking-tight text-[#fff8e4]">{title}</DialogTitle>
        {description ? <DialogDescription className="mt-0.5 text-[13px] text-[#a8a295]">{description}</DialogDescription> : <DialogDescription className="sr-only">{title}</DialogDescription>}
      </div>
      <div className="overflow-y-auto px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">{children}</div>
    </DialogContent>
  </Dialog>
);

export default BottomSheet;
