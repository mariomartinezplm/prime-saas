import { useRef, useState } from 'react';
import { Cake } from 'lucide-react';
import BottomSheet from '@/components/premium/BottomSheet';
import { FormField } from '@/components/forms/FormField';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { BTN_FILL } from '@/components/dashboard/brand';
import { authService } from '@/services/authService';
import { showApiError } from '@/lib/apiError';
import { todayLocal } from '@/lib/evolutionDate';
import { notify } from '@/lib/notify';
import { birthDateError } from '@/lib/validation';
import { BIRTHDATE_SNOOZE_DAYS, type BirthdatePromptPref } from '@/lib/birthdatePrompt';
import { cn } from '@/lib/utils';
import type { User } from '@/types';

const key = (userId: string) => `prime.birthdate-prompt.${userId}`;
export const readBirthdatePref = (userId: string): BirthdatePromptPref => {
  try {
    return JSON.parse(localStorage.getItem(key(userId)) ?? '{}') as BirthdatePromptPref;
  } catch {
    return {};
  }
};
const writePref = (userId: string, pref: BirthdatePromptPref) => {
  try {
    localStorage.setItem(key(userId), JSON.stringify(pref));
  } catch {
    // sin almacenamiento: simplemente se vuelve a preguntar la próxima vez
  }
};

// Pregunta la fecha de nacimiento a quien no la tiene (de ahí sale el saludo de cumpleaños de su profesional).
const BirthdatePrompt = ({ userId, open, onClose, onSaved }: { userId: string; open: boolean; onClose: () => void; onSaved: (user: User) => void }) => {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  const later = () => {
    writePref(userId, { snoozedUntil: Date.now() + BIRTHDATE_SNOOZE_DAYS * 86400000 });
    onClose();
  };

  const save = async () => {
    if (savingRef.current) return;
    const problem = !value ? 'Ingresa tu fecha de nacimiento' : birthDateError(value, todayLocal());
    if (problem) {
      setError(problem);
      return;
    }
    savingRef.current = true;
    setSaving(true);
    try {
      const updated = await authService.updateProfile({ dateOfBirth: value });
      onSaved(updated);
      notify.success('Fecha de nacimiento guardada');
      onClose();
    } catch (err) {
      // Se conserva lo escrito para reintentar
      showApiError(err, 'No se pudo guardar tu fecha de nacimiento. Inténtalo de nuevo.');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  return (
    <BottomSheet open={open} onOpenChange={(o) => !o && later()} title="¿Cuándo es tu cumpleaños?" description="Así tu kinesiólogo puede saludarte ese día.">
      <div className="space-y-4 pb-2 pt-1">
        <span aria-hidden="true" className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[#398ca2]/45 bg-[#398ca2]/15 text-[#8fd0e0]"><Cake className="h-7 w-7" /></span>
        <FormField label="Fecha de nacimiento" required error={error}>
          {(c) => (
            <Input
              {...c}
              type="date"
              max={todayLocal()}
              autoComplete="bday"
              value={value}
              onChange={(e) => { setValue(e.target.value); setError(undefined); }}
              className="h-12 border-[#fff8e4]/40 bg-[#fff8e4]/[0.05] text-base text-[#fff8e4]"
            />
          )}
        </FormField>
        <div className="space-y-2">
          <Button type="button" onClick={save} disabled={saving} className={cn('min-h-[52px] w-full rounded-2xl text-base font-bold', BTN_FILL)}>{saving ? 'Guardando…' : 'Guardar'}</Button>
          <Button type="button" variant="ghost" onClick={later} disabled={saving} className="min-h-[48px] w-full text-[#cdc6b6] hover:bg-[#fff8e4]/[0.06] hover:text-[#fff8e4]">Más tarde</Button>
        </div>
      </div>
    </BottomSheet>
  );
};

export default BirthdatePrompt;
