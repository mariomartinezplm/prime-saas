import { useEffect, useState } from 'react';
import { CloudOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { BTN_FILL } from '@/components/dashboard/brand';
import { countPendingSets, flushPendingBatches, isRetryable } from '@/lib/pendingSets';
import { workoutService } from '@/services/workoutService';
import { cn } from '@/lib/utils';

interface PendingLogoutDialogProps {
  open: boolean;
  userId: string;
  onCancel: () => void; // volver a la app (sin cerrar sesión)
  onLeave: () => void; // cerrar sesión (ya sincronizado o aceptando perder lo pendiente)
}

// Aviso al cerrar sesión con series de entrenamiento SIN sincronizar. Nada se borra en silencio: se puede volver, intentar enviarlas
// o salir aceptando que esas series se borren de este dispositivo.
const PendingLogoutDialog = ({ open, userId, onCancel, onLeave }: PendingLogoutDialogProps) => {
  const [count, setCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    if (!open) return;
    setOffline(false);
    countPendingSets(userId).then(setCount);
  }, [open, userId]);

  const syncAndLeave = async () => {
    setSyncing(true);
    setOffline(false);
    const result = await flushPendingBatches(userId, (b) => workoutService.saveSets(b.sessionId, b.blockId, b.sets).then(() => undefined), isRetryable);
    setSyncing(false);
    const left = await countPendingSets(userId);
    setCount(left);
    if (left === 0) onLeave();
    else setOffline(result.sent === 0 || left > 0);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !syncing && onCancel()}>
      <DialogContent className="max-w-sm border-[#e8b4a0]/40 bg-[#1f1c21] text-[#fff8e4]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><CloudOff className="h-5 w-5 text-[#e8b4a0]" aria-hidden="true" />Tienes series sin sincronizar</DialogTitle>
          <DialogDescription className="text-[#cdc6b6]">
            {count} {count === 1 ? 'serie de entrenamiento todavía no llegó' : 'series de entrenamiento todavía no llegaron'} al servidor (por falta de conexión). Si cierras sesión ahora, <strong className="text-[#fff8e4]">se borrarán de este dispositivo y no se podrán recuperar</strong>.
          </DialogDescription>
        </DialogHeader>
        {offline && <p role="alert" className="rounded-xl border border-[#e8b4a0]/50 bg-[#e8b4a0]/10 p-2.5 text-[13px] text-[#fff8e4]">Todavía no hay conexión. Tus series siguen guardadas en este dispositivo; vuelve a intentarlo cuando tengas internet.</p>}
        <DialogFooter className="flex-col gap-2 sm:flex-col sm:space-x-0">
          <Button disabled={syncing} onClick={syncAndLeave} className={cn('min-h-[48px] w-full rounded-2xl font-bold', BTN_FILL)}>{syncing ? 'Sincronizando…' : 'Sincronizar y salir'}</Button>
          <Button variant="outline" disabled={syncing} onClick={onCancel} className="min-h-[48px] w-full rounded-2xl border-[#398ca2] bg-transparent text-[#fff8e4] hover:bg-[#398ca2]/15 hover:text-[#fff8e4]">Volver a la app</Button>
          <button type="button" disabled={syncing} onClick={onLeave} className="min-h-[44px] rounded-xl text-[13px] font-semibold text-[#e8b4a0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#fff8e4]">Salir igualmente y descartar {count === 1 ? 'la serie' : 'las series'}</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PendingLogoutDialog;
