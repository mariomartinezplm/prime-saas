import type { ReactNode } from 'react';

export const DetailList = ({ children }: { children: ReactNode }) => (
  <dl className="divide-y divide-border text-sm">{children}</dl>
);

// Fila etiqueta / valor: el valor vacío se muestra como "-".
export const DetailRow = ({ label, children }: { label: string; children?: ReactNode }) => (
  <div className="flex items-start justify-between gap-4 py-2 first:pt-0 last:pb-0">
    <dt className="shrink-0 text-muted-foreground">{label}</dt>
    <dd className="min-w-0 break-words text-right">{children || '-'}</dd>
  </div>
);
