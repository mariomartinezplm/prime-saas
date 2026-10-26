import { useState } from 'react';
import { Share2 } from 'lucide-react';
import ShareAchievementDialog from './ShareAchievementDialog';
import type { ShareableAchievement } from '@/lib/achievementCard';
import { cn } from '@/lib/utils';

// Botón «Compartir» de un logro ya conseguido: abre la vista previa de la imagen (nada se comparte hasta que la persona lo decide)
const ShareAchievementButton = ({ achievement, className }: { achievement: ShareableAchievement; className?: string }) => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn('inline-flex min-h-[44px] items-center gap-1.5 rounded-xl text-sm font-semibold text-[#8fd0e0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#fff8e4]', className)}
      >
        <Share2 className="h-4 w-4" aria-hidden="true" />
        Compartir
        <span className="sr-only"> el logro {achievement.title}</span>
      </button>
      {open && <ShareAchievementDialog open={open} onOpenChange={setOpen} achievement={achievement} />}
    </>
  );
};

export default ShareAchievementButton;
