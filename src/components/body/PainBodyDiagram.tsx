import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface PainBodyDiagramProps {
  selectedZone: string | null;
  onZoneClick: (zone: string) => void;
  painLevels?: Record<string, number>;
  onMapClick?: (x: number, y: number) => void;
  selectedPoint?: { x: number; y: number } | null;
  gender?: 'male' | 'female';
  onGenderChange?: (gender: 'male' | 'female') => void;
  hoverable?: boolean;
}

const PAIN_ZONES = [
  { id: 'cabeza', label: 'Cabeza', cx: 150, cy: 30, r: 15 },
  { id: 'cuello', label: 'Cuello', cx: 150, cy: 60, r: 10 },
  { id: 'columna-cervical', label: 'Cervical', cx: 150, cy: 75, r: 12 },
  { id: 'hombro-izquierdo', label: 'Hombro I', cx: 100, cy: 85, r: 14 },
  { id: 'hombro-derecho', label: 'Hombro D', cx: 200, cy: 85, r: 14 },
  { id: 'brazo-izquierdo', label: 'Brazo I', cx: 82, cy: 135, r: 12 },
  { id: 'brazo-derecho', label: 'Brazo D', cx: 218, cy: 135, r: 12 },
  { id: 'codo-izquierdo', label: 'Codo I', cx: 72, cy: 175, r: 10 },
  { id: 'codo-derecho', label: 'Codo D', cx: 228, cy: 175, r: 10 },
  { id: 'muneca-izquierda', label: 'Muñeca I', cx: 65, cy: 215, r: 8 },
  { id: 'muneca-derecha', label: 'Muñeca D', cx: 235, cy: 215, r: 8 },
  { id: 'mano-izquierda', label: 'Mano I', cx: 62, cy: 240, r: 10 },
  { id: 'mano-derecha', label: 'Mano D', cx: 238, cy: 240, r: 10 },
  { id: 'espalda-alta', label: 'Dorsal', cx: 150, cy: 110, r: 15 },
  { id: 'espalda-media', label: 'Media', cx: 150, cy: 140, r: 15 },
  { id: 'espalda-baja', label: 'Lumbar', cx: 150, cy: 170, r: 15 },
  { id: 'cadera-izquierda', label: 'Cadera I', cx: 115, cy: 210, r: 14 },
  { id: 'cadera-derecha', label: 'Cadera D', cx: 185, cy: 210, r: 14 },
  { id: 'rodilla-izquierda', label: 'Rodilla I', cx: 115, cy: 295, r: 13 },
  { id: 'rodilla-derecha', label: 'Rodilla D', cx: 185, cy: 295, r: 13 },
  { id: 'tobillo-izquierdo', label: 'Tobillo I', cx: 108, cy: 380, r: 10 },
  { id: 'tobillo-derecho', label: 'Tobillo D', cx: 192, cy: 380, r: 10 },
  { id: 'pie-izquierdo', label: 'Pie I', cx: 110, cy: 405, r: 10 },
  { id: 'pie-derecho', label: 'Pie D', cx: 190, cy: 405, r: 10 },
  { id: 'pecho', label: 'Pecho', cx: 150, cy: 125, r: 15 },
  { id: 'abdomen', label: 'Abdomen', cx: 150, cy: 175, r: 15 },
];

const SVG_PATHS = {
  male: "M150,25 C158,25 165,32 165,40 C165,52 158,58 150,58 C142,58 135,52 135,40 C135,32 142,25 150,25 M142,60 L158,60 L166,70 C185,75 205,85 215,100 L220,120 L235,180 L238,220 C238,230 228,230 225,220 L215,170 L210,135 L200,105 L195,120 L185,180 C185,190 180,200 178,210 C175,220 175,230 180,250 L195,310 L192,360 L195,400 L175,410 L165,350 L160,280 C155,250 145,250 140,280 L135,350 L125,410 L105,400 L108,360 L105,310 L120,250 C125,230 125,220 122,210 C120,200 115,190 115,180 L105,120 L100,105 L90,135 L85,170 L75,220 C72,230 62,230 62,220 L65,180 L80,120 L85,100 C95,85 115,75 134,70 Z",
  female: "M150,25 C157,25 163,31 163,38 C163,50 157,55 150,55 C143,55 137,50 137,38 C137,31 143,25 150,25 M144,57 L156,57 L162,65 C175,70 190,75 195,85 L200,105 L215,165 L220,215 C220,225 210,225 208,215 L198,165 L193,125 L183,100 L178,130 L170,180 C170,195 180,220 185,250 L190,310 L185,360 L185,395 L170,405 L160,350 L155,280 C152,250 148,250 145,280 L140,350 L130,405 L115,395 L115,360 L110,310 L115,250 C120,220 130,195 130,180 L122,130 L117,100 L107,125 L102,165 L92,215 C90,225 80,225 80,215 L85,165 L100,105 L105,85 C110,75 125,70 138,65 Z"
};

