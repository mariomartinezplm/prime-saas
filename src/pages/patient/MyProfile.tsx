import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { authService } from '@/services/authService';
import { planService } from '@/services/planService';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useEffect } from 'react';
import type { Plan } from '@/types';

const MyProfile = () => {
  const { user, updateUser } = useAuth();
  const [activePlan, setActivePlan] = useState<Plan | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    phone: user?.phone || '',
    address: user?.address || '',
    dateOfBirth: user?.dateOfBirth?.split('T')[0] || '',
  });

  useEffect(() => {
    if (user) {
      planService.getActive(user.id).then(setActivePlan).catch(() => {});
    }
  }, [user]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await authService.updateProfile({
        firstName: form.firstName,
        lastName: form.lastName,
        phone: form.phone || undefined,
        address: form.address || undefined,
        dateOfBirth: form.dateOfBirth || undefined,
      });
      updateUser(updated);
      setEditing(false);
      toast.success('Perfil actualizado');
    } catch {
      toast.error('Error al actualizar perfil');
    } finally {
      setSaving(false);
    }
  };

  if (!user) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Mi Perfil</h1>
        <p className="text-muted-foreground">Información de tu cuenta</p>
      </div>

      <Tabs defaultValue="personal">
        <TabsList>
          <TabsTrigger value="personal">Datos Personales</TabsTrigger>
          <TabsTrigger value="emergency">Emergencia</TabsTrigger>
          <TabsTrigger value="medical">Info Médica</TabsTrigger>
          <TabsTrigger value="plan">Mi Plan</TabsTrigger>
        </TabsList>

        <TabsContent value="personal" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Datos Personales</CardTitle>
              {!editing ? (
                <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                  Editar
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setEditing(false)}>
                    Cancelar
                  </Button>
                  <Button size="sm" onClick={handleSave} disabled={saving}>
                    {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                    Guardar
                  </Button>
                </div>
              )}
            </CardHeader>
            <CardContent>
              {editing ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Nombre</Label>
                    <Input value={form.firstName} onChange={(e) => setForm(p => ({ ...p, firstName: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Apellido</Label>
                    <Input value={form.lastName} onChange={(e) => setForm(p => ({ ...p, lastName: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Teléfono</Label>
                    <Input value={form.phone} onChange={(e) => setForm(p => ({ ...p, phone: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Fecha de Nacimiento</Label>
                    <Input type="date" value={form.dateOfBirth} onChange={(e) => setForm(p => ({ ...p, dateOfBirth: e.target.value }))} />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label>Dirección</Label>
                    <Input value={form.address} onChange={(e) => setForm(p => ({ ...p, address: e.target.value }))} />
                  </div>
                </div>
              ) : (
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Nombre</span><span>{user.firstName} {user.lastName}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Email</span><span>{user.email}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">RUT</span><span>{user.rut || '-'}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Teléfono</span><span>{user.phone || '-'}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Fecha nacimiento</span><span>{user.dateOfBirth ? format(parseISO(user.dateOfBirth), 'dd/MM/yyyy') : '-'}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Dirección</span><span>{user.address || '-'}</span></div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="emergency" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-lg">Contacto de Emergencia</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Nombre</span><span>{user.emergencyContact?.name || '-'}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Teléfono</span><span>{user.emergencyContact?.phone || '-'}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Relación</span><span>{user.emergencyContact?.relationship || '-'}</span></div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="medical" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-lg">Información Médica</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div><span className="text-muted-foreground">Condiciones crónicas: </span>{user.medicalInfo?.chronicConditions?.join(', ') || 'Ninguna'}</div>
              <div><span className="text-muted-foreground">Medicamentos: </span>{user.medicalInfo?.medications?.join(', ') || 'Ninguno'}</div>
              <div><span className="text-muted-foreground">Alergias: </span>{user.medicalInfo?.allergies?.join(', ') || 'Ninguna'}</div>
              <div><span className="text-muted-foreground">Lesiones: </span>{user.medicalInfo?.injuries?.join(', ') || 'Ninguna'}</div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="plan" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-lg">Mi Plan</CardTitle></CardHeader>
            <CardContent>
              {activePlan ? (
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Tipo</span><span className="capitalize font-medium">{activePlan.type}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Sesiones/semana</span><span>{activePlan.sessionsPerWeek}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Inicio</span><span>{format(parseISO(activePlan.startDate), 'dd/MM/yyyy')}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Fin</span><span>{format(parseISO(activePlan.endDate), 'dd/MM/yyyy')}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Estado</span><span className="capitalize text-green-400">{activePlan.status}</span></div>
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">No tienes un plan activo. Contacta a tu profesional.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default MyProfile;
