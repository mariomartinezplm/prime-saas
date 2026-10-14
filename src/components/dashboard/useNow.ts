import { useEffect, useState } from 'react';

// La hora actual, refrescada cada minuto: así «empieza en 40 min» y el paso de «próxima» a «en curso» se mantienen al día
export const useNow = (intervalMs = 60_000): Date => {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
};
