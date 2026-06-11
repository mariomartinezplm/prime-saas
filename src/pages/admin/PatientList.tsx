import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { userService } from '@/services/userService';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, UserPlus, ChevronRight, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import type { User } from '@/types';

const PatientList = () => {
  const navigate = useNavigate();
  const [patients, setPatients] = useState<User[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const fetchPatients = async () => {
    setLoading(true);
    try {
      const data = await userService.getPatients();
      setPatients(data);
    } catch (error) {
      console.error('Error fetching patients:', error);
      toast.error('Error al cargar la lista de pacientes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPatients();
  }, []);

  const handleSyncAirtable = async () => {
    setSyncing(true);
    try {
      const result = await userService.syncAirtable();
      toast.success(`Sincronización completa: ${result.syncedCount} pacientes creados/actualizados.`);
      // Refrescar la lista para mostrar los nuevos/actualizados
      await fetchPatients();
    } catch (error: any) {
      console.error('Error syncing Airtable:', error);
      toast.error(error.response?.data?.message || 'Error al conectar con Airtable');
    } finally {
      setSyncing(false);
    }
  };

  const filtered = patients.filter((p) => {
    const term = search.toLowerCase();
    return (
      p.firstName.toLowerCase().includes(term) ||
      p.lastName.toLowerCase().includes(term) ||
      p.email.toLowerCase().includes(term) ||
      (p.rut && p.rut.includes(term))
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Pacientes</h1>
          <p className="text-muted-foreground">{patients.length} pacientes registrados</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleSyncAirtable} disabled={syncing}>
            <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
            Sincronizar Airtable
          </Button>
          <Button onClick={() => navigate('/app/admin/registro')}>
            <UserPlus className="h-4 w-4 mr-2" />
            Nuevo paciente
          </Button>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nombre, email o RUT..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-secondary" />
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((patient) => (
            <Card
              key={patient.id}
              className="cursor-pointer hover:border-secondary transition-colors"
              onClick={() => navigate(`/app/admin/pacientes/${patient.id}`)}
            >
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-secondary/20 flex items-center justify-center">
                    <span className="text-secondary font-bold text-sm">
                      {patient.firstName[0]}{patient.lastName[0]}
                    </span>
                  </div>
                  <div>
                    <p className="font-medium">{patient.firstName} {patient.lastName}</p>
                    <p className="text-sm text-muted-foreground">{patient.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {patient.rut && (
                    <span className="text-sm text-muted-foreground">{patient.rut}</span>
                  )}
                  <Badge className={patient.isActive ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}>
                    {patient.isActive ? 'Activo' : 'Inactivo'}
                  </Badge>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          ))}
          {filtered.length === 0 && (
            <p className="text-muted-foreground text-sm text-center py-8">
              No se encontraron pacientes
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default PatientList;
