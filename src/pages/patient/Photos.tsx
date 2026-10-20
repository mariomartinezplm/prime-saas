import { useAuth } from '@/contexts/AuthContext';
import PatientPhotos from '@/components/photos/PatientPhotos';
import PageTitle from '@/components/premium/PageTitle';

const Photos = () => {
  const { user } = useAuth();
  if (!user) return null;

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5">
      <PageTitle eyebrow="Fotos de progreso" title={<>Tu progreso,<br />en imágenes</>} />
      <PatientPhotos patientId={user.id} />
    </div>
  );
};

export default Photos;
