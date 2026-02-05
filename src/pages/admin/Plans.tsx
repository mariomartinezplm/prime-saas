import { useState, useEffect } from 'react';
import { planService } from '@/services/planService';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format, parseISO } from 'date-fns';
import type { Plan } from '@/types';

const statusColors: Record<string, string> = {
  active: 'bg-green-500/20 text-green-400',
  expired: 'bg-gray-500/20 text-gray-400',
  cancelled: 'bg-red-500/20 text-red-400',
};

const Plans = () => {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPlans = async () => {
      try {
        const params: Record<string, string> = {};
        if (statusFilter !== 'all') params.status = statusFilter;
        const data = await planService.getAll(params);
        setPlans(data);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    };
    fetchPlans();
  }, [statusFilter]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Planes</h1>
          <p className="text-muted-foreground">Gestión de planes de pacientes</p>
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Filtrar" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="active">Activos</SelectItem>
            <SelectItem value="expired">Expirados</SelectItem>
            <SelectItem value="cancelled">Cancelados</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-secondary" />
        </div>
      ) : plans.length === 0 ? (
        <p className="text-muted-foreground text-sm">No hay planes registrados</p>
      ) : (
        <div className="space-y-3">
          {plans.map((plan) => {
            const patient = typeof plan.patient === 'object' ? plan.patient : null;
            const professional = typeof plan.professional === 'object' ? plan.professional : null;
            return (
              <Card key={plan._id}>
                <CardContent className="flex items-center justify-between p-4">
                  <div>
                    <p className="font-medium">
                      {patient ? `${patient.firstName} ${patient.lastName}` : 'Paciente'}
                    </p>
                    <p className="text-sm text-muted-foreground capitalize">
                      Plan {plan.type} | {plan.sessionsPerWeek} sesiones/semana
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {format(parseISO(plan.startDate), 'dd/MM/yyyy')} - {format(parseISO(plan.endDate), 'dd/MM/yyyy')}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {professional && (
                      <span className="text-sm text-muted-foreground">
                        {professional.firstName} {professional.lastName}
                      </span>
                    )}
                    <Badge className={statusColors[plan.status]}>{plan.status}</Badge>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Plans;
