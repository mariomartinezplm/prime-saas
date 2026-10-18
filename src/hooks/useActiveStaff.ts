import { useEffect, useState } from 'react';
import { userService } from '@/services/userService';
import type { User } from '@/types';

// Profesionales y administradores activos (a quienes se les puede asignar un paciente). Solo consulta si `enabled` (solo el admin lo usa).
export function useActiveStaff(enabled: boolean) {
  const [staff, setStaff] = useState<User[]>([]);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    Promise.all([userService.getAll({ role: 'admin' }), userService.getAll({ role: 'professional' })])
      .then(([admins, professionals]) => active && setStaff([...admins.users, ...professionals.users].filter((s) => s.isActive)))
      .catch(() => active && setFailed(true));
    return () => {
      active = false;
    };
  }, [enabled]);

  return { staff, failed };
}
