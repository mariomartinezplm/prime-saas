import { useState } from 'react';
import { AlertCircle, CalendarPlus, CheckCircle2, Info, TriangleAlert, Users } from 'lucide-react';
import { toast } from 'sonner';
import { useAppDarkTheme } from '@/hooks/useAppDarkTheme';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import FounderBadge from '@/components/plans/FounderBadge';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import EmptyState from '@/components/shared/EmptyState';
import LoadingState from '@/components/shared/LoadingState';
import PageHeader from '@/components/shared/PageHeader';
import { ActiveStatusBadge, AppointmentStatusBadge, PlanStatusBadge, StatusBadge } from '@/components/shared/StatusBadge';

// Galería del sistema de diseño. Solo existe en desarrollo (/diseno): sirve para revisar
// colores, contraste y componentes en un solo lugar. No entra al build de producción.
const swatches = [
  ['background', 'bg-background'],
  ['card', 'bg-card'],
  ['popover', 'bg-popover'],
  ['muted', 'bg-muted'],
  ['accent', 'bg-accent'],
  ['border', 'bg-border'],
  ['primary', 'bg-primary'],
  ['secondary', 'bg-secondary'],
  ['coral', 'bg-coral'],
  ['success', 'bg-success'],
  ['warning', 'bg-warning'],
  ['info', 'bg-info'],
  ['destructive', 'bg-destructive'],
] as const;

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="space-y-4">
    <h2 className="text-lg font-semibold text-foreground">{title}</h2>
    {children}
  </section>
);

