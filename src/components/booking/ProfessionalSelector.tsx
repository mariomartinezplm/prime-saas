import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { User as UserIcon } from 'lucide-react';
import type { User } from '@/types';

interface ProfessionalSelectorProps {
  professionals: User[];
  selected: User | null;
  onSelect: (professional: User) => void;
}

const ProfessionalSelector = ({ professionals, selected, onSelect }: ProfessionalSelectorProps) => {
  return (
    <div>
      <h2 className="text-lg font-semibold text-foreground mb-3">
        {professionals.length === 1 ? 'Tu Profesional Asignado' : 'Seleccionar Profesional'}
      </h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {professionals.map((prof) => (
          <button
            key={prof.id}
            type="button"
            aria-pressed={selected?.id === prof.id}
            onClick={() => onSelect(prof)}
            className="rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <Card
              className={cn(
                'h-full transition-colors hover:border-secondary',
                selected?.id === prof.id && 'border-secondary bg-secondary/10'
              )}
            >
              <CardContent className="p-4 text-center">
                <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-secondary/20">
                  <UserIcon className="h-6 w-6 text-secondary" aria-hidden="true" />
                </div>
                <p className="text-sm font-medium">{prof.firstName} {prof.lastName}</p>
                {prof.specialty && (
                  <p className="mt-1 text-xs text-muted-foreground">{prof.specialty}</p>
                )}
              </CardContent>
            </Card>
          </button>
        ))}
      </div>
    </div>
  );
};

export default ProfessionalSelector;
