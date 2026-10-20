import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';

const KEY = 'prime.nav';

// PROTOTIPO apagado por defecto: la barra inferior del paciente solo se muestra si se activa a propósito
// (agregando «?nav=bottom» al enlace; «?nav=menu» la apaga). No cambia nada para pacientes que no la activen,
// ni para profesionales/administradores. La preferencia se guarda solo en este dispositivo.
export function usePatientBottomNav(): boolean {
  const { user } = useAuth();
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    try {
      const param = new URLSearchParams(window.location.search).get('nav');
      if (param === 'bottom') localStorage.setItem(KEY, 'bottom');
      if (param === 'menu') localStorage.removeItem(KEY);
      setEnabled(localStorage.getItem(KEY) === 'bottom');
    } catch {
      setEnabled(false);
    }
  }, []);

  return enabled && user?.role === 'patient';
}
