import { useEffect, useState } from 'react';
import { userService } from '@/services/userService';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { getErrorMessage } from '@/lib/apiError';
import type { AirtableImportResult } from '@/types';

interface AirtableImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Se llama después de importar, para recargar la lista de pacientes
  onImported: () => void;
}

const MAX_NAMES = 12;

// Primero muestra QUÉ se importaría (sin crear nada) y recién con la confirmación
// de la persona importa. Nunca modifica a un paciente que ya existe en la app.
const AirtableImportDialog = ({ open, onOpenChange, onImported }: AirtableImportDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [preview, setPreview] = useState<AirtableImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setPreview(null);
    setError(null);
    setLoading(true);
    userService
      .syncAirtable(true)
      .then(setPreview)
      .catch((err: unknown) => setError(getErrorMessage(err, 'No se pudo conectar con Airtable')))
      .finally(() => setLoading(false));
  }, [open]);

  const handleImport = async () => {
    setImporting(true);
    try {
      const result = await userService.syncAirtable(false);
      toast.success(
        result.created > 0
          ? `Se importaron ${result.created} pacientes. Quedan sin acceso hasta que les envíes la invitación.`
          : 'No había pacientes nuevos para importar.'
      );
      if (result.failed > 0) {
        toast.error(`${result.failed} registros no se pudieron importar. Revisa sus datos en Airtable.`);
      }
      onImported();
      onOpenChange(false);
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, 'No se pudo importar desde Airtable'));
    } finally {
      setImporting(false);
    }
  };

  const toCreate = preview?.toCreate ?? 0;
  const noEmail = preview?.skippedNoEmail ?? [];
  const noEmailColumn = preview && preview.emailColumn === null;

  return (
    <Dialog open={open} onOpenChange={(next) => !importing && onOpenChange(next)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Importar pacientes desde Airtable</DialogTitle>
          <DialogDescription>
            Solo se crean los que todavía no están en la app. Los que ya están nunca se modifican.
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Revisando Airtable…
          </div>
        )}

        {error && (
          <p className="flex gap-2 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-400">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </p>
        )}

        {preview && (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg border border-border p-3">
                <p className="text-2xl font-bold text-primary">{toCreate}</p>
                <p className="text-xs text-muted-foreground">se importarían</p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <p className="text-2xl font-bold">{preview.alreadyInApp}</p>
                <p className="text-xs text-muted-foreground">ya están en la app</p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <p className="text-2xl font-bold">{noEmail.length}</p>
                <p className="text-xs text-muted-foreground">sin correo</p>
              </div>
            </div>

            {noEmailColumn && (
              <div className="space-y-1 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-amber-400">
                <p className="flex gap-2 font-medium">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  No encontré ninguna columna con correos válidos.
                </p>
                <p className="text-xs">
                  Columnas que veo en Airtable: {preview.fieldsDetected.join(', ') || '(ninguna)'}. Dime cuál
                  tiene el correo y lo ajusto.
                </p>
              </div>
            )}

            {preview.emailColumn && (
              <p className="flex gap-2 text-xs text-muted-foreground">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
                El correo se toma de la columna “{preview.emailColumn}”.
              </p>
            )}

            {toCreate > 0 && (
              <ul className="space-y-1 text-xs text-muted-foreground">
                {(preview.toCreateInactive ?? 0) > 0 && (
                  <li>• {preview.toCreateInactive} figuran como inactivos en Airtable: se crean inactivos.</li>
                )}
                {(preview.withoutProfessional ?? 0) > 0 && (
                  <li>
                    • {preview.withoutProfessional} no tienen un profesional que coincida con un solo nombre: quedan
                    sin asignar (los ve todo el personal) hasta que los asignes.
                  </li>
                )}
                <li>• Se crean sin acceso: no reciben ningún correo hasta que tú les envíes la invitación.</li>
              </ul>
            )}

            {preview.sample && preview.sample.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-medium">Los primeros {preview.sample.length}:</p>
                <div className="divide-y divide-border rounded-lg border border-border">
                  {preview.sample.map((p) => (
                    <div key={p.email} className="flex items-center justify-between gap-2 px-3 py-2">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{p.name}</p>
                        <p className="truncate text-xs text-muted-foreground">{p.email}</p>
                      </div>
                      <p className="shrink-0 text-xs text-muted-foreground">
                        {p.professional ?? (p.professionalText ? `“${p.professionalText}”` : 'sin profesional')}
                        {!p.isActive && ' · inactivo'}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {noEmail.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-amber-400">
                  Sin correo válido en Airtable (no se pueden importar):
                </p>
                <p className="text-xs text-muted-foreground">
                  {noEmail.slice(0, MAX_NAMES).join(', ')}
                  {noEmail.length > MAX_NAMES && ` y ${noEmail.length - MAX_NAMES} más`}
                </p>
              </div>
            )}

            {toCreate === 0 && !noEmailColumn && (
              <p className="text-center text-muted-foreground">No hay pacientes nuevos para importar.</p>
            )}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={importing}>
            Cancelar
          </Button>
          <Button onClick={handleImport} disabled={!preview || toCreate === 0 || importing}>
            {importing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {toCreate > 0 ? `Importar ${toCreate} pacientes` : 'Importar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AirtableImportDialog;
