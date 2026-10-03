import { useAuth } from '@/contexts/AuthContext';
import PatientPhotos from '@/components/photos/PatientPhotos';

const Photos = () => {
  const { user } = useAuth();
  if (!user) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Fotos de progreso</h1>
        <p className="text-muted-foreground mt-1">Mira tu avance y compara cómo has cambiado</p>
      </div>
      <PatientPhotos patientId={user.id} />
    </div>
  );
};

export default Photos;
