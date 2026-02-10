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
import { Loader2, Stethoscope, Dumbbell, Info } from 'lucide-react';
import type { User } from '@/types';

interface PlanFormProps {
  patientId: string;
  onSuccess: () => void;
}

type PlanType = 'kinesiologia' | 'entrenamiento-2x' | 'entrenamiento-3x';

const planTypeConfig: Record<PlanType, { label: string; icon: string; description: string; color: string }> = {
  'kinesiologia': {
    label: 'Kinesiología',
    icon: '🏥',
    description: '10 sesiones totales. El paciente puede agendar cualquier día hasta completar su bono.',
    color: 'border-teal-400 bg-teal-50 text-teal-800'
  },
  'entrenamiento-2x': {
    label: 'Entrenamiento 2x/semana',
    icon: '💪',
    description: 'El paciente puede agendar máximo 2 veces por semana.',
    color: 'border-blue-400 bg-blue-50 text-blue-800'
  },
  'entrenamiento-3x': {
    label: 'Entrenamiento 3x/semana',
    icon: '🔥',
    description: 'El paciente puede agendar máximo 3 veces por semana.',
    color: 'border-purple-400 bg-purple-50 text-purple-800'
  }
};

const PlanForm = ({ patientId, onSuccess }: PlanFormProps) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [professionals, setProfessionals] = useState<User[]>([]);
  const [form, setForm] = useState({
    planType: 'kinesiologia' as PlanType,
    duration: 'mensual' as 'mensual' | 'trimestral' | 'semestral' | 'anual',
    totalSessions: '10',
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
        planType: form.planType,
        duration: form.planType === 'kinesiologia' ? undefined : form.duration,
        totalSessions: form.planType === 'kinesiologia' ? parseInt(form.totalSessions) : undefined,
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

  const selectedConfig = planTypeConfig[form.planType];

  return (
    <form onSubmit={handleSubmit}>
      <Card>
        <CardHeader><CardTitle className="text-lg">Asignar Plan</CardTitle></CardHeader>
        <CardContent className="space-y-5">
          {/* Selector de tipo de plan con cards visuales */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Tipo de Plan</Label>
            <div className="grid grid-cols-3 gap-3">
              {(Object.entries(planTypeConfig) as [PlanType, typeof planTypeConfig[PlanType]][]).map(([key, config]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setForm(prev => ({ ...prev, planType: key }))}
                  className={`p-3 rounded-lg border-2 text-left transition-all ${form.planType === key
                      ? config.color + ' shadow-md ring-2 ring-offset-1'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                >
                  <div className="text-xl mb-1">{config.icon}</div>
                  <p className="text-sm font-semibold">{config.label}</p>
                </button>
              ))}
            </div>
            {/* Descripción del plan seleccionado */}
            <div className={`flex items-start gap-2 p-3 rounded-lg border ${selectedConfig.color}`}>
              <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <p className="text-xs">{selectedConfig.description}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Duración (solo para entrenamiento) */}
            {form.planType !== 'kinesiologia' && (
              <div className="space-y-2">
                <Label>Duración del plan</Label>
                <Select value={form.duration} onValueChange={(v) => setForm(prev => ({ ...prev, duration: v as typeof form.duration }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mensual">Mensual (1 mes)</SelectItem>
                    <SelectItem value="trimestral">Trimestral (3 meses)</SelectItem>
                    <SelectItem value="semestral">Semestral (6 meses)</SelectItem>
                    <SelectItem value="anual">Anual (12 meses)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Total sesiones (solo para kinesiología) */}
            {form.planType === 'kinesiologia' && (
              <div className="space-y-2">
                <Label>Total de sesiones del bono</Label>
                <Select value={form.totalSessions} onValueChange={(v) => setForm(prev => ({ ...prev, totalSessions: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">5 sesiones</SelectItem>
                    <SelectItem value="10">10 sesiones</SelectItem>
                    <SelectItem value="15">15 sesiones</SelectItem>
                    <SelectItem value="20">20 sesiones</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label>Fecha de inicio</Label>
              <Input
                type="date"
                value={form.startDate}
                onChange={(e) => setForm(prev => ({ ...prev, startDate: e.target.value }))}
              />
            </div>
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

          <div className="space-y-2">
            <Label>Notas</Label>
            <Textarea
              value={form.notes}
              onChange={(e) => setForm(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="Observaciones adicionales sobre el plan..."
            />
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            {form.planType === 'kinesiologia'
              ? `Crear Bono de ${form.totalSessions} Sesiones`
              : `Crear Plan ${planTypeConfig[form.planType].label}`
            }
          </Button>
        </CardContent>
      </Card>
    </form>
  );
};

export default PlanForm;
