import { useState } from 'react';
import { photoService } from '@/services/photoService';
import { prepareImageForUpload, ImageReadError, type PreparedImage } from '@/lib/imageResize';
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
  // La foto ya reducida y lista para subir (se prepara apenas se elige)
  const [prepared, setPrepared] = useState<PreparedImage | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [position, setPosition] = useState<PhotoPosition>('front');
  const [takenAt, setTakenAt] = useState(todayLocal());
  const [note, setNote] = useState('');
  const [visibility, setVisibility] = useState<PhotoVisibility>('shared');
  const [loading, setLoading] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const chosen = e.target.files?.[0];
    setPrepared(null);
    setFileError(null);
    if (!chosen) return;

    setPreparing(true);
    try {
      setPrepared(await prepareImageForUpload(chosen));
    } catch (err: unknown) {
      const message = err instanceof ImageReadError ? err.message : 'No se pudo leer la imagen. Prueba con otra foto.';
      setFileError(message);
      // Permite volver a elegir la misma foto después de corregirla
      e.target.value = '';
    } finally {
      setPreparing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prepared) {
      toast.error(fileError ?? 'Elige una foto');
      return;
    }
    setLoading(true);
    try {
      await photoService.upload(patientId, prepared.file, {
        position,
        takenAt: localNoonISO(takenAt),
        note: note.trim() || undefined,
        visibility: isPatient ? visibility : undefined,
      });
      toast.success('Foto subida');
      onSuccess();
    } catch (err: unknown) {
      showApiError(err, 'No se pudo subir la foto');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label>Foto *</Label>
        <Input type="file" accept="image/*" onChange={handleFileChange} />
        {preparing && (
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Preparando la foto…
          </p>
        )}
        {fileError && <p role="alert" className="text-sm text-red-400">{fileError}</p>}
        {prepared && (
          <img src={prepared.previewUrl} alt="Vista previa" className="mt-2 max-h-64 rounded-lg border border-border object-contain" />
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

      <Button type="submit" className="w-full" disabled={loading || preparing || !prepared}>
        {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
        Subir foto
      </Button>
    </form>
  );
};

export default PhotoUploadForm;
