import { cn } from '@/lib/utils';

interface BodyDiagramProps {
  selectedZone: string | null;
  onZoneClick: (zone: string) => void;
  zoneValues?: Record<string, number>;
}

const ZONES = [
  { id: 'chest', label: 'Pecho', cx: 150, cy: 130, rx: 35, ry: 20 },
  { id: 'bicepLeft', label: 'Bícep Izq', cx: 85, cy: 155, rx: 12, ry: 25 },
  { id: 'bicepRight', label: 'Bícep Der', cx: 215, cy: 155, rx: 12, ry: 25 },
  { id: 'forearmLeft', label: 'Antebrazo Izq', cx: 75, cy: 210, rx: 10, ry: 22 },
  { id: 'forearmRight', label: 'Antebrazo Der', cx: 225, cy: 210, rx: 10, ry: 22 },
  { id: 'waist', label: 'Cintura', cx: 150, cy: 185, rx: 30, ry: 15 },
  { id: 'hips', label: 'Cadera', cx: 150, cy: 215, rx: 35, ry: 15 },
  { id: 'thighLeft', label: 'Muslo Izq', cx: 125, cy: 275, rx: 18, ry: 35 },
  { id: 'thighRight', label: 'Muslo Der', cx: 175, cy: 275, rx: 18, ry: 35 },
  { id: 'calfLeft', label: 'Pantorrilla Izq', cx: 120, cy: 360, rx: 13, ry: 30 },
  { id: 'calfRight', label: 'Pantorrilla Der', cx: 180, cy: 360, rx: 13, ry: 30 },
];

const BodyDiagram = ({ selectedZone, onZoneClick, zoneValues }: BodyDiagramProps) => {
  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 300 430" className="w-full max-w-[300px]">
        {/* Body outline */}
        {/* Head */}
        <ellipse cx="150" cy="45" rx="25" ry="30" fill="hsl(var(--muted))" stroke="hsl(var(--border))" strokeWidth="1.5" />
        {/* Neck */}
        <rect x="140" y="72" width="20" height="15" fill="hsl(var(--muted))" stroke="hsl(var(--border))" strokeWidth="1" />
        {/* Torso */}
        <path d="M100 87 L95 110 L90 180 L100 230 L120 240 L150 245 L180 240 L200 230 L210 180 L205 110 L200 87 Z"
          fill="hsl(var(--muted))" stroke="hsl(var(--border))" strokeWidth="1.5" />
        {/* Left arm */}
        <path d="M100 87 L80 120 L70 175 L60 235 L70 240 L80 190 L90 140 L100 100"
          fill="none" stroke="hsl(var(--border))" strokeWidth="8" strokeLinecap="round" opacity="0.5" />
        {/* Right arm */}
        <path d="M200 87 L220 120 L230 175 L240 235 L230 240 L220 190 L210 140 L200 100"
          fill="none" stroke="hsl(var(--border))" strokeWidth="8" strokeLinecap="round" opacity="0.5" />
        {/* Left leg */}
        <path d="M120 240 L115 300 L110 360 L108 410 L125 412 L130 360 L135 300 L140 245"
          fill="none" stroke="hsl(var(--border))" strokeWidth="10" strokeLinecap="round" opacity="0.5" />
        {/* Right leg */}
        <path d="M180 240 L185 300 L190 360 L192 410 L175 412 L170 360 L165 300 L160 245"
          fill="none" stroke="hsl(var(--border))" strokeWidth="10" strokeLinecap="round" opacity="0.5" />

        {/* Clickable zones */}
        {ZONES.map((zone) => {
          const isSelected = selectedZone === zone.id;
          const value = zoneValues?.[zone.id];
          const hasValue = value !== undefined && value > 0;

          return (
            <g key={zone.id} onClick={() => onZoneClick(zone.id)} className="cursor-pointer">
              <ellipse
                cx={zone.cx}
                cy={zone.cy}
                rx={zone.rx}
                ry={zone.ry}
                fill={isSelected ? 'hsl(194 45% 44% / 0.5)' : hasValue ? 'hsl(194 45% 44% / 0.25)' : 'transparent'}
                stroke={isSelected ? 'hsl(194 45% 44%)' : 'hsl(var(--border))'}
                strokeWidth={isSelected ? 2 : 1}
                strokeDasharray={isSelected ? 'none' : '3 3'}
                className="transition-all hover:fill-[hsl(194_45%_44%_/_0.3)]"
              />
              <text
                x={zone.cx}
                y={zone.cy + 4}
                textAnchor="middle"
                fontSize="8"
                fill="hsl(var(--muted-foreground))"
                className="pointer-events-none select-none"
              >
                {zone.label}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Legend */}
      <div className="flex gap-4 mt-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded border border-border border-dashed" />
          <span>Sin datos</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-secondary/25" />
          <span>Con datos</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-secondary/50 border border-secondary" />
          <span>Seleccionado</span>
        </div>
      </div>
    </div>
  );
};

export default BodyDiagram;
