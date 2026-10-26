import { useEffect, useMemo, useState } from 'react';
import { Download, Share2, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/contexts/AuthContext';
import {
  CARD_SIZES,
  blobToDataUrl,
  buildAchievementCardModel,
  detailLine,
  isSensitiveAchievement,
  renderAchievementCard,
  type CardFormat,
  type ShareableAchievement,
} from '@/lib/achievementCard';
import { notify } from '@/lib/notify';
import { cn } from '@/lib/utils';

interface ShareAchievementDialogProps {
  achievement: ShareableAchievement | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const slug = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'logro';

// Compartir un logro como imagen (Instagram, WhatsApp, guardarla…). La imagen se crea en este dispositivo y NO se sube a ningún
// servidor: se ve exactamente lo que se comparte, y el nombre y los números solo van si la persona los enciende.
const ShareAchievementDialog = ({ achievement, open, onOpenChange }: ShareAchievementDialogProps) => {
  const { user } = useAuth();
  const [format, setFormat] = useState<CardFormat>('story');
  const [includeName, setIncludeName] = useState(false);
  const [includeDetail, setIncludeDetail] = useState(false);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  const model = useMemo(
    () => (achievement ? buildAchievementCardModel(achievement, { includeName, includeDetail }, user?.firstName) : null),
    [achievement, includeName, includeDetail, user?.firstName]
  );
  const sensitive = achievement ? isSensitiveAchievement(achievement) : false;
  const hasDetail = achievement ? detailLine(achievement) !== null : false;

  // Cada vez que se abre vuelve a lo más privado
  useEffect(() => {
    if (open) {
      setIncludeName(false);
      setIncludeDetail(false);
      setFormat('story');
    }
  }, [open, achievement]);

  useEffect(() => {
    if (!open || !model) return;
    let cancelled = false;
    setBlob(null);
    setPreview(null);
    setFailed(false);
    renderAchievementCard(model, format)
      .then(async (b) => {
        const dataUrl = await blobToDataUrl(b);
        if (cancelled) return;
        setBlob(b);
        setPreview(dataUrl);
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [open, model, format]);

  const fileName = `prime-fh-logro-${slug(achievement?.title ?? 'logro')}.png`;
  const file = blob ? new File([blob], fileName, { type: 'image/png' }) : null;
  const canNativeShare = (() => {
    if (!file || typeof navigator === 'undefined' || !navigator.canShare) return false;
    try {
      return navigator.canShare({ files: [file] });
    } catch {
      return false;
    }
  })();

  const share = async () => {
    if (!file) return;
    try {
      await navigator.share({ files: [file], title: 'Mi logro en PRIME F&H' });
    } catch (err) {
      // Cerrar el panel de compartir no es un error
      if ((err as DOMException)?.name !== 'AbortError') notify.error('No se pudo abrir el panel para compartir. Puedes guardar la imagen.');
    }
  };

  // Guardar: en el teléfono el panel de compartir ofrece «Guardar imagen»; en computador y Android, la descarga directa
  const save = () => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  };

  const alt = model ? `Imagen de tu logro: ${model.title}${model.dateLabel ? `, ${model.dateLabel}` : ''}.` : '';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] max-w-sm overflow-y-auto border-[#fff8e4]/15 bg-[#1f1c21] text-[#fff8e4]">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl font-medium">Compartir mi logro</DialogTitle>
          <DialogDescription className="text-[#cdc6b6]">
            La imagen se crea en tu teléfono y tú decides si la compartes. Por defecto lleva solo el nombre del logro y la fecha.
          </DialogDescription>
        </DialogHeader>

        {sensitive && (
          <p className="flex items-start gap-2 rounded-xl border border-[#f0b95a]/40 bg-[#f0b95a]/10 px-3 py-2.5 text-[13px] text-[#f3d9a4]">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>Este logro cuenta algo de tu salud o de tu cuerpo. Quien vea la imagen lo sabrá: compártela solo si quieres.</span>
          </p>
        )}

        <div role="group" aria-label="Formato de la imagen" className="grid grid-cols-2 rounded-2xl border border-[#fff8e4]/20 bg-[#fff8e4]/[0.04] p-1">
          {(Object.keys(CARD_SIZES) as CardFormat[]).map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={format === f}
              onClick={() => setFormat(f)}
              className={cn('min-h-[44px] rounded-xl text-[13.5px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#fff8e4]', format === f ? 'bg-[#398ca2] font-extrabold text-[#181619]' : 'text-[#cdc6b6]')}
            >
              {CARD_SIZES[f].label}
            </button>
          ))}
        </div>

        <div className="overflow-hidden rounded-2xl border border-[#fff8e4]/10 bg-[#181619]">
          {preview ? (
            <img src={preview} alt={alt} className="mx-auto h-auto max-h-[46dvh] w-auto max-w-full object-contain" />
          ) : (
            <div className={cn('flex items-center justify-center text-sm text-[#a8a295]', format === 'story' ? 'aspect-[9/16] max-h-[46dvh]' : 'aspect-[4/5]')}>{failed ? 'No se pudo preparar la imagen.' : 'Preparando la imagen…'}</div>
          )}
        </div>

        <div className="space-y-3">
          <label className="flex min-h-[44px] cursor-pointer items-center justify-between gap-3 text-[14.5px]">
            <span>Incluir mi nombre</span>
            <Switch checked={includeName} onCheckedChange={setIncludeName} aria-label="Incluir mi nombre en la imagen" />
          </label>
          {hasDetail && (
            <label className="flex min-h-[44px] cursor-pointer items-center justify-between gap-3 text-[14.5px]">
              <span>Incluir la marca o la meta (con números)</span>
              <Switch checked={includeDetail} onCheckedChange={setIncludeDetail} aria-label="Incluir la marca o la meta con sus números" />
            </label>
          )}
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-col sm:space-x-0">
          {canNativeShare && (
            <>
              <Button onClick={share} disabled={!blob} className="min-h-[48px] w-full rounded-2xl border-[#398ca2] bg-[#398ca2] font-bold text-[#181619] hover:bg-[#398ca2]/90">
                <Share2 aria-hidden="true" />
                Compartir
              </Button>
              <p className="text-center text-[12.5px] text-[#a8a295]">En el panel que se abre, elige Instagram (Historia, Mensaje o Publicación).</p>
            </>
          )}
          <Button
            onClick={save}
            disabled={!blob}
            variant={canNativeShare ? 'outline' : 'default'}
            className={canNativeShare ? 'min-h-[48px] w-full rounded-2xl border-[#398ca2] bg-transparent text-[#fff8e4] hover:bg-[#398ca2]/15 hover:text-[#fff8e4]' : 'min-h-[48px] w-full rounded-2xl border-[#398ca2] bg-[#398ca2] font-bold text-[#181619] hover:bg-[#398ca2]/90'}
          >
            <Download aria-hidden="true" />
            Guardar imagen
          </Button>
          {!canNativeShare && blob && <p className="text-center text-[12.5px] text-[#a8a295]">Este dispositivo no abre el panel de compartir: guarda la imagen y súbela a Instagram desde tu galería.</p>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ShareAchievementDialog;
