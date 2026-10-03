import { useEffect, useMemo, useState } from 'react';
import { differenceInCalendarDays, format, parseISO } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { ArrowLeftRight, Lock } from 'lucide-react';
import { POSITIONS, POSITION_LABELS } from './photoLabels';
import type { PhotoPosition, ProgressPhoto } from '@/types';

interface PhotoCompareProps {
  photos: ProgressPhoto[];
  onImageError: () => void;
}

const dayLabel = (photo: ProgressPhoto) => format(parseISO(photo.takenAt), 'dd/MM/yyyy');
const optionLabel = (photo: ProgressPhoto) => `${dayLabel(photo)} · ${POSITION_LABELS[photo.position]}`;

// Compara por defecto la posición de la foto más reciente, siempre que tenga al
// menos dos: comparar un frente contra una espalda no dice nada.
const defaultPosition = (photos: ProgressPhoto[]): PhotoPosition | 'all' => {
  const newestFirst = [...photos].sort((a, b) => parseISO(b.takenAt).getTime() - parseISO(a.takenAt).getTime());
  const match = newestFirst.find((p) => photos.filter((o) => o.position === p.position).length >= 2);
  return match ? match.position : 'all';
};

const PhotoCompare = ({ photos, onImageError }: PhotoCompareProps) => {
  const [position, setPosition] = useState<PhotoPosition | 'all'>(() => defaultPosition(photos));
  const [beforeId, setBeforeId] = useState('');
  const [afterId, setAfterId] = useState('');

  // Más antigua primero: es el orden natural de "antes → después"
  const candidates = useMemo(
    () => photos
      .filter((p) => position === 'all' || p.position === position)
      .sort((a, b) => parseISO(a.takenAt).getTime() - parseISO(b.takenAt).getTime()),
    [photos, position]
  );

  // Por defecto se compara la primera foto contra la última. Si las que ya estaban
  // elegidas siguen disponibles (por ejemplo tras recargar las URLs), se respetan.
  useEffect(() => {
    const stillValid = candidates.some((p) => p.id === beforeId) && candidates.some((p) => p.id === afterId);
    if (stillValid) return;
    if (candidates.length >= 2) {
      setBeforeId(candidates[0].id);
      setAfterId(candidates[candidates.length - 1].id);
    } else {
      setBeforeId('');
      setAfterId('');
    }
  }, [candidates, beforeId, afterId]);

  const before = candidates.find((p) => p.id === beforeId);
  const after = candidates.find((p) => p.id === afterId);

  const usedPositions = POSITIONS.filter((p) => photos.some((photo) => photo.position === p));

  const renderPanel = (title: string, photo?: ProgressPhoto) => (
    <div className="space-y-2">
      <p className="text-sm font-medium text-center">{title}</p>
      <div className="aspect-[3/4] overflow-hidden rounded-lg border border-border bg-muted/30">
        {photo ? (
          <img src={photo.url} alt={`${title}: ${optionLabel(photo)}`} onError={onImageError} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Sin foto</div>
        )}
      </div>
      {photo && (
        <p className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
          {photo.visibility === 'private' && <Lock className="h-3 w-3" />}
          {dayLabel(photo)}
        </p>
      )}
    </div>
  );

  if (photos.length < 2) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        Necesitas al menos dos fotos para compararlas. Sube una nueva cuando quieras ver tu avance.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Posición</Label>
          <Select value={position} onValueChange={(v) => setPosition(v as PhotoPosition | 'all')}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {usedPositions.map((p) => (
                <SelectItem key={p} value={p}>{POSITION_LABELS[p]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Antes</Label>
          <Select value={beforeId} onValueChange={setBeforeId} disabled={candidates.length < 2}>
            <SelectTrigger><SelectValue placeholder="Elige una foto" /></SelectTrigger>
            <SelectContent>
              {candidates.map((p) => (
                <SelectItem key={p.id} value={p.id}>{optionLabel(p)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Después</Label>
          <Select value={afterId} onValueChange={setAfterId} disabled={candidates.length < 2}>
            <SelectTrigger><SelectValue placeholder="Elige una foto" /></SelectTrigger>
            <SelectContent>
              {candidates.map((p) => (
                <SelectItem key={p.id} value={p.id}>{optionLabel(p)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {candidates.length < 2 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Hay menos de dos fotos en esta posición. Prueba con "Todas" o sube otra.
        </p>
      ) : (
        <>
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">
              {before && after && `${Math.abs(differenceInCalendarDays(parseISO(after.takenAt), parseISO(before.takenAt)))} días entre ambas fotos`}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setBeforeId(afterId); setAfterId(beforeId); }}
            >
              <ArrowLeftRight className="h-4 w-4 mr-2" />
              Invertir
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {renderPanel('Antes', before)}
            {renderPanel('Después', after)}
          </div>
        </>
      )}
    </div>
  );
};

export default PhotoCompare;
