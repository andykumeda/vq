import { Music } from 'lucide-react';
import { Card } from '@/components/ui/card';
import type { Song } from '@/types/vibequeue';

interface SongCardProps {
  song: Song;
  onClick: () => void;
  disabled?: boolean;
}

export function SongCard({ song, onClick, disabled }: SongCardProps) {
  return (
    <Card
      className={`glass-card p-4 cursor-pointer transition-all duration-300 hover:border-primary/50 hover:neon-glow-purple active:scale-[0.98] ${
        disabled ? 'opacity-50 cursor-not-allowed' : ''
      }`}
      onClick={disabled ? undefined : onClick}
    >
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 bg-primary/20 rounded-lg flex items-center justify-center flex-shrink-0">
          <Music className="w-6 h-6 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-foreground truncate">{song.title}</h3>
          <p className="text-sm text-muted-foreground truncate">{song.artist}</p>
        </div>
      </div>
    </Card>
  );
}
