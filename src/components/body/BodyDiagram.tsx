import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface BodyDiagramProps {
  selectedZone: string | null;
  onZoneClick: (zone: string) => void;
  zoneValues?: Record<string, number>;
  gender?: 'male' | 'female';
  onGenderChange?: (gender: 'male' | 'female') => void;
}

const ZONES = [
  { id: 'chest', label: 'Pecho', cx: 150, cy: 110, rx: 35, ry: 20 },
  { id: 'bicepLeft', label: 'Bícep I', cx: 85, cy: 145, rx: 12, ry: 25 },
  { id: 'bicepRight', label: 'Bícep D', cx: 215, cy: 145, rx: 12, ry: 25 },
  { id: 'forearmLeft', label: 'Antebrazo I', cx: 70, cy: 210, rx: 10, ry: 22 },
  { id: 'forearmRight', label: 'Antebrazo D', cx: 230, cy: 210, rx: 10, ry: 22 },
  { id: 'waist', label: 'Cintura', cx: 150, cy: 165, rx: 30, ry: 15 },
  { id: 'hips', label: 'Cadera', cx: 150, cy: 205, rx: 35, ry: 15 },
  { id: 'thighLeft', label: 'Muslo I', cx: 125, cy: 265, rx: 18, ry: 35 },
  { id: 'thighRight', label: 'Muslo D', cx: 175, cy: 265, rx: 18, ry: 35 },
  { id: 'calfLeft', label: 'Pantorrilla I', cx: 120, cy: 350, rx: 13, ry: 30 },
  { id: 'calfRight', label: 'Pantorrilla D', cx: 180, cy: 350, rx: 13, ry: 30 },
];

const SVG_PATHS = {
  male: "M150,25 C158,25 165,32 165,40 C165,52 158,58 150,58 C142,58 135,52 135,40 C135,32 142,25 150,25 M142,60 L158,60 L166,70 C185,75 205,85 215,100 L220,120 L235,180 L238,220 C238,230 228,230 225,220 L215,170 L210,135 L200,105 L195,120 L185,180 C185,190 180,200 178,210 C175,220 175,230 180,250 L195,310 L192,360 L195,400 L175,410 L165,350 L160,280 C155,250 145,250 140,280 L135,350 L125,410 L105,400 L108,360 L105,310 L120,250 C125,230 125,220 122,210 C120,200 115,190 115,180 L105,120 L100,105 L90,135 L85,170 L75,220 C72,230 62,230 62,220 L65,180 L80,120 L85,100 C95,85 115,75 134,70 Z",
  female: "M150,25 C157,25 163,31 163,38 C163,50 157,55 150,55 C143,55 137,50 137,38 C137,31 143,25 150,25 M144,57 L156,57 L162,65 C175,70 190,75 195,85 L200,105 L215,165 L220,215 C220,225 210,225 208,215 L198,165 L193,125 L183,100 L178,130 L170,180 C170,195 180,220 185,250 L190,310 L185,360 L185,395 L170,405 L160,350 L155,280 C152,250 148,250 145,280 L140,350 L130,405 L115,395 L115,360 L110,310 L115,250 C120,220 130,195 130,180 L122,130 L117,100 L107,125 L102,165 L92,215 C90,225 80,225 80,215 L85,165 L100,105 L105,85 C110,75 125,70 138,65 Z"
};

const BodyDiagram = ({ selectedZone, onZoneClick, zoneValues, gender = 'male', onGenderChange }: BodyDiagramProps) => {
  const [internalGender, setInternalGender] = useState<'male' | 'female'>(gender);

  const currentGender = onGenderChange ? gender : internalGender;
  const setGender = onGenderChange || setInternalGender;

  return (
    <div className="flex flex-col items-center w-full">
      <div className="flex gap-2 mb-4 bg-muted p-1 rounded-lg">
        <Button
          variant={currentGender === 'male' ? 'default' : 'ghost'}
          size="sm"
          className="text-xs h-7 px-3"
          onClick={() => setGender('male')}
        >
          Masculino
        </Button>
        <Button
          variant={currentGender === 'female' ? 'default' : 'ghost'}
          size="sm"
          className="text-xs h-7 px-3"
          onClick={() => setGender('female')}
        >
          Femenino
        </Button>
      </div>

      <svg viewBox="0 0 300 430" className="w-full max-w-[300px]">
        {/* Superior silhouette */}
        <path
          d={SVG_PATHS[currentGender]}
          fill="hsl(var(--muted))"
          stroke="hsl(var(--border))"
          strokeWidth="1.5"
          className="transition-all duration-300"
        />

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
                fill="hsl(var(--foreground))"
                className="pointer-events-none select-none font-medium"
              >
                {zone.label}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Legend */}
      <div className="flex flex-wrap justify-center gap-4 mt-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded border border-border border-dashed" />
          <span>Sin datos</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-primary/25" />
          <span>Con datos</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-primary/50 border border-primary" />
          <span>Seleccionado</span>
        </div>
      </div>
    </div>
  );
};

export default BodyDiagram;