const getPainColor = (level: number): string => {
  if (level <= 0) return 'transparent';
  if (level <= 2) return 'hsl(120 60% 50% / 0.6)';
  if (level <= 4) return 'hsl(80 60% 50% / 0.7)';
  if (level <= 6) return 'hsl(45 90% 50% / 0.8)';
  if (level <= 8) return 'hsl(20 90% 50% / 0.9)';
  return 'hsl(0 80% 50% / 0.9)';
};

const PainBodyDiagram = ({
  selectedZone,
  onZoneClick,
  painLevels,
  onMapClick,
  selectedPoint,
  gender = 'male',
  onGenderChange,
  hoverable = true
}: PainBodyDiagramProps) => {

  const [internalGender, setInternalGender] = useState<'male' | 'female'>(gender);
  const currentGender = onGenderChange ? gender : internalGender;
  const setGender = onGenderChange || setInternalGender;

  const handleSvgClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!onMapClick) return;

    // Attempt to get relative X Y
    const svg = e.currentTarget;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;

    const ctm = svg.getScreenCTM();
    if (ctm) {
      const svgP = pt.matrixTransform(ctm.inverse());
      // svgP.x and svgP.y are now in viewBox coordinates (0-300, 0-440)
      // Convert to % for storage
      const xPct = (svgP.x / 300) * 100;
      const yPct = (svgP.y / 440) * 100;

      // If we clicked directly on a zone circle, don't place generic point (or handle it depending on use case)
      onMapClick(xPct, yPct);
    }
  };

  return (
    <div className="flex flex-col items-center w-full">
      <div className="flex gap-2 mb-4 bg-muted p-1 rounded-lg">
        <Button
          variant={currentGender === 'male' ? 'default' : 'ghost'}
          size="sm"
          className="text-xs h-7 px-3"
          onClick={(e) => { e.preventDefault(); setGender('male'); }}
        >
          Masculino
        </Button>
        <Button
          variant={currentGender === 'female' ? 'default' : 'ghost'}
          size="sm"
          className="text-xs h-7 px-3"
          onClick={(e) => { e.preventDefault(); setGender('female'); }}
        >
          Femenino
        </Button>
      </div>

      <svg
        viewBox="0 0 300 440"
        className={cn("w-full max-w-[300px]", onMapClick ? "cursor-crosshair" : "")}
        onClick={handleSvgClick}
      >
        {/* Superior silhouette */}
        <path
          d={SVG_PATHS[currentGender]}
          fill="hsl(var(--muted) / 0.5)"
          stroke="hsl(var(--border))"
          strokeWidth="1.5"
          className="transition-all duration-300"
        />

        {/* Existing Pain Zones */}
        {PAIN_ZONES.map((zone) => {
          const isSelected = selectedZone === zone.id;
          const level = painLevels?.[zone.id] || 0;
          const fillColor = level > 0 ? getPainColor(level) : 'transparent';

          return (
            <g
              key={zone.id}
              onClick={(e) => {
                // If mapClick is enabled, keep bubbling up to record exact pos
                if (!onMapClick) e.stopPropagation();
                onZoneClick(zone.id);
              }}
              className={hoverable ? "cursor-pointer" : "pointer-events-none"}
            >
              <circle
                cx={zone.cx}
                cy={zone.cy}
                r={zone.r}
                fill={fillColor}
                stroke={isSelected ? 'hsl(var(--foreground))' : level > 0 ? 'hsl(var(--border))' : 'transparent'}
                strokeWidth={isSelected ? 2 : 1}
                className={cn(
                  "transition-all",
                  hoverable && "hover:stroke-[hsl(var(--foreground))] hover:stroke-[1.5]"
                )}
              />
              {(isSelected || level > 0) && (
                <text
                  x={zone.cx}
                  y={zone.cy + 3}
                  textAnchor="middle"
                  fontSize="7"
                  fill="hsl(var(--foreground))"
                  className="pointer-events-none select-none font-bold"
                >
                  {level > 0 ? level : ''}
                </text>
              )}
            </g>
          );
        })}

        {/* Newly selected point (arbitrary location) */}
        {selectedPoint && (
          <g>
            <circle
              cx={(selectedPoint.x / 100) * 300}
              cy={(selectedPoint.y / 100) * 440}
              r={6}
              fill="hsl(0 80% 50% / 0.9)"
              stroke="white"
              strokeWidth={2}
              className="animate-pulse"
            />
          </g>
        )}
      </svg>

      {/* Pain scale legend */}
      <div className="flex items-center gap-1 mt-4">
        <span className="text-xs text-muted-foreground mr-2">Dolor:</span>
        {[0, 2, 4, 6, 8, 10].map((level) => (
          <div key={level} className="flex items-center gap-0.5">
            <div
              className="w-4 h-4 rounded-sm border border-border"
              style={{ backgroundColor: level === 0 ? 'transparent' : getPainColor(level) }}
            />
            <span className="text-[10px] text-muted-foreground">{level}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PainBodyDiagram;
