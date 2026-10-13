import { useRef, useState } from 'react';
import { photoService } from '@/services/photoService';
import { prepareImageForUpload, ImageReadError, type PreparedImage } from '@/lib/imageResize';
import { todayLocal, localNoonISO } from '@/lib/evolutionDate';
import { showApiError } from '@/lib/apiError';
import { Input } from '@/components/ui/input';
import { FormField } from '@/components/forms/FormField';
import SubmitButton from '@/components/forms/SubmitButton';
import { useUnsavedChangesWarning } from '@/hooks/useUnsavedChangesWarning';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { notify } from '@/lib/notify';
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
  const [dateError, setDateError] = useState<string | undefined>();
  const formRef = useRef<HTMLFormElement>(null);
  const submittingRef = useRef(false);

  // Con una foto elegida o una nota escrita, salir sin subirla se pregunta
  useUnsavedChangesWarning((!!prepared || note.trim() !== '') && !loading);

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
    if (submittingRef.current || preparing) return;

    const noPhoto = !prepared;
    const badDate = !takenAt ? 'Indica la fecha' : takenAt > todayLocal() ? 'La fecha no puede ser futura' : undefined;
    if (noPhoto && !fileError) setFileError('Elige una foto para subir');
    setDateError(badDate);
    if (noPhoto || badDate) {
      requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
      return;
    }

    submittingRef.current = true;
    setLoading(true);
    try {
      await photoService.upload(patientId, prepared!.file, {
        position,
        takenAt: localNoonISO(takenAt),
        note: note.trim() || undefined,
        visibility: isPatient ? visibility : undefined,
      });
      notify.success('Foto subida');
      onSuccess();
    } catch (err: unknown) {
      showApiError(err, 'No se pudo subir la foto');
    } finally {
      submittingRef.current = false;
      setLoading(false);
    }
  };

  return (
    <form ref={formRef} onSubmit={handleSubmit} noValidate className="space-y-4">
      <FormField label="Foto" required error={fileError ?? undefined}>
        {(c) => (
          <>
            <Input {...c} type="file" accept="image/*" onChange={(e) => { setFileError(null); handleFileChange(e); }} disabled={loading} />
            {preparing && (
              <p role="status" className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                Preparando la foto…
              </p>
            )}
            {prepared && (
              <img src={prepared.previewUrl} alt="Vista previa de la foto elegida" className="mt-2 max-h-64 rounded-lg border border-border object-contain" />
            )}
          </>
        )}
      </FormField>

      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="Posición">
          {(c) => (
            <Select value={position} onValueChange={(v) => setPosition(v as PhotoPosition)}>
              <SelectTrigger id={c.id}><SelectValue /></SelectTrigger>
              <SelectContent>
                {POSITIONS.map((p) => (
                  <SelectItem key={p} value={p}>{POSITION_LABELS[p]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </FormField>
        <FormField label="Fecha en que se tomó" required error={dateError}>
          {(c) => (
            <Input {...c} type="date" max={todayLocal()} value={takenAt} onChange={(e) => { setTakenAt(e.target.value); setDateError(undefined); }} />
          )}
        </FormField>
      </div>

      <FormField label="Nota (opcional)">
        {(c) => <Input {...c} value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} placeholder="Ej: en ayunas, después del entrenamiento" />}
      </FormField>

      {isPatient && (
        <FormField label="¿Quién puede verla?">
          {(c) => (
          <>
          <Select value={visibility} onValueChange={(v) => setVisibility(v as PhotoVisibility)}>
            <SelectTrigger id={c.id}><SelectValue /></SelectTrigger>
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
          </>
          )}
        </FormField>
      )}

      <SubmitButton className="w-full" loading={loading} loadingLabel="Subiendo foto…" disabled={preparing}>
        Subir foto
      </SubmitButton>
    </form>
  );
};

export default PhotoUploadForm;
