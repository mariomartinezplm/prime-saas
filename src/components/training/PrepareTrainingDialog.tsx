import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, ClipboardList, Copy, History, Plus, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import SubmitButton from '@/components/forms/SubmitButton';
import ExercisePicker from '@/components/forms/ExercisePicker';
import SlotEditor from '@/components/workout/SlotEditor';
import { exerciseService, type ExerciseSummary, type LibraryExercise } from '@/services/exerciseService';
import { trainingPlanService, type LastSession, type TrainingPlan } from '@/services/trainingPlanService';
import { KIND_TITLE, newGroup, newId, type DraftBlock, type DraftSlot } from '@/lib/workoutPlan';
import { addBlock, blockLetter, draftFromPlan, duplicateBlock, moveBlock, planBlocksFromDraft, prepProblem, removeBlock } from '@/lib/trainingPlan';
import { coerceAttributes, describeSet, type Modality } from '@/lib/exerciseAttributes';
import { todayLocal } from '@/lib/evolutionDate';
import { notify } from '@/lib/notify';
import { showApiError } from '@/lib/apiError';
import { cn } from '@/lib/utils';

interface PrepareTrainingDialogProps {
  patientId: string;
  patientName?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Si viene, se corrige esa preparación en vez de crear una nueva
  plan?: TrainingPlan | null;
  onSaved: () => void;
}

const longDay = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('es-CL', { day: 'numeric', month: 'long' });

