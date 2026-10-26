import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, Loader2, Trash2, TriangleAlert } from 'lucide-react';
import BottomSheet from '@/components/premium/BottomSheet';
import { Button } from '@/components/ui/button';
import { BTN_FILL } from '@/components/dashboard/brand';
import UserAvatar from '@/components/profile/UserAvatar';
import { useAuth } from '@/contexts/AuthContext';
import { avatarService } from '@/services/avatarService';
import { getErrorMessage } from '@/lib/apiError';
import { notify } from '@/lib/notify';
import { cn } from '@/lib/utils';
import {
  AVATAR_ACCEPT,
  AVATAR_MAX_ZOOM,
  AVATAR_OUTPUT_SIDE,
  AVATAR_VIEW_SIDE,
  avatarFileProblem,
  clampCrop,
  drawRect,
  type CropState,
} from '@/lib/avatarImage';

type Source = { image: CanvasImageSource; width: number; height: number; close?: () => void };

// Decodifica la foto en el propio navegador (sin subirla): respeta la orientación del celular y funciona sin URLs blob:
async function decode(file: File): Promise<Source> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
      return { image: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() };
    } catch {
      // se prueba el otro camino
    }
  }
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('decode'));
    img.src = dataUrl;
  });
  return { image: img, width: img.naturalWidth, height: img.naturalHeight };
}

const paint = (canvas: HTMLCanvasElement, source: Source, state: CropState, side: number) => {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  canvas.width = side;
  canvas.height = side;
  ctx.fillStyle = '#181619';
  ctx.fillRect(0, 0, side, side);
  const { dx, dy, dw, dh } = drawRect(state, source.width, source.height, side);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source.image, dx, dy, dw, dh);
};

// El navegador vuelve a codificar la foto: sale un JPEG de 512 × 512 sin EXIF ni ubicación
const toJpeg = (source: Source, state: CropState) =>
  new Promise<Blob>((resolve, reject) => {
    const canvas = document.createElement('canvas');
    paint(canvas, source, state, AVATAR_OUTPUT_SIDE);
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('encode'))), 'image/jpeg', 0.88);
  });

