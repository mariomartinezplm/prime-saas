import type { KeyboardEvent, ReactNode } from 'react';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';

export interface Column<T> {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  align?: 'left' | 'center' | 'right';
  // En móvil esta columna es el título de la tarjeta (por defecto, la primera)
  primary?: boolean;
  // En móvil no se muestra
  hideOnMobile?: boolean;
}

interface DataTableProps<T> {
  // Describe la tabla para lectores de pantalla ("Mediciones registradas")
  caption: string;
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  // Botones por fila (editar, eliminar...)
  actions?: (row: T) => ReactNode;
  // Hace clicable la fila (también con teclado)
  onRowClick?: (row: T) => void;
  className?: string;
}

const alignClass = { left: 'text-left', center: 'text-center', right: 'text-right' } as const;

// Tabla en pantallas medianas y grandes; en móvil, una tarjeta por fila (una tabla de 8 columnas
// no cabe en 375 px y obligaba a deslizar hacia el lado).
function DataTable<T>({ caption, columns, rows, rowKey, actions, onRowClick, className }: DataTableProps<T>) {
  const primary = columns.find((c) => c.primary) ?? columns[0];
  const secondary = columns.filter((c) => c !== primary && !c.hideOnMobile);

  const onKeyDown = (event: KeyboardEvent, row: T) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onRowClick?.(row);
    }
  };

  return (
    <>
      <div className={cn('hidden md:block', className)}>
        <Table>
          <TableCaption className="sr-only">{caption}</TableCaption>
          <TableHeader>
            <TableRow>
              {columns.map((c) => (
                <TableHead key={c.key} className={alignClass[c.align ?? 'left']}>
                  {c.header}
                </TableHead>
              ))}
              {actions && (
                <TableHead className="w-24">
                  <span className="sr-only">Acciones</span>
                </TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow
                key={rowKey(row)}
                {...(onRowClick
                  ? { tabIndex: 0, onClick: () => onRowClick(row), onKeyDown: (e: KeyboardEvent) => onKeyDown(e, row) }
                  : {})}
                className={cn(onRowClick && 'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring')}
              >
                {columns.map((c) => (
                  <TableCell key={c.key} className={alignClass[c.align ?? 'left']}>
                    {c.cell(row)}
                  </TableCell>
                ))}
                {actions && (
                  <TableCell onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                    {actions(row)}
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ul className={cn('space-y-2 md:hidden', className)} aria-label={caption}>
        {rows.map((row) => (
          <li key={rowKey(row)} className="rounded-lg border border-border bg-card p-3">
            <div className="flex items-start justify-between gap-2">
              {onRowClick ? (
                <button
                  type="button"
                  onClick={() => onRowClick(row)}
                  className="rounded text-left font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {primary.cell(row)}
                </button>
              ) : (
                <div className="font-medium">{primary.cell(row)}</div>
              )}
              {actions && <div className="shrink-0">{actions(row)}</div>}
            </div>
            {secondary.length > 0 && (
              <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                {secondary.map((c) => (
                  <div key={c.key}>
                    <dt className="text-xs text-muted-foreground">{c.header}</dt>
                    <dd>{c.cell(row)}</dd>
                  </div>
                ))}
              </dl>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}

export default DataTable;
