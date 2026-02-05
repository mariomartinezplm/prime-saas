interface PainBodyDiagramProps {
  selectedZone: string | null;
  onZoneClick: (zone: string) => void;
  painLevels?: Record<string, number>;
}

const PAIN_ZONES = [
  { id: 'cabeza', label: 'Cabeza', cx: 150, cy: 40, r: 20 },
  { id: 'cuello', label: 'Cuello', cx: 150, cy: 75, r: 10 },
  { id: 'columna-cervical', label: 'C. Cervical', cx: 150, cy: 90, r: 12 },
  { id: 'hombro-izquierdo', label: 'Hombro I', cx: 100, cy: 100, r: 14 },
  { id: 'hombro-derecho', label: 'Hombro D', cx: 200, cy: 100, r: 14 },
  { id: 'brazo-izquierdo', label: 'Brazo I', cx: 82, cy: 145, r: 12 },
  { id: 'brazo-derecho', label: 'Brazo D', cx: 218, cy: 145, r: 12 },
  { id: 'codo-izquierdo', label: 'Codo I', cx: 78, cy: 175, r: 10 },
  { id: 'codo-derecho', label: 'Codo D', cx: 222, cy: 175, r: 10 },
  { id: 'muneca-izquierda', label: 'Muñeca I', cx: 68, cy: 215, r: 8 },
  { id: 'muneca-derecha', label: 'Muñeca D', cx: 232, cy: 215, r: 8 },
  { id: 'mano-izquierda', label: 'Mano I', cx: 60, cy: 240, r: 10 },
  { id: 'mano-derecha', label: 'Mano D', cx: 240, cy: 240, r: 10 },
  { id: 'columna-dorsal', label: 'C. Dorsal', cx: 150, cy: 135, r: 15 },
  { id: 'columna-lumbar', label: 'C. Lumbar', cx: 150, cy: 185, r: 15 },
  { id: 'cadera-izquierda', label: 'Cadera I', cx: 120, cy: 220, r: 14 },
  { id: 'cadera-derecha', label: 'Cadera D', cx: 180, cy: 220, r: 14 },
  { id: 'rodilla-izquierda', label: 'Rodilla I', cx: 125, cy: 305, r: 13 },
  { id: 'rodilla-derecha', label: 'Rodilla D', cx: 175, cy: 305, r: 13 },
  { id: 'tobillo-izquierdo', label: 'Tobillo I', cx: 118, cy: 390, r: 10 },
  { id: 'tobillo-derecho', label: 'Tobillo D', cx: 182, cy: 390, r: 10 },
  { id: 'pie-izquierdo', label: 'Pie I', cx: 115, cy: 415, r: 10 },
  { id: 'pie-derecho', label: 'Pie D', cx: 185, cy: 415, r: 10 },
];

const getPainColor = (level: number): string => {
  if (level <= 0) return 'transparent';
  if (level <= 2) return 'hsl(120 60% 50% / 0.4)';
  if (level <= 4) return 'hsl(80 60% 50% / 0.5)';
  if (level <= 6) return 'hsl(45 90% 50% / 0.6)';
  if (level <= 8) return 'hsl(20 90% 50% / 0.7)';
  return 'hsl(0 80% 50% / 0.8)';
};

const PainBodyDiagram = ({ selectedZone, onZoneClick, painLevels }: PainBodyDiagramProps) => {
  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 300 440" className="w-full max-w-[300px]">
        {/* Body silhouette */}
        <ellipse cx="150" cy="40" rx="22" ry="28" fill="hsl(var(--muted))" stroke="hsl(var(--border))" strokeWidth="1" />
        <rect x="142" y="65" width="16" height="15" fill="hsl(var(--muted))" />
        <path d="M105 80 L95 105 L88 160 L80 220 L72 245 L60 240 L55 250 L70 255 L80 225 L90 175 L95 130 L100 100"
          fill="none" stroke="hsl(var(--border))" strokeWidth="7" strokeLinecap="round" opacity="0.4" />
        <path d="M195 80 L205 105 L212 160 L220 220 L228 245 L240 240 L245 250 L230 255 L220 225 L210 175 L205 130 L200 100"
          fill="none" stroke="hsl(var(--border))" strokeWidth="7" strokeLinecap="round" opacity="0.4" />
        <path d="M105 80 L100 110 L95 170 L100 210 L110 235 L130 245 L150 250 L170 245 L190 235 L200 210 L205 170 L200 110 L195 80 Z"
          fill="hsl(var(--muted))" stroke="hsl(var(--border))" strokeWidth="1" />
        <path d="M115 245 L112 290 L110 330 L108 380 L105 420 L125 425 L128 385 L130 330 L132 290 L135 250"
          fill="none" stroke="hsl(var(--border))" strokeWidth="9" strokeLinecap="round" opacity="0.4" />
        <path d="M185 245 L188 290 L190 330 L192 380 L195 420 L175 425 L172 385 L170 330 L168 290 L165 250"
          fill="none" stroke="hsl(var(--border))" strokeWidth="9" strokeLinecap="round" opacity="0.4" />

        {/* Pain zones */}
        {PAIN_ZONES.map((zone) => {
          const isSelected = selectedZone === zone.id;
          const level = painLevels?.[zone.id] || 0;
          const fillColor = level > 0 ? getPainColor(level) : 'transparent';

          return (
            <g key={zone.id} onClick={() => onZoneClick(zone.id)} className="cursor-pointer">
              <circle
                cx={zone.cx}
                cy={zone.cy}
                r={zone.r}
                fill={fillColor}
                stroke={isSelected ? 'hsl(var(--foreground))' : level > 0 ? 'hsl(var(--border))' : 'transparent'}
                strokeWidth={isSelected ? 2 : 1}
                className="transition-all hover:stroke-[hsl(var(--foreground))] hover:stroke-[1.5]"
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
