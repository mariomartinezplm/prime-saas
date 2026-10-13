import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { NumberField } from '@/components/forms/FormField';
import { numberRangeError } from '@/lib/validation';
import { showApiError } from '@/lib/apiError';
import { Switch } from '@/components/ui/switch';
import { Loader2, Pencil } from 'lucide-react';
import { notify } from '@/lib/notify';
import { differenceInYears, parseISO } from 'date-fns';
import type { MedicalInfo } from '@/types';

interface ClinicalBaselineFieldsProps {
  medicalInfo?: MedicalInfo;
  dateOfBirth?: string;
  // Recibe el medicalInfo completo ya combinado (arrays existentes intactos +
  // los 3 campos nuevos) — quien guarda es responsable de no pisar el resto.
  onSave: (medicalInfo: MedicalInfo) => Promise<void>;
}

// Editable solo para heightCm/baseWeightKg/smoker (Paso 25 de BLUEPRINT.md) —
// el resto de medicalInfo (condiciones, alergias, etc.) sigue siendo de solo
// lectura en esta pantalla, sin cambios.
const ClinicalBaselineFields = ({ medicalInfo, dateOfBirth, onSave }: ClinicalBaselineFieldsProps) => {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [heightCm, setHeightCm] = useState(medicalInfo?.heightCm?.toString() || '');
  const [baseWeightKg, setBaseWeightKg] = useState(medicalInfo?.baseWeightKg?.toString() || '');
  const [smoker, setSmoker] = useState(!!medicalInfo?.smoker);
  const [errors, setErrors] = useState<{ heightCm?: string; baseWeightKg?: string }>({});
  const savingRef = useRef(false);

  const age = dateOfBirth ? differenceInYears(new Date(), parseISO(dateOfBirth.slice(0, 10))) : null;

  const handleSave = async () => {
    if (savingRef.current) return;
    const found = {
      heightCm: numberRangeError(heightCm, 50, 250, ' cm'),
      baseWeightKg: numberRangeError(baseWeightKg, 20, 400, ' kg'),
    };
    if (found.heightCm || found.baseWeightKg) {
      setErrors(found);
      return;
    }
    savingRef.current = true;
    setSaving(true);
    try {
      await onSave({
        ...medicalInfo,
        heightCm: heightCm ? Number(heightCm.replace(',', '.')) : undefined,
        baseWeightKg: baseWeightKg ? Number(baseWeightKg.replace(',', '.')) : undefined,
        smoker,
      });
      notify.success('Datos actualizados');
      setEditing(false);
    } catch (err) {
      showApiError(err, 'No se pudieron guardar los datos. Lo escrito sigue aquí.');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setHeightCm(medicalInfo?.heightCm?.toString() || '');
    setBaseWeightKg(medicalInfo?.baseWeightKg?.toString() || '');
    setSmoker(!!medicalInfo?.smoker);
    setErrors({});
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="space-y-3 rounded-lg border border-border p-3">
        <div className="grid grid-cols-2 gap-3">
          <NumberField label="Altura" unit="cm" step="1" value={heightCm} onChange={(v) => { setHeightCm(v); setErrors((p) => ({ ...p, heightCm: undefined })); }} error={errors.heightCm} />
          <NumberField label="Peso base" unit="kg" step="0.1" value={baseWeightKg} onChange={(v) => { setBaseWeightKg(v); setErrors((p) => ({ ...p, baseWeightKg: undefined })); }} error={errors.baseWeightKg} />
        </div>
        <div className="flex items-center justify-between">
          <Label htmlFor="baseline-smoker" className="text-xs">Fuma</Label>
          <Switch id="baseline-smoker" checked={smoker} onCheckedChange={setSmoker} />
        </div>
        <div className="flex gap-2 pt-1">
          <Button size="sm" variant="outline" onClick={handleCancel} disabled={saving}>Cancelar</Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
            Guardar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">Datos clínicos base</span>
        <Button size="sm" variant="ghost" className="-mr-2" onClick={() => setEditing(true)}>
          <Pencil className="h-3 w-3 mr-1" />
          Editar
        </Button>
      </div>
      <div className="flex justify-between"><span className="text-muted-foreground">Edad</span><span>{age !== null ? `${age} años` : '-'}</span></div>
      <div className="flex justify-between"><span className="text-muted-foreground">Altura</span><span>{medicalInfo?.heightCm ? `${medicalInfo.heightCm} cm` : '-'}</span></div>
      <div className="flex justify-between"><span className="text-muted-foreground">Peso base</span><span>{medicalInfo?.baseWeightKg ? `${medicalInfo.baseWeightKg} kg` : '-'}</span></div>
      <div className="flex justify-between"><span className="text-muted-foreground">Fuma</span><span>{medicalInfo?.smoker ? 'Sí' : 'No'}</span></div>
    </div>
  );
};

export default ClinicalBaselineFields;
