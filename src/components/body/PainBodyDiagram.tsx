import { useEffect, useState } from 'react';
import BodyMap from '@/components/body/BodyMap';
import { viewOfZone, type BodyView } from '@/lib/bodyZones';

interface PainBodyDiagramProps {
  selectedZone: string | null;
  onZoneClick: (zone: string) => void;
  painLevels?: Record<string, number>;
}

// Mapa de dolor: el mismo mapa del cuerpo (frente y espalda) con el último dolor de cada zona. Al elegir una zona desde una lista,
// el mapa se da vuelta solo si esa zona está del otro lado.
const PainBodyDiagram = ({ selectedZone, onZoneClick, painLevels }: PainBodyDiagramProps) => {
  const [view, setView] = useState<BodyView>('front');
  useEffect(() => {
    if (selectedZone) setView((current) => viewOfZone(selectedZone, current));
  }, [selectedZone]);

  return <BodyMap view={view} onViewChange={setView} selected={selectedZone} onSelect={onZoneClick} levels={painLevels} />;
};

export default PainBodyDiagram;
