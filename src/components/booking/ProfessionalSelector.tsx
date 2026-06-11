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
          <Card
            key={prof.id}
            className={cn(
              'cursor-pointer transition-all hover:border-secondary',
              selected?.id === prof.id && 'border-secondary bg-secondary/10'
            )}
            onClick={() => onSelect(prof)}
          >
            <CardContent className="p-4 text-center">
              <div className="w-12 h-12 rounded-full bg-secondary/20 flex items-center justify-center mx-auto mb-2">
                <UserIcon className="h-6 w-6 text-secondary" />
              </div>
              <p className="font-medium text-sm">{prof.firstName} {prof.lastName}</p>
              {prof.specialty && (
                <p className="text-xs text-muted-foreground mt-1">{prof.specialty}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default ProfessionalSelector;
