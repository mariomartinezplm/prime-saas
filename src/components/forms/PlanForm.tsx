import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { userService } from '@/services/userService';
import { planService } from '@/services/planService';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import type { User } from '@/types';

interface PlanFormProps {
  patientId: string;
  onSuccess: () => void;
}

const PlanForm = ({ patientId, onSuccess }: PlanFormProps) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [professionals, setProfessionals] = useState<User[]>([]);
  const [form, setForm] = useState({
    type: 'mensual' as 'mensual' | 'trimestral' | 'semestral' | 'anual',
    sessionsPerWeek: '3',
    startDate: new Date().toISOString().split('T')[0],
    professional: user?.id || '',
    notes: '',
  });

  useEffect(() => {
    const fetchProfessionals = async () => {
      try {
        const [admins, profs] = await Promise.all([
          userService.getAll({ role: 'admin' }),
          userService.getAll({ role: 'professional' }),
        ]);
        setProfessionals([...admins.users, ...profs.users]);
      } catch {
        // ignore
      }
    };
    fetchProfessionals();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await planService.create({
        patient: patientId,
        professional: form.professional,
        type: form.type,
        sessionsPerWeek: parseInt(form.sessionsPerWeek),
        startDate: form.startDate,
        notes: form.notes || undefined,
      });
      toast.success('Plan creado exitosamente');
      onSuccess();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      toast.error(error.response?.data?.message || 'Error al crear plan');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <Card>
        <CardHeader><CardTitle className="text-lg">Asignar Plan</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tipo de plan</Label>
              <Select value={form.type} onValueChange={(v) => setForm(prev => ({ ...prev, type: v as typeof form.type }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="mensual">Mensual (1 mes)</SelectItem>
                  <SelectItem value="trimestral">Trimestral (3 meses)</SelectItem>
                  <SelectItem value="semestral">Semestral (6 meses)</SelectItem>
                  <SelectItem value="anual">Anual (12 meses)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Sesiones por semana</Label>
              <Select value={form.sessionsPerWeek} onValueChange={(v) => setForm(prev => ({ ...prev, sessionsPerWeek: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                    <SelectItem key={n} value={String(n)}>{n} sesión{n > 1 ? 'es' : ''}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Fecha de inicio</Label>
              <Input
                type="date"
                value={form.startDate}
                onChange={(e) => setForm(prev => ({ ...prev, startDate: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Profesional asignado</Label>
              <Select value={form.professional} onValueChange={(v) => setForm(prev => ({ ...prev, professional: v }))}>
                <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent>
                  {professionals.map((prof) => (
                    <SelectItem key={prof.id} value={prof.id}>
                      {prof.firstName} {prof.lastName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Notas</Label>
            <Textarea
              value={form.notes}
              onChange={(e) => setForm(prev => ({ ...prev, notes: e.target.value }))}
            />
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Crear Plan
          </Button>
        </CardContent>
      </Card>
    </form>
  );
};

export default PlanForm;
