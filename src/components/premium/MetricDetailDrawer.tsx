import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import TrendChart from './TrendChart';
import { formatValue, longDate, sortPoints, summarize, type TrendPoint } from '@/lib/trend';

interface MetricDetailDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  label: string;
  unit: string;
  decimals?: number;
  points: TrendPoint[];
}

// Detalle de una medida: cifra actual, cambio escrito, gráfico por fecha real y la lista de registros (la más reciente primero).
const MetricDetailDrawer = ({ open, onOpenChange, label, unit, decimals = 1, points }: MetricDetailDrawerProps) => {
  const s = summarize(points, unit, decimals);
  const rows = sortPoints(points).reverse();
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[88vh] border-[#fff8e4]/15 bg-[#181619] text-[#fff8e4]">
        <div className="mx-auto w-full max-w-lg overflow-y-auto px-4 pb-8">
          <DrawerHeader className="px-0 text-left">
            <DrawerTitle className="text-xl font-bold tracking-tight">{label}</DrawerTitle>
            <DrawerDescription className="text-[#fff8e4]/70">
              {s ? (s.count > 1 ? `${s.count} registros · ${s.changeText} ${s.sinceText}` : 'Un registro: con el siguiente verás tu tendencia.') : 'Sin registros.'}
            </DrawerDescription>
          </DrawerHeader>
          {s && (
            <>
              <p className="text-5xl font-extrabold leading-none tracking-tight tabular-nums">
                {formatValue(s.last.value, decimals)}
                {unit && <span className="ml-1.5 text-xl font-bold text-[#fff8e4]/65">{unit}</span>}
              </p>
              <p className="mt-1.5 text-sm text-[#fff8e4]/70">Último registro · {longDate(s.last.date)}</p>
              {s.count > 1 && <div className="mt-4"><TrendChart points={points} unit={unit} decimals={decimals} label={label} /></div>}
              <h3 className="mb-1 mt-5 text-sm font-semibold text-[#fff8e4]/75">Historial</h3>
              <ul className="divide-y divide-[#fff8e4]/10">
                {rows.map((r) => (
                  <li key={r.date} className="flex items-center justify-between py-3">
                    <span className="text-[15px] text-[#fff8e4]/80">{longDate(r.date)}</span>
                    <span className="font-bold tabular-nums">{formatValue(r.value, decimals)}{unit ? ` ${unit}` : ''}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
};

export default MetricDetailDrawer;
