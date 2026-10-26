import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Activity, ChevronRight, Ruler, Target } from 'lucide-react';
import BottomSheet from '@/components/premium/BottomSheet';
import { FormField } from '@/components/forms/FormField';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { BTN_FILL } from '@/components/dashboard/brand';
import { measurementService } from '@/services/measurementService';
import api from '@/lib/api';
import { DECIMAL_HELP, INVALID_NUMBER, parseDecimal } from '@/lib/decimal';
import { PERIMETER_LABELS, zoneById, zoneLabel } from '@/lib/bodyZones';
import { notify } from '@/lib/notify';
import { showApiError } from '@/lib/apiError';
import { cn } from '@/lib/utils';

interface ZoneSheetProps {
  zoneId: string;
  patientId: string;
  // Último dolor registrado en esta zona, si hay
  lastPain?: { level: number; date: string } | null;
  onClose: () => void;
  // El dolor quedó guardado (para actualizar el mapa)
  onPainSaved: (zoneId: string, level: number) => void;
  onMeasureSaved?: () => void;
}

const fieldInput = 'h-12 border-[#fff8e4]/40 bg-[#fff8e4]/[0.05] text-base text-[#fff8e4]';
const SECTION = 'space-y-3 rounded-2xl border border-[#fff8e4]/12 bg-[#fff8e4]/[0.03] p-4';

// Lo que se puede hacer con una zona del cuerpo: anotar su dolor (0 a 10), anotar su medida si es un músculo que se mide con cinta,
// ver su evolución o crear un objetivo con esa zona. Cada guardado dice la verdad: «guardado» solo después de que el servidor lo confirma.
const ZoneSheet = ({ zoneId, patientId, lastPain, onClose, onPainSaved, onMeasureSaved }: ZoneSheetProps) => {
  const zone = zoneById(zoneId);
  const [level, setLevel] = useState(lastPain?.level ?? 0);
  const [note, setNote] = useState('');
  const [savingPain, setSavingPain] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [savingMeasure, setSavingMeasure] = useState(false);
  const busy = useRef(false);

  const savePain = async () => {
    if (busy.current) return;
    busy.current = true;
    setSavingPain(true);
    try {
      await api.post('/eva', { patient: patientId, painLevel: level, bodyArea: zoneId, observations: note.trim() || undefined });
      notify.success('Dolor guardado');
      onPainSaved(zoneId, level);
      onClose();
    } catch (err) {
      showApiError(err, 'No se pudo guardar el dolor. Inténtalo de nuevo.');
    } finally {
      busy.current = false;
      setSavingPain(false);
    }
  };

  const fields = zone?.perimeter ?? [];
  const saveMeasure = async () => {
    if (busy.current) return;
    const next: Record<string, string> = {};
    const perimeters: Record<string, number> = {};
    for (const f of fields) {
      const raw = (values[f] ?? '').trim();
      if (!raw) continue;
      const n = parseDecimal(raw);
      if (n === INVALID_NUMBER) next[f] = DECIMAL_HELP;
      else if (n === null || n < 10 || n > 300) next[f] = 'Escribe la medida en centímetros (entre 10 y 300)';
      else perimeters[f] = n;
    }
    if (Object.keys(perimeters).length === 0 && Object.keys(next).length === 0) next[fields[0]] = 'Escribe la medida en centímetros';
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    busy.current = true;
    setSavingMeasure(true);
    try {
      await measurementService.create({ patient: patientId, date: new Date().toISOString(), perimeters });
      notify.success('Medida guardada');
      onMeasureSaved?.();
      onClose();
    } catch (err) {
      showApiError(err, 'No se pudo guardar la medida. Inténtalo de nuevo.');
    } finally {
      busy.current = false;
      setSavingMeasure(false);
    }
  };

  return (
    <BottomSheet open onOpenChange={(open) => !open && onClose()} title={zoneLabel(zoneId)} description={lastPain ? `Último dolor: ${lastPain.level} de 10` : 'Elige qué quieres anotar'}>
      <div className="space-y-4 pb-2 pt-1">
        <section aria-label="Registrar dolor" className={SECTION}>
          <h3 className="flex items-center gap-2 text-[15px] font-bold text-[#fff8e4]"><Activity className="h-4 w-4 text-[#8fd0e0]" aria-hidden="true" />¿Cuánto te duele hoy?</h3>
          <div className="flex items-end justify-between gap-3">
            <p className="text-[2.2rem] font-extrabold leading-none tabular-nums text-[#fff8e4]">{level}<span className="ml-1 text-lg font-bold text-[#fff8e4]/60">/ 10</span></p>
            <p className="max-w-[16ch] text-right text-[12px] leading-snug text-[#a8a295]">0 = nada de dolor<br />10 = el dolor más grande que has sentido</p>
          </div>
          <Slider aria-label="Nivel de dolor de 0 a 10" value={[level]} onValueChange={(v) => setLevel(v[0])} max={10} step={1} className="py-3" />
          <FormField label="Nota (opcional)">
            {(c) => <Input {...c} className={fieldInput} maxLength={200} placeholder="Ej. al subir escaleras" value={note} onChange={(e) => setNote(e.target.value)} />}
          </FormField>
          <Button type="button" onClick={savePain} disabled={savingPain} className={cn('min-h-[52px] w-full rounded-2xl text-base font-bold', BTN_FILL)}>{savingPain ? 'Guardando…' : 'Guardar dolor'}</Button>
        </section>

        {fields.length > 0 && (
          <section aria-label="Registrar medida" className={SECTION}>
            <h3 className="flex items-center gap-2 text-[15px] font-bold text-[#fff8e4]"><Ruler className="h-4 w-4 text-[#8fd0e0]" aria-hidden="true" />Medida con cinta</h3>
            {fields.map((f) => (
              <FormField key={f} label={`${PERIMETER_LABELS[f] ?? f} (cm)`} error={errors[f]}>
                {(c) => <Input {...c} className={fieldInput} type="text" inputMode="decimal" autoComplete="off" value={values[f] ?? ''} onChange={(e) => { setValues({ ...values, [f]: e.target.value }); setErrors({}); }} />}
              </FormField>
            ))}
            <Button type="button" variant="outline" onClick={saveMeasure} disabled={savingMeasure} className="min-h-[48px] w-full rounded-2xl border-[#398ca2] bg-transparent text-base font-bold text-[#fff8e4] hover:bg-[#398ca2]/15 hover:text-[#fff8e4]">{savingMeasure ? 'Guardando…' : 'Guardar medida'}</Button>
          </section>
        )}

        <div className="space-y-1">
          <Link to={`/app/objetivos/nuevo?zona=${encodeURIComponent(zoneId)}`} className="flex min-h-[48px] items-center justify-between gap-2 rounded-xl px-2 text-[14.5px] font-semibold text-[#8fd0e0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#fff8e4]">
            <span className="flex items-center gap-2"><Target className="h-4 w-4" aria-hidden="true" />Crear un objetivo con esta zona</span>
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Link>
          <Link to="/app/dolor" className="flex min-h-[48px] items-center justify-between gap-2 rounded-xl px-2 text-[14.5px] font-semibold text-[#cdc6b6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#fff8e4]">
            <span>Ver la evolución de mi dolor</span>
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </BottomSheet>
  );
};

export default ZoneSheet;