const DesignSystem = () => {
  useAppDarkTheme();
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-5xl space-y-10 p-6">
        <PageHeader
          title="Sistema de diseño"
          description="Colores, tipografía y componentes de Prime F&H (solo desarrollo)."
          badges={<FounderBadge compact />}
          actions={<Button size="sm">Acción principal</Button>}
        />

        <Section title="Colores">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {swatches.map(([name, cls]) => (
              <div key={name} className="space-y-1.5">
                <div className={`h-14 rounded-md border border-border ${cls}`} />
                <p className="text-xs text-muted-foreground">{name}</p>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Texto sobre tarjeta">
          <Card>
            <CardContent className="grid gap-2 p-6 sm:grid-cols-2">
              <p className="text-foreground">foreground · crema, texto principal</p>
              <p className="text-muted-foreground">muted-foreground · texto secundario</p>
              <p className="text-primary">primary · turquesa de marca</p>
              <p className="text-secondary">secondary · turquesa claro (iconos, enlaces)</p>
              <p className="text-coral">coral · acento puntual</p>
              <p className="text-success">success · éxito</p>
              <p className="text-warning">warning · atención</p>
              <p className="text-info">info · información</p>
              <p className="text-destructive">destructive · error</p>
            </CardContent>
          </Card>
        </Section>

        <Section title="Tipografía">
          <div className="space-y-2">
            <p className="text-3xl font-semibold tracking-tight">Título de página 30/36</p>
            <p className="text-2xl font-semibold tracking-tight">Título de página en móvil 24</p>
            <p className="text-lg font-semibold">Título de sección 18</p>
            <p className="text-base">Texto base 16 — Kinesiología y entrenamiento en Puerto Montt.</p>
            <p className="text-sm text-muted-foreground">Texto de apoyo 14 — descripciones y ayudas.</p>
            <p className="text-xs text-muted-foreground">Texto pequeño 12 — metadatos, leyendas.</p>
          </div>
        </Section>

        <Section title="Botones">
          <div className="flex flex-wrap items-center gap-3">
            <Button>Principal</Button>
            <Button variant="secondary">Secundario</Button>
            <Button variant="outline">Contorno</Button>
            <Button variant="ghost">Fantasma</Button>
            <Button variant="destructive">Eliminar</Button>
            <Button variant="link">Enlace</Button>
            <Button disabled>Deshabilitado</Button>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button size="sm">Pequeño</Button>
            <Button>Normal</Button>
            <Button size="lg">Grande</Button>
            <Button size="icon" aria-label="Nueva cita"><CalendarPlus /></Button>
            <Button><Users /> Con icono</Button>
          </div>
        </Section>

        <Section title="Insignias y estados">
          <div className="flex flex-wrap items-center gap-2">
            <Badge>default</Badge>
            <Badge variant="secondary">secondary</Badge>
            <Badge variant="outline">outline</Badge>
            <Badge variant="success">success</Badge>
            <Badge variant="warning">warning</Badge>
            <Badge variant="danger">danger</Badge>
            <Badge variant="info">info</Badge>
            <Badge variant="accent">accent</Badge>
            <Badge variant="neutral">neutral</Badge>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <AppointmentStatusBadge status="scheduled" />
            <AppointmentStatusBadge status="completed" />
            <AppointmentStatusBadge status="cancelled" />
            <AppointmentStatusBadge status="no-show" />
            <PlanStatusBadge status="active" />
            <PlanStatusBadge status="expired" />
            <ActiveStatusBadge isActive />
            <ActiveStatusBadge isActive={false} />
            <StatusBadge tone="warning">Pendiente de pago</StatusBadge>
            <FounderBadge />
          </div>
        </Section>

        <Section title="Alertas">
          <div className="grid gap-3 md:grid-cols-2">
            <Alert variant="info"><Info className="h-4 w-4" /><AlertTitle>Información</AlertTitle><AlertDescription>Tu plan se renueva el 1 de noviembre.</AlertDescription></Alert>
            <Alert variant="success"><CheckCircle2 className="h-4 w-4" /><AlertTitle>Listo</AlertTitle><AlertDescription>La cita quedó agendada.</AlertDescription></Alert>
            <Alert variant="warning"><TriangleAlert className="h-4 w-4" /><AlertTitle>Atención</AlertTitle><AlertDescription>Pendiente de pago hasta el 5 de noviembre.</AlertDescription></Alert>
            <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertTitle>Error</AlertTitle><AlertDescription>No se pudo guardar. Intenta de nuevo.</AlertDescription></Alert>
          </div>
        </Section>

        <Section title="Formularios">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Datos de ejemplo</CardTitle>
              <CardDescription>Etiquetas visibles, ayudas y errores bajo cada campo.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5"><Label htmlFor="ds-name">Nombre</Label><Input id="ds-name" placeholder="Camila" /></div>
              <div className="space-y-1.5">
                <Label htmlFor="ds-mail">Correo</Label>
                <Input id="ds-mail" defaultValue="correo-invalido" aria-invalid="true" aria-describedby="ds-mail-err" className="border-destructive" />
                <p id="ds-mail-err" className="text-xs text-destructive">Ingresa un correo válido.</p>
              </div>
              <div className="space-y-1.5">
                <Label>Servicio</Label>
                <Select defaultValue="entrenamiento">
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="entrenamiento">Entrenamiento</SelectItem><SelectItem value="kinesiologia">Kinesiología</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label htmlFor="ds-notes">Notas</Label><Textarea id="ds-notes" rows={2} placeholder="Opcional" /></div>
              <div className="flex items-center gap-2"><Checkbox id="ds-check" defaultChecked /><Label htmlFor="ds-check">Renovar automáticamente</Label></div>
              <div className="flex items-center gap-2"><Switch id="ds-switch" defaultChecked /><Label htmlFor="ds-switch">Recordatorios por correo</Label></div>
            </CardContent>
          </Card>
        </Section>

        <Section title="Pestañas, diálogos y avisos">
          <Tabs defaultValue="uno">
            <TabsList><TabsTrigger value="uno">Resumen</TabsTrigger><TabsTrigger value="dos">Historial</TabsTrigger><TabsTrigger value="tres">Archivos</TabsTrigger></TabsList>
            <TabsContent value="uno" className="text-sm text-muted-foreground">Contenido de la pestaña activa.</TabsContent>
            <TabsContent value="dos" className="text-sm text-muted-foreground">Historial.</TabsContent>
            <TabsContent value="tres" className="text-sm text-muted-foreground">Archivos.</TabsContent>
          </Tabs>
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" onClick={() => setConfirmOpen(true)}>Abrir confirmación</Button>
            <Button variant="outline" onClick={() => toast.success('Cambios guardados')}>Aviso éxito</Button>
            <Button variant="outline" onClick={() => toast.error('No se pudo guardar')}>Aviso error</Button>
            <Button variant="outline" onClick={() => toast.warning('Plan por vencer')}>Aviso atención</Button>
            <Button variant="outline" onClick={() => toast.info('Nueva versión disponible')}>Aviso info</Button>
          </div>
          <ConfirmDialog
            open={confirmOpen}
            onOpenChange={setConfirmOpen}
            title="¿Cancelar esta cita?"
            description="Si cancelas con menos de 4 horas de anticipación, la sesión se descuenta de tu plan."
            confirmLabel="Sí, cancelar"
            cancelLabel="Volver"
            destructive
            onConfirm={() => new Promise<void>((resolve) => setTimeout(resolve, 900))}
          />
        </Section>

        <Section title="Estados vacíos y de carga">
          <div className="grid gap-4 md:grid-cols-2">
            <EmptyState
              icon={CalendarPlus}
              title="Aún no tienes citas"
              description="Cuando agendes tu primera sesión aparecerá aquí."
              action={<Button size="sm">Reservar una hora</Button>}
            />
            <Card><LoadingState label="Cargando pacientes…" /></Card>
          </div>
        </Section>
      </div>
    </div>
  );
};

export default DesignSystem;
