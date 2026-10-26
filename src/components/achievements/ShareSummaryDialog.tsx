import { useEffect, useMemo, useState } from 'react';
import { Download, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { buildShareCardModel, renderShareCard } from '@/lib/shareCard';
import { blobToDataUrl } from '@/lib/achievementCard';
import { notify } from '@/lib/notify';
import type { MonthlySummary } from '@/services/achievementService';

interface ShareSummaryDialogProps {
  summary: MonthlySummary | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Vista previa de lo que se va a compartir. La imagen se crea en este dispositivo y NO se sube a ningún servidor: la
// persona decide si la guarda o la comparte. Solo lleva el mes, las sesiones completadas y hitos neutros.
const ShareSummaryDialog = ({ summary, open, onOpenChange }: ShareSummaryDialogProps) => {
  const model = useMemo(() => (summary ? buildShareCardModel(summary) : null), [summary]);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!open || !model) return;
    let cancelled = false;
    setBlob(null);
    setUrl(null);
    setFailed(false);
    // La vista previa va como data: (la política de seguridad de la app no deja mostrar imágenes desde blob:)
    renderShareCard(model)
      .then(async (b) => {
        const dataUrl = await blobToDataUrl(b);
        if (cancelled) return;
        setBlob(b);
        setUrl(dataUrl);
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [open, model]);

  const fileName = `prime-fh-${summary?.month ?? 'resumen'}.png`;
  const canNativeShare = (() => {
    if (!blob || typeof navigator === 'undefined' || !navigator.canShare) return false;
    try {
      return navigator.canShare({ files: [new File([blob], fileName, { type: 'image/png' })] });
    } catch {
      return false;
    }
  })();

  const share = async () => {
    if (!blob) return;
    try {
      await navigator.share({ files: [new File([blob], fileName, { type: 'image/png' })], title: 'Mi camino PRIME' });
    } catch (err) {
      // Cerrar el panel de compartir no es un error
      if ((err as DOMException)?.name !== 'AbortError') notify.error('No se pudo abrir el panel para compartir. Puedes guardar la imagen.');
    }
  };

  const alt = model
    ? `Imagen de ${model.monthLabel}: ${model.sessions} ${model.sessions === 1 ? 'sesión completada' : 'sesiones completadas'}${model.milestones.length ? `. Hitos: ${model.milestones.join(', ')}` : ''}.`
    : '';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm border-[#fff8e4]/15 bg-[#1f1c21] text-[#fff8e4]">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl font-medium">Compartir sin datos clínicos</DialogTitle>
          <DialogDescription className="text-[#cdc6b6]">
            Esta imagen incluye solo el mes, tus sesiones completadas y algunos hitos. No lleva tu nombre, medidas, peso, dolor ni tipo de atención. Se crea en tu
            dispositivo y tú decides si la compartes.
          </DialogDescription>
        </DialogHeader>
        <div className="overflow-hidden rounded-2xl border border-[#fff8e4]/10 bg-[#181619]">
          {url ? <img src={url} alt={alt} className="h-auto w-full" /> : <div className="flex aspect-[4/5] items-center justify-center text-sm text-[#a8a295]">{failed ? 'No se pudo preparar la imagen.' : 'Preparando la imagen…'}</div>}
        </div>
        <DialogFooter className="flex-col gap-2 sm:flex-col sm:space-x-0">
          {canNativeShare && (
            <Button onClick={share} disabled={!blob} className="min-h-[48px] w-full rounded-2xl border-[#398ca2] bg-[#398ca2] font-bold text-[#181619] hover:bg-[#398ca2]/90">
              <Share2 aria-hidden="true" />
              Compartir
            </Button>
          )}
          {url && (
            <Button asChild variant={canNativeShare ? 'outline' : 'default'} className={canNativeShare ? 'min-h-[48px] w-full rounded-2xl border-[#398ca2] bg-transparent text-[#fff8e4] hover:bg-[#398ca2]/15 hover:text-[#fff8e4]' : 'min-h-[48px] w-full rounded-2xl border-[#398ca2] bg-[#398ca2] font-bold text-[#181619] hover:bg-[#398ca2]/90'}>
              <a href={url} download={fileName}>
                <Download aria-hidden="true" />
                Guardar imagen
              </a>
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ShareSummaryDialog;
