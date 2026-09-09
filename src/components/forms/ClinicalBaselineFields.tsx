import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Loader2, Pencil } from 'lucide-react';
import { toast } from 'sonner';
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

  const age = dateOfBirth ? differenceInYears(new Date(), parseISO(dateOfBirth)) : null;

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({
        ...medicalInfo,
        heightCm: heightCm ? Number(heightCm) : undefined,
        baseWeightKg: baseWeightKg ? Number(baseWeightKg) : undefined,
        smoker,
      });
      toast.success('Datos actualizados');
      setEditing(false);
    } catch {
      toast.error('Error al guardar los datos');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setHeightCm(medicalInfo?.heightCm?.toString() || '');
    setBaseWeightKg(medicalInfo?.baseWeightKg?.toString() || '');
    setSmoker(!!medicalInfo?.smoker);
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="space-y-3 rounded-lg border border-border p-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Altura (cm)</Label>
            <Input type="number" min={0} value={heightCm} onChange={(e) => setHeightCm(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Peso base (kg)</Label>
            <Input type="number" min={0} step="0.1" value={baseWeightKg} onChange={(e) => setBaseWeightKg(e.target.value)} />
          </div>
        </div>
        <div className="flex items-center justify-between">
          <Label className="text-xs">Fuma</Label>
          <Switch checked={smoker} onCheckedChange={setSmoker} />
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
        <Button size="sm" variant="ghost" className="h-6 px-2" onClick={() => setEditing(true)}>
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
