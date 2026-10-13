import { useAuth } from '@/contexts/AuthContext';
import PatientPhotos from '@/components/photos/PatientPhotos';
import PageHeader from '@/components/shared/PageHeader';

const Photos = () => {
  const { user } = useAuth();
  if (!user) return null;

  return (
    <div className="space-y-6">
      <PageHeader title="Fotos de progreso" description="Mira tu avance y compara cómo has cambiado" />
      <PatientPhotos patientId={user.id} />
    </div>
  );
};

export default Photos;
