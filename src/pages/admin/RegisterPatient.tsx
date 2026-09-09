import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { userService } from '@/services/userService';
import { clientPlanService } from '@/services/clientPlanService';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PLAN_CATALOG, SERVICE_TYPE_LABELS, type ServiceType } from '@/config/planCatalog';
import { toast } from 'sonner';
import { Loader2, Dumbbell, Stethoscope, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

const KINESIOLOGIA_SESSIONS_FIJAS = 10;

type PlanInicialOption = ServiceType | 'despues';

const RegisterPatient = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [planInicial, setPlanInicial] = useState<PlanInicialOption>('despues');
  const [sessionsTotal, setSessionsTotal] = useState<number>(PLAN_CATALOG.entrenamiento[0]);
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    rut: '',
    dateOfBirth: '',
    address: '',
    emergencyName: '',
    emergencyPhone: '',
    emergencyRelationship: '',
    chronicConditions: '',
    allergies: '',
    injuries: '',
  });

  const handleChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      // Paso 12/13: ya no se pide contraseña — la cuenta nace inutilizable y
      // el paciente recibe una invitación por email para elegir la suya.
      const nuevoPaciente = await userService.create({
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        phone: form.phone || undefined,
        rut: form.rut || undefined,
        dateOfBirth: form.dateOfBirth || undefined,
        address: form.address || undefined,
        role: 'patient',
        emergencyContact: form.emergencyName ? {
          name: form.emergencyName,
          phone: form.emergencyPhone,
          relationship: form.emergencyRelationship,
        } : undefined,
        medicalInfo: {
          chronicConditions: form.chronicConditions ? form.chronicConditions.split(',').map(s => s.trim()) : [],
          allergies: form.allergies ? form.allergies.split(',').map(s => s.trim()) : [],
          injuries: form.injuries ? form.injuries.split(',').map(s => s.trim()) : [],
        },
      });

      if (planInicial === 'despues') {
        toast.success('Paciente registrado. Le llegará un correo para crear su contraseña.');
      } else {
        try {
          await clientPlanService.create({
            patientId: nuevoPaciente.id,
            serviceType: planInicial,
            sessionsTotal: planInicial === 'kinesiologia' ? KINESIOLOGIA_SESSIONS_FIJAS : sessionsTotal,
          });
          toast.success('Paciente registrado con su plan inicial. Le llegará un correo para crear su contraseña.');
        } catch {
          toast.warning('Paciente registrado, pero no se pudo asignar el plan inicial. Puedes asignarlo después desde Planes.');
        }
      }

      navigate('/app/admin/pacientes');
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      toast.error(error.response?.data?.message || 'Error al registrar paciente');
    } finally {
      setLoading(false);
    }
  };

  const handlePlanInicialChange = (option: PlanInicialOption) => {
    setPlanInicial(option);
    if (option === 'entrenamiento') setSessionsTotal(PLAN_CATALOG.entrenamiento[0]);
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Registrar Paciente</h1>
        <p className="text-muted-foreground">Ingresa los datos del nuevo paciente</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader><CardTitle className="text-lg">Datos Personales</CardTitle></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Nombre *</Label>
              <Input required value={form.firstName} onChange={(e) => handleChange('firstName', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Apellido *</Label>
              <Input required value={form.lastName} onChange={(e) => handleChange('lastName', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Email *</Label>
              <Input type="email" required value={form.email} onChange={(e) => handleChange('email', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>RUT</Label>
              <Input value={form.rut} onChange={(e) => handleChange('rut', e.target.value)} placeholder="12.345.678-9" />
            </div>
            <div className="space-y-2">
              <Label>Teléfono</Label>
              <Input value={form.phone} onChange={(e) => handleChange('phone', e.target.value)} placeholder="+56912345678" />
            </div>
            <div className="space-y-2">
              <Label>Fecha de Nacimiento</Label>
              <Input type="date" value={form.dateOfBirth} onChange={(e) => handleChange('dateOfBirth', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Dirección</Label>
              <Input value={form.address} onChange={(e) => handleChange('address', e.target.value)} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-lg">Contacto de Emergencia</CardTitle></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Nombre</Label>
              <Input value={form.emergencyName} onChange={(e) => handleChange('emergencyName', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Teléfono</Label>
              <Input value={form.emergencyPhone} onChange={(e) => handleChange('emergencyPhone', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Relación</Label>
              <Input value={form.emergencyRelationship} onChange={(e) => handleChange('emergencyRelationship', e.target.value)} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-lg">Información Médica</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Condiciones crónicas (separadas por coma)</Label>
              <Textarea value={form.chronicConditions} onChange={(e) => handleChange('chronicConditions', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Alergias (separadas por coma)</Label>
              <Textarea value={form.allergies} onChange={(e) => handleChange('allergies', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Lesiones (separadas por coma)</Label>
              <Textarea value={form.injuries} onChange={(e) => handleChange('injuries', e.target.value)} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-lg">Plan inicial</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => handlePlanInicialChange('kinesiologia')}
                className={cn(
                  'p-3 rounded-lg border-2 text-left transition-all',
                  planInicial === 'kinesiologia' ? 'border-secondary bg-secondary/10 shadow-sm' : 'border-gray-200 hover:border-gray-300'
                )}
              >
                <Stethoscope className="h-4 w-4 mb-1 text-secondary" />
                <p className="text-sm font-semibold">{SERVICE_TYPE_LABELS.kinesiologia}</p>
              </button>
              <button
                type="button"
                onClick={() => handlePlanInicialChange('entrenamiento')}
                className={cn(
                  'p-3 rounded-lg border-2 text-left transition-all',
                  planInicial === 'entrenamiento' ? 'border-secondary bg-secondary/10 shadow-sm' : 'border-gray-200 hover:border-gray-300'
                )}
              >
                <Dumbbell className="h-4 w-4 mb-1 text-secondary" />
                <p className="text-sm font-semibold">{SERVICE_TYPE_LABELS.entrenamiento}</p>
              </button>
              <button
                type="button"
                onClick={() => handlePlanInicialChange('despues')}
                className={cn(
                  'p-3 rounded-lg border-2 text-left transition-all',
                  planInicial === 'despues' ? 'border-secondary bg-secondary/10 shadow-sm' : 'border-gray-200 hover:border-gray-300'
                )}
              >
                <Clock className="h-4 w-4 mb-1 text-secondary" />
                <p className="text-sm font-semibold">Asignar después</p>
              </button>
            </div>

            {planInicial === 'entrenamiento' && (
              <div className="space-y-2">
                <Label>Sesiones del plan</Label>
                <Select value={String(sessionsTotal)} onValueChange={(v) => setSessionsTotal(Number(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PLAN_CATALOG.entrenamiento.map((n) => (
                      <SelectItem key={n} value={String(n)}>{n} sesiones</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {planInicial === 'kinesiologia' && (
              <p className="text-xs text-muted-foreground">{KINESIOLOGIA_SESSIONS_FIJAS} sesiones (fijo).</p>
            )}
          </CardContent>
        </Card>

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          Registrar Paciente
        </Button>
      </form>
    </div>
  );
};

export default RegisterPatient;
