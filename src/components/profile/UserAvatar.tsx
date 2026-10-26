import { useEffect, useState } from 'react';
import { avatarService } from '@/services/avatarService';
import { cn } from '@/lib/utils';
import type { User } from '@/types';

type AvatarUser = Pick<User, 'id' | 'firstName' | 'lastName' | 'avatarUpdatedAt'>;

const initialsOf = (user: Pick<User, 'firstName' | 'lastName'>) =>
  `${(user.firstName ?? '').trim().charAt(0)}${(user.lastName ?? '').trim().charAt(0)}`.toUpperCase() || 'P';

// Fotos ya descargadas: una por persona y por versión (avatarUpdatedAt), así un cambio de foto nunca muestra la antigua
const cache = new Map<string, string>();
const keyOf = (user: AvatarUser) => `${user.id}:${user.avatarUpdatedAt}`;

// La foto de perfil como imagen lista para mostrar, o null si la persona no tiene o todavía carga (se muestran las iniciales).
function useAvatarSrc(user: AvatarUser | null | undefined): string | null {
  const key = user?.avatarUpdatedAt ? keyOf(user) : null;
  const [loaded, setLoaded] = useState<{ key: string; src: string } | null>(null);

  useEffect(() => {
    if (!key) return;
    if (cache.has(key)) return;
    let cancelled = false;
    avatarService
      .fetchDataUrl()
      .then((src) => {
        cache.set(key, src);
        if (!cancelled) setLoaded({ key, src });
      })
      .catch(() => {
        // Sin foto o sin red: se quedan las iniciales
      });
    return () => {
      cancelled = true;
    };
  }, [key]);

  if (!key) return null;
  return cache.get(key) ?? (loaded?.key === key ? loaded.src : null);
}

const SIZES = {
  sm: 'h-9 w-9 text-[13px]',
  md: 'h-12 w-12 text-base',
  lg: 'h-16 w-16 text-xl',
  xl: 'h-24 w-24 text-3xl',
} as const;

interface UserAvatarProps {
  user: AvatarUser;
  size?: keyof typeof SIZES;
  className?: string;
}

// Avatar único de la app: foto recortada en círculo con borde turquesa discreto, o las iniciales si no hay foto (nunca una imagen rota).
const UserAvatar = ({ user, size = 'md', className }: UserAvatarProps) => {
  const src = useAvatarSrc(user);
  const [broken, setBroken] = useState<string | null>(null);
  const showPhoto = !!src && broken !== src;

  return (
    <span
      aria-hidden="true"
      className={cn(
        'relative flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#398ca2]/70 bg-[#398ca2]/15 font-semibold tracking-wide text-[#fff8e4] shadow-[0_0_0_3px_rgba(57,140,162,0.12)]',
        SIZES[size],
        className
      )}
    >
      {showPhoto ? <img src={src} alt="" onError={() => setBroken(src)} className="h-full w-full object-cover" draggable={false} /> : initialsOf(user)}
    </span>
  );
};

export default UserAvatar;
