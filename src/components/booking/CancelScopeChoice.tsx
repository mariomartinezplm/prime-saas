import { cn } from '@/lib/utils';

export type CancelScope = 'this' | 'following';

interface CancelScopeChoiceProps {
  value: CancelScope;
  onChange: (scope: CancelScope) => void;
}

// Para citas de un horario fijo, como en Google Calendar: «solo esta» o «esta y las siguientes»
const CancelScopeChoice = ({ value, onChange }: CancelScopeChoiceProps) => {
  const options: Array<{ scope: CancelScope; title: string; hint: string }> = [
    { scope: 'this', title: 'Solo esta cita', hint: 'El horario fijo sigue y las demás semanas se mantienen.' },
    { scope: 'following', title: 'Esta y las siguientes', hint: 'Se cancelan también las próximas citas de este horario fijo y el horario se quita.' },
  ];
  return (
    <div className="space-y-2" role="radiogroup" aria-label="Qué citas cancelar">
      {options.map((o) => (
        <button
          key={o.scope}
          type="button"
          role="radio"
          aria-checked={value === o.scope}
          onClick={() => onChange(o.scope)}
          className={cn(
            'w-full rounded-lg border px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            value === o.scope ? 'border-secondary bg-secondary/10' : 'border-border hover:bg-accent/40'
          )}
        >
          <span className="block text-sm font-medium text-foreground">{o.title}</span>
          <span className="block text-xs text-muted-foreground">{o.hint}</span>
        </button>
      ))}
    </div>
  );
};

export default CancelScopeChoice;