// «Preparar entrenamiento»: el profesional deja armado lo que el paciente va a hacer. Es lo PLANIFICADO: no cuenta como sesión
// realizada, no descuenta sesiones, no marca asistencia ni genera récords. Los mismos tres formatos del entrenamiento en curso
// (individual, superserie, triserie) y los mismos tres selectores (modalidad, ejecución, implemento).
const PrepareTrainingDialog = ({ patientId, patientName, open, onOpenChange, plan, onSaved }: PrepareTrainingDialogProps) => {
  const [blocks, setBlocks] = useState<DraftBlock[]>([]);
  const [forDate, setForDate] = useState(todayLocal());
  const [title, setTitle] = useState('');
  const [visible, setVisible] = useState(true);
  const [internalNotes, setInternalNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [tried, setTried] = useState(false);
  const [last, setLast] = useState<LastSession | null>(null);
  const [reused, setReused] = useState(false);
  const [options, setOptions] = useState<ExerciseSummary[]>([]);
  const [library, setLibrary] = useState<LibraryExercise[]>([]);
  // Misma clave en los reintentos de un mismo guardado: no se duplica la preparación
  const clientId = useRef(newId());
  const isEdit = !!plan;

  // Al abrir: parte del estado de la preparación que se corrige, o vacío
  useEffect(() => {
    if (!open) return;
    clientId.current = newId();
    setTried(false);
    setBlocks(plan ? draftFromPlan(plan.blocks) : []);
    setForDate(plan?.forDate ?? todayLocal());
    setTitle(plan?.title ?? '');
    setVisible(plan?.visibleToPatient !== false);
    setInternalNotes(plan?.internalNotes ?? '');
    setLast(null);
    setReused(false);
    exerciseService.getSummary(patientId).then(setOptions).catch(() => setOptions([]));
    exerciseService.getLibrary().then(setLibrary).catch(() => setLibrary([]));
    if (!plan) trainingPlanService.lastSession(patientId).then(setLast).catch(() => setLast(null));
  }, [open, plan, patientId]);

  const problem = useMemo(() => prepProblem(blocks), [blocks]);
  const lastExercises = last ? last.blocks.reduce((n, b) => n + b.slots.length, 0) : 0;

  const patchBlock = (blockId: string, change: (b: DraftBlock) => DraftBlock) => setBlocks((prev) => prev.map((b) => (b.blockId === blockId ? change(b) : b)));
  const patchSlot = (blockId: string, index: number, slot: DraftSlot) => patchBlock(blockId, (b) => ({ ...b, slots: b.slots.map((s, i) => (i === index ? slot : s)) }));

  // Elegir un ejercicio de la lista: toma cómo se mide y cómo lo hizo la última vez (implemento y ejecución) y parte de sus valores
  const pick = (blockId: string, index: number, o: ExerciseSummary | LibraryExercise) => {
    const lastRec = 'last' in o ? o.last : null;
    const modality = (lastRec?.modality as Modality | null | undefined) ?? (lastRec?.durationSec ? 'time' : lastRec?.weight ? 'weight' : lastRec && lastRec.reps ? 'bodyweight' : 'weight');
    const attrs = coerceAttributes(modality, { execution: lastRec?.execution ?? null, eccentricSec: lastRec?.eccentricSec ?? null, implement: lastRec?.implement ?? null });
    const group = newGroup(modality, lastRec ? { reps: lastRec.reps, weight: lastRec.weight, durationSec: lastRec.durationSec ?? null, weightUnit: lastRec.weightUnit } : null);
    patchBlock(blockId, (b) => ({
      ...b,
      slots: b.slots.map((s, i) => (i === index ? { name: o.name, modality, execution: attrs.execution ?? undefined, eccentricSec: attrs.eccentricSec ?? undefined, implement: attrs.implement ?? undefined, note: s.note, groups: [group] } : s)),
    }));
  };

  const reuseLast = () => {
    if (!last) return;
    const copied = draftFromPlan(last.blocks);
    setBlocks((prev) => [...prev, ...copied]);
    setReused(true); // ya está copiada: el botón no se ofrece de nuevo (evita duplicar sin querer)
    notify.success(`Se copiaron ${lastExercises} ${lastExercises === 1 ? 'ejercicio' : 'ejercicios'} de la última sesión. Es una preparación: no cuenta como realizada.`);
  };

  const save = async () => {
    setTried(true);
    if (problem) return;
    setSaving(true);
    try {
      const input = { forDate, ...(title.trim() ? { title: title.trim() } : {}), blocks: planBlocksFromDraft(blocks), visibleToPatient: visible, ...(internalNotes.trim() ? { internalNotes: internalNotes.trim() } : {}) };
      if (plan) await trainingPlanService.update(plan.id, input);
      else await trainingPlanService.create(patientId, { ...input, clientId: clientId.current });
      notify.success('Preparación guardada');
      onOpenChange(false);
      onSaved();
    } catch (err) {
      showApiError(err, 'No se pudo guardar la preparación. Tus datos siguen aquí.');
    } finally {
      setSaving(false);
    }
  };

  const iconBtn = 'flex h-11 w-11 items-center justify-center rounded-xl text-[#cdc6b6] hover:bg-[#fff8e4]/[0.06] disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#fff8e4]';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><ClipboardList className="h-5 w-5 text-[#8fd0e0]" aria-hidden="true" />{isEdit ? 'Corregir preparación' : 'Preparar entrenamiento'}{patientName ? ` · ${patientName}` : ''}</DialogTitle>
          <DialogDescription>Lo que dejes aquí es lo <b>planificado</b>: no cuenta como sesión realizada, no descuenta sesiones ni suma a los gráficos.</DialogDescription>
        </DialogHeader>

        <form noValidate onSubmit={(e) => { e.preventDefault(); void save(); }} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-[200px_1fr]">
            <label className="block text-sm font-medium">Día de la sesión
              <Input type="date" value={forDate} onChange={(e) => setForDate(e.target.value)} className="mt-1" />
            </label>
            <label className="block text-sm font-medium">Título (opcional)
              <Input type="text" maxLength={80} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej: Fuerza tren inferior" className="mt-1" />
            </label>
          </div>

          {!isEdit && last && lastExercises > 0 && !reused && (
            <section aria-label="Última sesión registrada" className="rounded-2xl border border-[#62b8cf]/35 bg-[#398ca2]/10 p-3.5">
              <p className="flex items-center gap-2 text-[13px] font-bold uppercase tracking-[0.12em] text-[#8fd0e0]"><History className="h-4 w-4" aria-hidden="true" />Última sesión registrada · {longDay(last.date)}</p>
              <ul className="mt-2 space-y-0.5 text-[14px]">
                {last.blocks.flatMap((b) => b.slots).slice(0, 6).map((s, i) => (
                  <li key={i} className="flex flex-wrap gap-x-2"><span className="font-semibold">{s.exerciseName}</span><span className="text-muted-foreground">{describeSet({ ...s.groups[0], sets: undefined, ...s })}</span></li>
                ))}
                {lastExercises > 6 && <li className="text-muted-foreground">y {lastExercises - 6} más</li>}
              </ul>
              <Button type="button" onClick={reuseLast} className="mt-3 min-h-[44px]"><Copy className="h-4 w-4" aria-hidden="true" />Reutilizar ejercicios</Button>
              <p className="mt-1.5 text-xs text-muted-foreground">Se copian como preparación editable: no se agregan a los gráficos hasta que se registren como realizados.</p>
            </section>
          )}

          {blocks.length === 0 && (
            <p className="rounded-2xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">Aún no hay ejercicios. {last && lastExercises > 0 && !reused ? 'Reutiliza la última sesión o ' : ''}agrega un bloque.</p>
          )}

          <div className="space-y-3">
            {blocks.map((block, bi) => (
              <section key={block.blockId} aria-label={`Bloque ${blockLetter(bi)}`} className="overflow-hidden rounded-[20px] border border-[#fff8e4]/12 bg-[#1f1c21]">
                <div className="flex items-center justify-between gap-2 border-b border-[#fff8e4]/10 px-3 py-1.5">
                  <p className="text-[13px] font-extrabold uppercase tracking-[0.12em] text-[#8fd0e0]">Bloque {blockLetter(bi)} · {KIND_TITLE[block.kind]}</p>
                  <div className="flex">
                    <button type="button" className={iconBtn} aria-label={`Subir el bloque ${blockLetter(bi)}`} disabled={bi === 0} onClick={() => setBlocks((p) => moveBlock(p, block.blockId, -1))}><ArrowUp className="h-4 w-4" aria-hidden="true" /></button>
                    <button type="button" className={iconBtn} aria-label={`Bajar el bloque ${blockLetter(bi)}`} disabled={bi === blocks.length - 1} onClick={() => setBlocks((p) => moveBlock(p, block.blockId, 1))}><ArrowDown className="h-4 w-4" aria-hidden="true" /></button>
                    <button type="button" className={iconBtn} aria-label={`Duplicar el bloque ${blockLetter(bi)}`} onClick={() => setBlocks((p) => duplicateBlock(p, block.blockId))}><Copy className="h-4 w-4" aria-hidden="true" /></button>
                    <button type="button" className={cn(iconBtn, 'hover:text-[#e8b4a0]')} aria-label={`Eliminar el bloque ${blockLetter(bi)}`} onClick={() => setBlocks((p) => removeBlock(p, block.blockId))}><Trash2 className="h-4 w-4" aria-hidden="true" /></button>
                  </div>
                </div>
                <div className="space-y-3.5 px-3.5 py-3">
                  {block.slots.map((slot, i) => (
                    <div key={i} className={cn(block.slots.length > 1 && i < block.slots.length - 1 && 'border-b border-[#fff8e4]/10 pb-4')}>
                      <SlotEditor
                        slot={slot}
                        badge={block.slots.length > 1 ? `${bi + 1}.${i + 1}` : String(bi + 1)}
                        showErrors={tried}
                        onChange={(s) => patchSlot(block.blockId, i, s)}
                        onPick={() => undefined}
                        weightOptional
                        allowNote
                        nameControl={
                          <ExercisePicker
                            control={{ id: `prep-${block.blockId}-${i}`, 'aria-label': `Ejercicio ${i + 1} del bloque ${blockLetter(bi)}`, placeholder: 'Buscar o escribir un ejercicio' }}
                            value={slot.name ?? ''}
                            onChange={(text) => patchSlot(block.blockId, i, { ...slot, name: text.trim() === '' ? null : text })}
                            options={options}
                            library={library}
                            onPick={(o) => pick(block.blockId, i, o)}
                          />
                        }
                      />
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>

          <div role="group" aria-label="Agregar un bloque" className="grid grid-cols-3 gap-2">
            {(['single', 'super', 'tri'] as const).map((kind) => (
              <Button key={kind} type="button" variant="outline" className="min-h-[48px]" onClick={() => setBlocks((p) => addBlock(p, kind))}>
                <Plus className="h-4 w-4" aria-hidden="true" />{KIND_TITLE[kind]}
              </Button>
            ))}
          </div>

          <div className="flex items-start justify-between gap-4 rounded-xl border border-border p-3">
            <div className="space-y-1">
              <label htmlFor="prep-visible" className="text-sm font-medium">Visible para el paciente</label>
              <p className="text-xs text-muted-foreground">Si está activado, el paciente la ve como «planificado» (puede cargarla en su entrenamiento, sin obligación). Si no, queda solo para el equipo.</p>
            </div>
            <Switch id="prep-visible" checked={visible} onCheckedChange={setVisible} />
          </div>

          <label className="block text-sm font-medium">Notas internas (el paciente nunca las ve)
            <Textarea maxLength={1000} value={internalNotes} onChange={(e) => setInternalNotes(e.target.value)} className="mt-1" />
          </label>

          {tried && problem && <p role="alert" className="text-sm font-semibold text-destructive">{problem}.</p>}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="min-h-[48px]">Cancelar</Button>
            <SubmitButton loading={saving} loadingLabel="Guardando…" className="min-h-[48px]">Guardar preparación</SubmitButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default PrepareTrainingDialog;