interface AvatarEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Cambiar, recortar y guardar la foto de perfil de la propia cuenta, o quitarla. El éxito se anuncia solo cuando el servidor lo confirma.
const AvatarEditor = ({ open, onOpenChange }: AvatarEditorProps) => {
  const { user, updateUser } = useAuth();
  const fileInput = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drag = useRef<{ id: number; x: number; y: number } | null>(null);
  const [source, setSource] = useState<Source | null>(null);
  const [crop, setCrop] = useState<CropState>({ zoom: 1, x: 0, y: 0 });
  const [reading, setReading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [error, setError] = useState<string>();

  const reset = useCallback(() => {
    setSource((current) => {
      current?.close?.();
      return null;
    });
    setCrop({ zoom: 1, x: 0, y: 0 });
    setError(undefined);
    setConfirmRemove(false);
  }, []);

  // Al cerrar se descarta lo elegido (nunca queda una foto a medias para la próxima vez)
  useEffect(() => {
    if (!open) reset();
  }, [open, reset]);

  useEffect(() => {
    if (source && canvasRef.current) paint(canvasRef.current, source, crop, AVATAR_VIEW_SIDE * 2);
  }, [source, crop]);

  if (!user) return null;
  const hasPhoto = !!user.avatarUpdatedAt;
  const busy = reading || saving || removing;

  const onPick = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = ''; // permite volver a elegir el mismo archivo
    if (!file) return; // canceló: no pasa nada
    const problem = avatarFileProblem(file);
    if (problem) {
      setError(problem);
      return;
    }
    setError(undefined);
    setReading(true);
    try {
      const decoded = await decode(file);
      if (decoded.width < 64 || decoded.height < 64) {
        decoded.close?.();
        setError('La foto es muy pequeña. Elige una de al menos 64 × 64 píxeles.');
        return;
      }
      setSource((current) => {
        current?.close?.();
        return decoded;
      });
      setCrop({ zoom: 1, x: 0, y: 0 });
    } catch {
      setError('No pudimos leer esa foto. Prueba con otra (JPG, PNG o WebP).');
    } finally {
      setReading(false);
    }
  };

  const move = (next: CropState) => source && setCrop(clampCrop(next, source.width, source.height));

  const onPointerDown = (event: React.PointerEvent) => {
    if (busy) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
  };
  const onPointerMove = (event: React.PointerEvent) => {
    const d = drag.current;
    if (!d || d.id !== event.pointerId) return;
    const scale = AVATAR_VIEW_SIDE / event.currentTarget.getBoundingClientRect().width;
    move({ ...crop, x: crop.x + (event.clientX - d.x) * scale, y: crop.y + (event.clientY - d.y) * scale });
    drag.current = { id: d.id, x: event.clientX, y: event.clientY };
  };
  const onPointerEnd = () => {
    drag.current = null;
  };
  const onKeyDown = (event: React.KeyboardEvent) => {
    const step = 12;
    const delta: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    const d = delta[event.key];
    if (!d) return;
    event.preventDefault();
    move({ ...crop, x: crop.x + d[0], y: crop.y + d[1] });
  };

  const save = async () => {
    if (!source || busy) return;
    setError(undefined);
    setSaving(true);
    try {
      const jpeg = await toJpeg(source, crop);
      const avatarUpdatedAt = await avatarService.upload(jpeg);
      updateUser({ ...user, avatarUpdatedAt }); // el menú y Mi perfil se actualizan con el mismo dato
      notify.success('Foto actualizada');
      onOpenChange(false);
    } catch (err) {
      // Se conserva el recorte para reintentar sin volver a elegir la foto
      setError(getErrorMessage(err, 'No se pudo guardar la foto. Revisa tu conexión e inténtalo de nuevo.'));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (busy) return;
    setError(undefined);
    setRemoving(true);
    try {
      await avatarService.remove();
      updateUser({ ...user, avatarUpdatedAt: undefined });
      notify.success('Foto quitada');
      onOpenChange(false);
    } catch (err) {
      setError(getErrorMessage(err, 'No se pudo quitar la foto. Inténtalo de nuevo.'));
      setConfirmRemove(false);
    } finally {
      setRemoving(false);
    }
  };

  return (
    <BottomSheet
      open={open}
      onOpenChange={(next) => (busy && !next ? undefined : onOpenChange(next))}
      title="Foto de perfil"
      description={source ? 'Arrastra para encuadrar y ajusta el zoom.' : 'Se ve en tu menú y en tu perfil.'}
    >
      <div className="space-y-4 pb-2 pt-1">
        <input ref={fileInput} type="file" accept={AVATAR_ACCEPT} onChange={onPick} className="sr-only" tabIndex={-1} aria-hidden="true" />

        {source ? (
          <div className="space-y-4">
            <div
              role="application"
              aria-label="Encuadre de la foto. Usa las flechas para moverla"
              tabIndex={0}
              onKeyDown={onKeyDown}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerEnd}
              onPointerCancel={onPointerEnd}
              className={cn(
                'relative mx-auto aspect-square w-full max-w-[256px] touch-none select-none overflow-hidden rounded-full border-2 border-[#398ca2]/70 bg-[#181619] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#fff8e4]',
                busy ? 'cursor-wait opacity-70' : 'cursor-grab active:cursor-grabbing'
              )}
            >
              <canvas ref={canvasRef} className="h-full w-full" />
              {saving && (
                <span className="absolute inset-0 flex items-center justify-center bg-[#181619]/55" role="status">
                  <Loader2 className="h-8 w-8 animate-spin text-[#fff8e4]" aria-hidden="true" />
                  <span className="sr-only">Guardando la foto</span>
                </span>
              )}
            </div>
            <label className="flex items-center gap-3 text-[13px] text-[#cdc6b6]">
              <span className="shrink-0">Zoom</span>
              <input
                type="range"
                min={1}
                max={AVATAR_MAX_ZOOM}
                step={0.01}
                value={crop.zoom}
                disabled={busy}
                aria-label="Zoom de la foto"
                onChange={(e) => move({ ...crop, zoom: Number(e.target.value) })}
                className="h-11 w-full accent-[#398ca2]"
              />
            </label>
          </div>
        ) : (
          <div className="flex justify-center py-2">
            <UserAvatar user={user} size="xl" className="h-32 w-32 text-4xl" />
          </div>
        )}

        {error && (
          <p role="alert" className="flex items-start gap-2 rounded-xl border border-[#e0a0a0]/40 bg-[#e0a0a0]/10 px-3 py-2.5 text-[13.5px] text-[#f1c9c9]">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </p>
        )}

        <div className="space-y-2">
          {source ? (
            <>
              <Button type="button" onClick={save} disabled={busy} className={cn('min-h-[52px] w-full rounded-2xl text-base font-bold', BTN_FILL)}>
                {saving ? 'Guardando…' : error ? 'Reintentar' : 'Guardar foto'}
              </Button>
              <Button type="button" variant="ghost" onClick={() => fileInput.current?.click()} disabled={busy} className="min-h-[48px] w-full text-[#cdc6b6] hover:bg-[#fff8e4]/[0.06] hover:text-[#fff8e4]">
                Elegir otra foto
              </Button>
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={busy} className="min-h-[44px] w-full text-[13px] text-[#a8a295] hover:bg-transparent hover:text-[#cdc6b6]">
                Cancelar
              </Button>
            </>
          ) : (
            <>
              <Button type="button" onClick={() => fileInput.current?.click()} disabled={busy} className={cn('min-h-[52px] w-full rounded-2xl text-base font-bold', BTN_FILL)}>
                {reading ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> : <Camera className="h-5 w-5" aria-hidden="true" />}
                {reading ? 'Abriendo foto…' : hasPhoto ? 'Cambiar foto' : 'Elegir foto'}
              </Button>
              {hasPhoto &&
                (confirmRemove ? (
                  <div className="flex gap-2">
                    <Button type="button" variant="ghost" onClick={() => setConfirmRemove(false)} disabled={busy} className="min-h-[48px] flex-1 text-[#cdc6b6] hover:bg-[#fff8e4]/[0.06] hover:text-[#fff8e4]">No, dejarla</Button>
                    <Button type="button" onClick={remove} disabled={busy} className="min-h-[48px] flex-1 rounded-2xl bg-[#e0a0a0] font-bold text-[#181619] hover:bg-[#e8b4b4]">
                      {removing ? 'Quitando…' : 'Sí, quitar'}
                    </Button>
                  </div>
                ) : (
                  <Button type="button" variant="ghost" onClick={() => setConfirmRemove(true)} disabled={busy} className="min-h-[48px] w-full text-[#cdc6b6] hover:bg-[#fff8e4]/[0.06] hover:text-[#fff8e4]">
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                    Quitar foto
                  </Button>
                ))}
              <p className="px-1 pt-1 text-center text-[12px] leading-relaxed text-[#a8a295]">Solo tú la cambias. Se guarda reducida y sin datos de ubicación.</p>
            </>
          )}
        </div>
      </div>
    </BottomSheet>
  );
};

export default AvatarEditor;

// Botón del avatar: abre el editor. Etiqueta accesible y señal visible (insignia de cámara), sin depender del hover.
export const AvatarButton = ({ onClick, children, className }: { onClick: () => void; children: React.ReactNode; className?: string }) => (
  <button
    type="button"
    onClick={onClick}
    aria-label="Cambiar foto de perfil"
    className={cn('group relative shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#fff8e4] focus-visible:ring-offset-2 focus-visible:ring-offset-[#181619]', className)}
  >
    {children}
    <span aria-hidden="true" className="absolute -bottom-0.5 -right-0.5 flex h-6 w-6 items-center justify-center rounded-full border-2 border-[#181619] bg-[#398ca2] text-[#181619]">
      <Camera className="h-3 w-3" />
    </span>
  </button>
);
