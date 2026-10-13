import type { ReactNode } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface FormSectionProps {
  title: string;
  description?: string;
  children: ReactNode;
  // Clases de la rejilla interna (por defecto, dos columnas desde tablet)
  className?: string;
}

// Bloque de un formulario largo: título, ayuda opcional y sus campos.
const FormSection = ({ title, description, children, className }: FormSectionProps) => (
  <Card>
    <CardHeader>
      <CardTitle className="text-lg">{title}</CardTitle>
      {description && <CardDescription>{description}</CardDescription>}
    </CardHeader>
    <CardContent className={cn('grid gap-4 md:grid-cols-2', className)}>{children}</CardContent>
  </Card>
);

export default FormSection;
