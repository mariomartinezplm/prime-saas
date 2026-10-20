import type { ReactNode } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

export interface SegmentedItem {
  value: string;
  label: string;
}

interface SegmentedTabsProps {
  items: SegmentedItem[];
  value: string;
  onValueChange: (value: string) => void;
  // Contenido por pestaña, en el mismo orden de `items`
  children: ReactNode[];
  ariaLabel: string;
  className?: string;
}

// Pestañas tipo «segmentado»: ocupan todo el ancho (sin barra con scroll horizontal), alto táctil de 44 px, seleccionada con fondo elevado.
const SegmentedTabs = ({ items, value, onValueChange, children, ariaLabel, className }: SegmentedTabsProps) => (
  <Tabs value={value} onValueChange={onValueChange} className={cn('w-full', className)}>
    <TabsList aria-label={ariaLabel} className="grid h-auto w-full auto-cols-fr grid-flow-col gap-1 rounded-2xl border border-[#fff8e4]/10 bg-[#fff8e4]/[0.04] p-1">
      {items.map((item) => (
        <TabsTrigger
          key={item.value}
          value={item.value}
          className="min-h-[44px] rounded-xl px-2 text-sm font-semibold text-[#fff8e4]/70 data-[state=active]:bg-[#28262b] data-[state=active]:text-[#fff8e4] data-[state=active]:shadow-[inset_0_0_0_1px_rgba(255,248,228,0.16)]"
        >
          {item.label}
        </TabsTrigger>
      ))}
    </TabsList>
    {items.map((item, i) => (
      <TabsContent key={item.value} value={item.value} className="mt-4 space-y-4 focus-visible:outline-none">
        {children[i]}
      </TabsContent>
    ))}
  </Tabs>
);

export default SegmentedTabs;
