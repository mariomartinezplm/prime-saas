import { useId } from 'react';
import { MAP_HEIGHT, MAP_WIDTH, zoneLabel, zoneShape, zonesInView, type BodyView, type Shape } from '@/lib/bodyZones';
import { cn } from '@/lib/utils';

interface BodyMapProps {
  view: BodyView;
  onViewChange: (view: BodyView) => void;
  selected?: string | null;
  onSelect: (zoneId: string) => void;
  // Dolor más reciente de cada zona (0–10): colorea y escribe el número dentro de la zona
  levels?: Record<string, number>;
  // Zonas que se pueden elegir (por defecto, todas). Las demás se ven apagadas y no se tocan.
  enabled?: ReadonlySet<string>;
  // Zonas con algún dato (medida, registro…): llevan un punto de aviso
  marked?: ReadonlySet<string>;
  className?: string;
}

const levelFill = (level: number) =>
  level <= 0 ? null : level <= 3 ? 'rgba(98,184,207,0.50)' : level <= 6 ? 'rgba(240,185,90,0.58)' : 'rgba(228,112,100,0.70)';

const ShapeEl = ({ shape, ...rest }: { shape: Shape } & React.SVGProps<SVGElement>) => {
  const props = rest as React.SVGProps<SVGEllipseElement> & React.SVGProps<SVGRectElement>;
  return shape.t === 'e'
    ? <ellipse cx={shape.cx} cy={shape.cy} rx={shape.rx} ry={shape.ry} transform={shape.rot ? `rotate(${shape.rot} ${shape.cx} ${shape.cy})` : undefined} {...props} />
    : <rect x={shape.x} y={shape.y} width={shape.w} height={shape.h} rx={shape.r ?? 0} {...props} />;
};

const center = (shape: Shape) => (shape.t === 'e' ? { x: shape.cx, y: shape.cy } : { x: shape.x + shape.w / 2, y: shape.y + shape.h / 2 });

// Mapa del cuerpo (de frente y de espalda) con zonas que se tocan. Cada zona es un botón: se puede usar con el dedo, el mouse o el
// teclado (Tab y Enter/Espacio), y tiene su nombre para un lector de pantalla. «Derecha/izquierda» es la de la persona.
const BodyMap = ({ view, onViewChange, selected, onSelect, levels, enabled, marked, className }: BodyMapProps) => {
  const title = useId();
  const zones = zonesInView(view);

  return (
    <div className={cn('flex w-full flex-col items-center gap-3', className)}>
      <div role="group" aria-label="Vista del cuerpo" className="grid w-full max-w-[260px] grid-cols-2 rounded-2xl border border-[#fff8e4]/20 bg-[#fff8e4]/[0.04] p-1">
        {(['front', 'back'] as const).map((v) => (
          <button
            key={v}
            type="button"
            aria-pressed={view === v}
            onClick={() => onViewChange(v)}
            className={cn('min-h-[44px] rounded-xl text-[14px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#fff8e4]', view === v ? 'bg-[#398ca2] font-extrabold text-[#181619]' : 'text-[#cdc6b6]')}
          >
            {v === 'front' ? 'Frente' : 'Espalda'}
          </button>
        ))}
      </div>

      <svg viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`} role="group" aria-labelledby={title} className="h-auto w-full max-w-[340px] select-none">
        <title id={title}>{view === 'front' ? 'Mapa del cuerpo, vista de frente' : 'Mapa del cuerpo, vista de espalda'}</title>
        {zones.map((zone) => {
          const shape = zoneShape(zone, view);
          if (!shape) return null;
          const level = levels?.[zone.id] ?? 0;
          const isSelected = selected === zone.id;
          const isEnabled = !enabled || enabled.has(zone.id);
          const fill = isSelected ? 'rgba(57,140,162,0.55)' : levelFill(level) ?? 'rgba(255,248,228,0.07)';
          const c = center(shape);
          const label = `${zone.label}${level > 0 ? `, dolor ${level} de 10` : ''}`;
          return (
            <g
              key={zone.id}
              role="button"
              tabIndex={isEnabled ? 0 : -1}
              aria-label={label}
              aria-pressed={isSelected}
              aria-disabled={!isEnabled}
              onClick={() => isEnabled && onSelect(zone.id)}
              onKeyDown={(e) => {
                if (isEnabled && (e.key === 'Enter' || e.key === ' ')) {
                  e.preventDefault();
                  onSelect(zone.id);
                }
              }}
              className={cn('group outline-none', isEnabled ? 'cursor-pointer' : 'cursor-not-allowed opacity-35')}
            >
              <ShapeEl shape={shape} fill={fill} stroke={isSelected ? '#8fd0e0' : 'rgba(255,248,228,0.32)'} strokeWidth={isSelected ? 2.2 : 1.2} className="transition-colors group-hover:fill-[rgba(57,140,162,0.28)] group-focus-visible:stroke-[#fff8e4] group-focus-visible:stroke-[2.5]" />
              {/* Zona táctil más grande que lo que se ve: las muñecas y los tobillos son chicos para un dedo */}
              <ShapeEl shape={shape} fill="transparent" stroke="transparent" strokeWidth={14} pointerEvents="all" />
              {level > 0 && (
                <text x={c.x} y={c.y + 4} textAnchor="middle" fontSize={11} fontWeight={800} fill="#fff8e4" stroke="#181619" strokeWidth={2.5} paintOrder="stroke" className="pointer-events-none">{level}</text>
              )}
              {marked?.has(zone.id) && level === 0 && <circle cx={c.x} cy={c.y} r={3.2} fill="#8fd0e0" className="pointer-events-none" />}
            </g>
          );
        })}
      </svg>
      <p className="min-h-[1.5rem] text-center text-[14px] font-semibold text-[#fff8e4]" aria-live="polite">{selected ? zoneLabel(selected) : 'Toca una parte del cuerpo'}</p>
    </div>
  );
};

export default BodyMap;
