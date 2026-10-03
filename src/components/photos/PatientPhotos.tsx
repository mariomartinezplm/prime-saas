import { useCallback, useEffect, useRef, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';
import { photoService } from '@/services/photoService';
import PatientRecordDialog from '@/components/forms/PatientRecordDialog';
import PhotoUploadForm from './PhotoUploadForm';
import PhotoCompare from './PhotoCompare';
import { POSITIONS, POSITION_LABELS } from './photoLabels';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Camera, Loader2, Lock, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { showApiError } from '@/lib/apiError';
import type { PhotoPosition, ProgressPhoto } from '@/types';

interface PatientPhotosProps {
  patientId: string;
}

const uploaderOf = (photo: ProgressPhoto) =>
  typeof photo.uploadedBy === 'object' ? photo.uploadedBy : null;

const uploaderId = (photo: ProgressPhoto) => {
  const u = uploaderOf(photo);
  return u ? (u.id ?? u._id) : photo.uploadedBy;
};

const PatientPhotos = ({ patientId }: PatientPhotosProps) => {
  const { user } = useAuth();
  const isPatient = user?.role === 'patient';
  const [photos, setPhotos] = useState<ProgressPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<PhotoPosition | 'all'>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const lastReload = useRef(0);

  const load = useCallback(async () => {
    lastReload.current = Date.now();
    try {
      setPhotos(await photoService.getPatientPhotos(patientId));
    } catch (err: unknown) {
      showApiError(err, 'No se pudieron cargar las fotos');
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => {
    load();
  }, [load]);

  // Las URLs firmadas duran 15 minutos: si una foto deja de cargar, se piden de nuevo
  // (como máximo una vez cada 30 segundos, para no entrar en un ciclo si falla de verdad).
  const handleImageError = useCallback(() => {
    if (Date.now() - lastReload.current > 30_000) load();
  }, [load]);

  const selected = photos.find((p) => p.id === selectedId) ?? null;
  const visible = photos.filter((p) => filter === 'all' || p.position === filter);
  const canDelete = (photo: ProgressPhoto) => user?.role === 'admin' || uploaderId(photo) === user?.id;
  const isOwn = (photo: ProgressPhoto) => uploaderId(photo) === user?.id;

  const handleToggleVisibility = async (photo: ProgressPhoto, makePrivate: boolean) => {
    setBusy(true);
    try {
      await photoService.update(photo.id, { visibility: makePrivate ? 'private' : 'shared' });
      await load();
      toast.success(makePrivate ? 'Ahora solo tú la ves' : 'Ahora la ve tu kinesiólogo');
    } catch (err: unknown) {
      showApiError(err, 'No se pudo cambiar la visibilidad');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      await photoService.remove(selected.id);
      toast.success('Foto eliminada');
      setConfirmDelete(false);
      setSelectedId(null);
      await load();
    } catch (err: unknown) {
      showApiError(err, 'No se pudo eliminar la foto');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const usedPositions = POSITIONS.filter((p) => photos.some((photo) => photo.position === p));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="text-sm text-muted-foreground max-w-xl">
          {isPatient
            ? 'Sube fotos de tu avance y compáralas en el tiempo. Tú eliges si las ve tu kinesiólogo o solo tú.'
            : 'Fotos de avance del paciente. Las fotos que el paciente marca como "solo yo" no aparecen aquí.'}
        </p>
        <PatientRecordDialog
          label="Subir foto"
          title="Subir foto de progreso"
          description="La foto se reduce de tamaño y se le quita la ubicación antes de subirla."
          requirePlan={isPatient}
        >
          {(close) => (
            <PhotoUploadForm
              patientId={patientId}
              isPatient={isPatient}
              onSuccess={() => { close(); load(); }}
            />
          )}
        </PatientRecordDialog>
      </div>

      <Tabs defaultValue="gallery">
        <TabsList>
          <TabsTrigger value="gallery">Galería</TabsTrigger>
          <TabsTrigger value="compare">Comparar</TabsTrigger>
        </TabsList>

        <TabsContent value="gallery" className="mt-4 space-y-4">
          {photos.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
              <Camera className="h-10 w-10 opacity-40" />
              <p>Todavía no hay fotos.</p>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                {(['all', ...usedPositions] as const).map((p) => (
                  <Button
                    key={p}
                    size="sm"
                    variant={filter === p ? 'default' : 'outline'}
                    onClick={() => setFilter(p)}
                  >
                    {p === 'all' ? 'Todas' : POSITION_LABELS[p]}
                  </Button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                {visible.map((photo) => (
                  <button
                    key={photo.id}
                    type="button"
                    onClick={() => setSelectedId(photo.id)}
                    className="group relative aspect-[3/4] overflow-hidden rounded-lg border border-border bg-muted/30 text-left"
                  >
                    <img
                      src={photo.url}
                      alt={`${POSITION_LABELS[photo.position]} ${format(parseISO(photo.takenAt), 'dd/MM/yyyy')}`}
                      loading="lazy"
                      onError={handleImageError}
                      className="h-full w-full object-cover transition-transform group-hover:scale-105"
                    />
                    <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-gradient-to-t from-black/80 to-transparent p-2 text-xs text-white">
                      <span>{format(parseISO(photo.takenAt), 'dd/MM/yyyy')}</span>
                      {photo.visibility === 'private' && <Lock className="h-3.5 w-3.5" aria-label="Solo yo" />}
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="compare" className="mt-4">
          <PhotoCompare photos={photos} onImageError={handleImageError} />
        </TabsContent>
      </Tabs>

      <Dialog open={!!selected} onOpenChange={(open) => { if (!open) setSelectedId(null); }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle>
                  {POSITION_LABELS[selected.position]} · {format(parseISO(selected.takenAt), 'dd/MM/yyyy')}
                </DialogTitle>
                <DialogDescription>
                  {isOwn(selected)
                    ? 'Subida por ti'
                    : `Subida por ${uploaderOf(selected)?.firstName ?? 'el equipo'} ${uploaderOf(selected)?.lastName ?? ''}`.trim()}
                </DialogDescription>
              </DialogHeader>

              <img
                src={selected.url}
                alt="Foto de progreso"
                onError={handleImageError}
                className="w-full rounded-lg border border-border object-contain max-h-[60vh]"
              />

              {selected.note && <p className="text-sm text-muted-foreground">{selected.note}</p>}

              <div className="flex flex-wrap items-center justify-between gap-3">
                {isPatient && isOwn(selected) ? (
                  <div className="flex items-center gap-2">
                    <Switch
                      id="photo-private"
                      checked={selected.visibility === 'private'}
                      disabled={busy}
                      onCheckedChange={(checked) => handleToggleVisibility(selected, checked)}
                    />
                    <Label htmlFor="photo-private" className="text-sm">Solo yo</Label>
                  </div>
                ) : (
                  <Badge variant="outline">
                    {selected.visibility === 'private' ? 'Solo quien la subió' : 'Compartida'}
                  </Badge>
                )}
                {canDelete(selected) && (
                  <Button variant="outline" size="sm" disabled={busy} onClick={() => setConfirmDelete(true)}>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Eliminar
                  </Button>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar esta foto?</AlertDialogTitle>
            <AlertDialogDescription>Se borra definitivamente y no se puede recuperar.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={busy}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default PatientPhotos;
