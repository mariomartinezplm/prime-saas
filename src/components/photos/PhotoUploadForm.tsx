import { useEffect, useState } from 'react';
import { photoService } from '@/services/photoService';
import { prepareImageForUpload, ImageReadError } from '@/lib/imageResize';
import { todayLocal, localNoonISO } from '@/lib/evolutionDate';
import { showApiError } from '@/lib/apiError';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2, Lock, Users } from 'lucide-react';
import { POSITIONS, POSITION_LABELS } from './photoLabels';
import type { PhotoPosition, PhotoVisibility } from '@/types';

interface PhotoUploadFormProps {
  patientId: string;
  // Solo el paciente elige quién ve su foto
  isPatient: boolean;
  onSuccess: () => void;
}

const PhotoUploadForm = ({ patientId, isPatient, onSuccess }: PhotoUploadFormProps) => {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [position, setPosition] = useState<PhotoPosition>('front');
  const [takenAt, setTakenAt] = useState(todayLocal());
  const [note, setNote] = useState('');
  const [visibility, setVisibility] = useState<PhotoVisibility>('shared');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      toast.error('Elige una foto');
      return;
    }
    setLoading(true);
    try {
      const prepared = await prepareImageForUpload(file);
      await photoService.upload(patientId, prepared, {
        position,
        takenAt: localNoonISO(takenAt),
        note: note.trim() || undefined,
        visibility: isPatient ? visibility : undefined,
      });
      toast.success('Foto subida');
      onSuccess();
    } catch (err: unknown) {
      if (err instanceof ImageReadError) toast.error(err.message);
      else showApiError(err, 'No se pudo subir la foto');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label>Foto *</Label>
        <Input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        {preview && (
          <img src={preview} alt="Vista previa" className="mt-2 max-h-64 rounded-lg border border-border object-contain" />
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Posición</Label>
          <Select value={position} onValueChange={(v) => setPosition(v as PhotoPosition)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {POSITIONS.map((p) => (
                <SelectItem key={p} value={p}>{POSITION_LABELS[p]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Fecha en que se tomó</Label>
          <Input type="date" max={todayLocal()} value={takenAt} onChange={(e) => setTakenAt(e.target.value)} />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Nota (opcional)</Label>
        <Input value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} placeholder="Ej: en ayunas, después del entrenamiento" />
      </div>

      {isPatient && (
        <div className="space-y-1.5">
          <Label>¿Quién puede verla?</Label>
          <Select value={visibility} onValueChange={(v) => setVisibility(v as PhotoVisibility)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="shared">Compartida con mi kinesiólogo</SelectItem>
              <SelectItem value="private">Solo yo</SelectItem>
            </SelectContent>
          </Select>
          <p className="flex gap-2 text-xs text-muted-foreground">
            {visibility === 'shared' ? (
              <>
                <Users className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                La ven tú, tu kinesiólogo y el equipo de Prime F&amp;H.
              </>
            ) : (
              <>
                <Lock className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                Solo la ves tú y el administrador de Prime F&amp;H. Tu kinesiólogo no la verá.
              </>
            )}
          </p>
        </div>
      )}

      <Button type="submit" className="w-full" disabled={loading || !file}>
        {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
        Subir foto
      </Button>
    </form>
  );
};

export default PhotoUploadForm;
