import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { fileService } from '@/services/fileService';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { FileText, Image as ImageIcon, Upload, Download, Trash2, Loader2, X, MessageCircle } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { getWhatsAppUrl } from '@/config/contact';
import { getErrorMessage, showApiError } from '@/lib/apiError';
import type { ClientFile } from '@/types';

const MAX_SIZE_BYTES = 10 * 1024 * 1024;
const ACCEPTED_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
const ACCEPT_ATTR = '.pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png';

interface PatientFilesTabProps {
  patientId: string;
  // false = el paciente tiene el plan vencido: puede ver y descargar, no subir
  canUpload?: boolean;
}

const formatSize = (bytes: number): string => {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const uploaderOf = (file: ClientFile): { id: string; name: string } => {
  if (typeof file.uploadedBy === 'string') return { id: file.uploadedBy, name: '' };
  return {
    id: file.uploadedBy.id ?? file.uploadedBy._id ?? '',
    name: `${file.uploadedBy.firstName} ${file.uploadedBy.lastName}`,
  };
};

const PatientFilesTab = ({ patientId, canUpload = true }: PatientFilesTabProps) => {
  const { user } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);

  const [files, setFiles] = useState<ClientFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const [selected, setSelected] = useState<File | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [openingId, setOpeningId] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<ClientFile | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      setFiles(await fileService.getPatientFiles(patientId));
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => {
    load();
  }, [load]);

  const pickFile = (file: File | undefined) => {
    if (!file) return;
    if (!ACCEPTED_TYPES.includes(file.type)) {
      toast.error('Formato no permitido. Sube un PDF, JPG o PNG');
      return;
    }
    if (file.size > MAX_SIZE_BYTES) {
      toast.error('El archivo supera el máximo de 10 MB');
      return;
    }
    setSelected(file);
    setName(file.name.replace(/\.[^.]+$/, ''));
  };

  const resetForm = () => {
    setSelected(null);
    setName('');
    setDescription('');
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleUpload = async () => {
    if (!selected) return;
    setUploading(true);
    try {
      await fileService.upload(patientId, selected, {
        fileName: name.trim() || selected.name,
        description: description.trim() || undefined,
      });
      toast.success('Archivo subido');
      resetForm();
      await load();
    } catch (err: unknown) {
      showApiError(err, 'No se pudo subir el archivo');
    } finally {
      setUploading(false);
    }
  };

  const handleOpen = async (file: ClientFile) => {
    setOpeningId(file._id);
    // La pestaña se abre ANTES de pedir el link: si se abriera después de esperar
    // a la red, el celular la bloquearía como ventana emergente.
    const tab = window.open('', '_blank');
    try {
      const link = await fileService.getDownloadLink(file._id);
      if (tab) tab.location.href = link.url;
      else window.location.href = link.url;
    } catch (err: unknown) {
      tab?.close();
      toast.error(getErrorMessage(err, 'No se pudo abrir el archivo'));
    } finally {
      setOpeningId(null);
    }
  };

  const handleDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await fileService.remove(toDelete._id);
      toast.success('Archivo eliminado');
      setToDelete(null);
      await load();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, 'No se pudo eliminar el archivo'));
    } finally {
      setDeleting(false);
    }
  };

  const canDelete = (file: ClientFile) => user?.role === 'admin' || uploaderOf(file).id === user?.id;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-lg">Subir archivo</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {!canUpload ? (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm space-y-3">
              <p className="text-amber-400">
                Tu plan venció. Puedes ver y descargar tus archivos, pero para subir nuevos necesitas renovar.
              </p>
              <Button asChild variant="outline" size="sm" className="w-full sm:w-auto h-auto whitespace-normal py-2">
                <a href={getWhatsAppUrl('Hola, quiero renovar mi plan en Prime F&H')} target="_blank" rel="noreferrer">
                  <MessageCircle className="h-4 w-4 mr-2" />
                  Contacta a Prime F&amp;H para renovar
                </a>
              </Button>
            </div>
          ) : (
            <>
              <input
                ref={inputRef}
                type="file"
                accept={ACCEPT_ATTR}
                className="hidden"
                onChange={(e) => pickFile(e.target.files?.[0])}
              />

              {!selected ? (
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragging(false);
                    pickFile(e.dataTransfer.files?.[0]);
                  }}
                  className={cn(
                    'w-full rounded-lg border-2 border-dashed p-6 text-center transition-colors',
                    dragging ? 'border-secondary bg-secondary/10' : 'border-border hover:border-muted-foreground/50'
                  )}
                >
                  <Upload className="h-6 w-6 mx-auto mb-2 text-secondary" />
                  <p className="text-sm font-medium">Toca para elegir un archivo o arrástralo aquí</p>
                  <p className="text-xs text-muted-foreground mt-1">PDF, JPG o PNG · máximo 10 MB</p>
                </button>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2 rounded-lg border border-border p-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{selected.name}</p>
                      <p className="text-xs text-muted-foreground">{formatSize(selected.size)}</p>
                    </div>
                    <Button variant="ghost" size="icon" onClick={resetForm} disabled={uploading} aria-label="Quitar archivo">
                      <X className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="file-name">Nombre</Label>
                    <Input id="file-name" value={name} maxLength={200} onChange={(e) => setName(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="file-description">Descripción (opcional)</Label>
                    <Input
                      id="file-description"
                      value={description}
                      maxLength={500}
                      placeholder="Ej: Resonancia de rodilla, marzo 2026"
                      onChange={(e) => setDescription(e.target.value)}
                    />
                  </div>

                  <Button onClick={handleUpload} disabled={uploading} className="w-full">
                    {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                    {uploading ? 'Subiendo...' : 'Subir archivo'}
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg">Archivos ({files.length})</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {loading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : loadError ? (
            <div className="text-sm text-center space-y-2 py-4">
              <p className="text-red-400">No se pudieron cargar los archivos.</p>
              <Button variant="outline" size="sm" onClick={load}>Reintentar</Button>
            </div>
          ) : files.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">Todavía no hay archivos subidos.</p>
          ) : (
            files.map((file) => {
              const Icon = file.mimeType === 'application/pdf' ? FileText : ImageIcon;
              const uploader = uploaderOf(file);
              return (
                <div key={file._id} className="flex items-center gap-3 rounded-lg border border-border p-3">
                  <Icon className="h-5 w-5 shrink-0 text-secondary" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{file.fileName}</p>
                    {file.description && (
                      <p className="text-xs text-muted-foreground truncate">{file.description}</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {format(parseISO(file.createdAt), "d 'de' MMM yyyy", { locale: es })} · {formatSize(file.sizeBytes)}
                      {uploader.name && ` · ${uploader.id === user?.id ? 'Tú' : uploader.name}`}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => handleOpen(file)}
                    disabled={openingId === file._id}
                    aria-label={`Ver ${file.fileName}`}
                  >
                    {openingId === file._id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  </Button>
                  {canDelete(file) && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setToDelete(file)}
                      aria-label={`Eliminar ${file.fileName}`}
                    >
                      <Trash2 className="h-4 w-4 text-red-400" />
                    </Button>
                  )}
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!toDelete} onOpenChange={(open) => !open && !deleting && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este archivo?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará "{toDelete?.fileName}" de forma permanente. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
            >
              {deleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default PatientFilesTab;
