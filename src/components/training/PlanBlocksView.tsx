import { KIND_TITLE } from '@/lib/workoutPlan';
import { attributeChips, describeSet } from '@/lib/exerciseAttributes';
import { blockLetter } from '@/lib/trainingPlan';
import type { PlanBlock } from '@/services/trainingPlanService';

// Lo planificado, de solo lectura: «Bloque A · Individual — Sentadilla · 3 series × 10 rep · 55 kg totales». Lo usan el profesional
// (sus preparaciones) y el paciente (lo que su kinesiólogo le dejó). Cada ejercicio muestra implemento y ejecución.
const PlanBlocksView = ({ blocks }: { blocks: PlanBlock[] }) => (
  <ul className="space-y-3">
    {blocks.map((b, i) => (
      <li key={b.blockId ?? i}>
        <p className="text-[11.5px] font-bold uppercase tracking-[0.12em] text-[#8fd0e0]">Bloque {blockLetter(i)} · {KIND_TITLE[b.kind]}</p>
        <ul className="mt-1 space-y-1.5">
          {b.slots.map((s, j) => (
            <li key={j} className="text-[14.5px]">
              <span className="font-bold text-[#fff8e4]">{s.exerciseName}</span>
              {attributeChips(s).length > 0 && <span className="ml-2 text-[12px] text-[#8fd0e0]">{attributeChips(s).join(' · ')}</span>}
              <span className="block text-[13px] tabular-nums text-[#cdc6b6]">
                {s.groups.map((g) => describeSet({ ...g, implement: s.implement, execution: undefined })).join('  +  ')}
              </span>
              {s.note && <span className="block text-[12.5px] italic text-[#a8a295]">{s.note}</span>}
            </li>
          ))}
        </ul>
      </li>
    ))}
  </ul>
);

export default PlanBlocksView;
