import { useEffect, useRef, useState } from 'react';
import type { BodyGoal, BodyGoalDirection } from '@/services/achievementService';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { FormField } from '@/components/forms/FormField';
import SubmitButton from '@/components/forms/SubmitButton';
import { useUnsavedChangesWarning } from '@/hooks/useUnsavedChangesWarning';

const MIN_KG = 0.5;
const MAX_KG = 100;
const NO_GOAL = 'none';

const GOAL_LABELS: Record<BodyGoalDirection, string> = {
  lose: 'Bajar de peso',
  gain: 'Subir de peso',
};

// "4", "4,5" o "4.5" (máximo un decimal) → número; cualquier otra cosa → null
const parseKg = (text: string): number | null => {
  const clean = text.trim().replace(',', '.');
  if (!/^\d+(\.\d)?$/.test(clean)) return null;
  const value = Number(clean);
  return value >= MIN_KG && value <= MAX_KG ? value : null;
};

const kgText = (kg: number | null) => (kg === null ? '' : String(kg).replace('.', ','));

interface BodyGoalFormProps {
  goal: BodyGoal;
  // Quién la completa: la persona ("mi", "tu") o su profesional ("su")
  audience: 'patient' | 'staff';
  // Guarda dirección + kg (o quita la meta con direction null). Si falla, debe lanzar el error (el aviso lo muestra quien llama)
  onSave: (changes: { direction: BodyGoalDirection | null; targetKg: number | null }) => Promise<void>;
  onToggleEnabled: (enabled: boolean) => Promise<void>;
  idPrefix: string;
}

// La persona decide si el peso es un objetivo suyo: elige bajar o subir Y escribe cuántos kg. Si no le interesa, deja
// "Sin meta" y no existe ningún trofeo de peso para ella. Se guarda con un botón (no al escribir).
const BodyGoalForm = ({ goal, audience, onSave, onToggleEnabled, idPrefix }: BodyGoalFormProps) => {
  const [direction, setDirection] = useState<string>(goal.direction ?? NO_GOAL);
  const [kg, setKg] = useState(kgText(goal.targetKg));
  const [kgError, setKgError] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState(false);
  const submittingRef = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);

  // Cuando el servidor confirma un cambio, el borrador se alinea con lo guardado
  useEffect(() => {
    setDirection(goal.direction ?? NO_GOAL);
    setKg(kgText(goal.targetKg));
    setKgError(undefined);
  }, [goal.direction, goal.targetKg]);

  const hasDirection = direction !== NO_GOAL;
  const parsed = parseKg(kg);
  const savedDirection = goal.direction ?? NO_GOAL;
  const dirty = direction !== savedDirection || (hasDirection && parsed !== goal.targetKg);
  useUnsavedChangesWarning(dirty && !saving);

  const complete = !!goal.direction && goal.targetKg !== null;
  const own = audience === 'patient';

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingRef.current) return;
    if (hasDirection && parsed === null) {
      setKgError(`Escribe cuántos kg (entre ${String(MIN_KG).replace('.', ',')} y ${MAX_KG}, con un decimal como máximo)`);
      requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
      return;
    }
    submittingRef.current = true;
    setSaving(true);
    try {
      await onSave({ direction: hasDirection ? (direction as BodyGoalDirection) : null, targetKg: hasDirection ? parsed : null });
    } catch {
      // quien llama ya avisó el error; el borrador se conserva para reintentar
    } finally {
      submittingRef.current = false;
      setSaving(false);
    }
  };

  const toggle = async (enabled: boolean) => {
    if (toggling) return;
    setToggling(true);
    try {
      await onToggleEnabled(enabled);
    } catch {
      // quien llama ya avisó el error
    } finally {
      setToggling(false);
    }
  };

  const verb = direction === 'gain' ? 'subir' : 'bajar';

  return (
    <div className="space-y-4">
      <form ref={formRef} onSubmit={submit} noValidate className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label={own ? 'Mi meta' : 'Meta'}>
            {(c) => (
              <Select
                value={direction}
                disabled={saving}
                onValueChange={(value) => {
                  setDirection(value);
                  setKgError(undefined);
                }}
              >
                <SelectTrigger id={c.id} aria-describedby={c['aria-describedby']}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_GOAL}>Sin meta</SelectItem>
                  {(Object.keys(GOAL_LABELS) as BodyGoalDirection[]).map((d) => (
                    <SelectItem key={d} value={d}>
                      {GOAL_LABELS[d]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </FormField>

          {hasDirection && (
            <FormField
              label={`¿Cuántos kg quieres ${verb}?`}
              required
              error={kgError}
              hint={`Escribe tu propia meta, entre ${String(MIN_KG).replace('.', ',')} y ${MAX_KG} kg.`}
            >
              {(c) => (
                <Input
                  {...c}
                  inputMode="decimal"
                  autoComplete="off"
                  value={kg}
                  disabled={saving}
                  placeholder="Ej: 4"
                  onChange={(e) => {
                    setKg(e.target.value);
                    setKgError(undefined);
                  }}
                />
              )}
            </FormField>
          )}
        </div>

        <SubmitButton loading={saving} loadingLabel="Guardando…" disabled={!dirty}>
          {hasDirection || !goal.direction ? 'Guardar meta' : 'Quitar meta'}
        </SubmitButton>
      </form>

      {complete && (
        <div className="flex items-center justify-between gap-4 border-t border-border pt-4">
          <Label htmlFor={`${idPrefix}-enabled`} className="cursor-pointer">
            {own ? 'Reconocer mi evolución' : 'Reconocer su evolución'}
          </Label>
          <Switch id={`${idPrefix}-enabled`} checked={goal.enabled} disabled={toggling} onCheckedChange={toggle} />
        </div>
      )}

      {goal.direction && goal.targetKg === null && (
        <p className="text-xs text-muted-foreground">
          {own ? 'Falta escribir cuántos kg para activar tu meta.' : 'Falta indicar cuántos kg para activar la meta.'}
        </p>
      )}
    </div>
  );
};

export default BodyGoalForm;
