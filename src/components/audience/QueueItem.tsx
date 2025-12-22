import { Music, Clock, Play, Sparkles, DollarSign } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { Request } from '@/types/vibequeue';

interface QueueItemProps {
  request: Request;
  isOwn?: boolean;
}

export function QueueItem({ request, isOwn }: QueueItemProps) {
  const statusConfig = {
    pending: {
      label: 'Pending',
      icon: Clock,
      className: 'bg-muted text-muted-foreground',
    },
    next_up: {
      label: 'Next Up',
      icon: Sparkles,
      className: 'bg-secondary/20 text-secondary',
    },
    playing: {
      label: 'Now Playing',
      icon: Play,
      className: 'bg-primary/20 text-primary animate-pulse-glow',
    },
    played: {
      label: 'Played',
      icon: Music,
      className: 'bg-muted text-muted-foreground',
    },
    rejected: {
      label: 'Rejected',
      icon: Music,
      className: 'bg-destructive/20 text-destructive',
    },
  };

  const config = statusConfig[request.status];
  const StatusIcon = config.icon;

  return (
    <Card
      className={`glass-card p-4 transition-all duration-300 ${
        isOwn ? 'border-primary/30' : ''
      } ${request.status === 'playing' ? 'animate-pulse-glow border-primary/50' : ''}`}
    >
      <div className="flex items-center gap-4">
        <div
          className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
            request.status === 'playing' ? 'bg-primary/30' : 'bg-muted'
          }`}
        >
          <StatusIcon
            className={`w-5 h-5 ${
              request.status === 'playing' ? 'text-primary' : 'text-muted-foreground'
            }`}
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="font-semibold text-foreground truncate">
              {request.song?.title || 'Unknown Song'}
            </h4>
            {request.is_tipped && (
              <DollarSign className="w-4 h-4 text-warning flex-shrink-0" />
            )}
          </div>
          <p className="text-sm text-muted-foreground truncate">
            {request.song?.artist || 'Unknown Artist'} • {request.requester_username}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Badge className={config.className}>{config.label}</Badge>
          {isOwn && (
            <span className="text-xs text-primary">Your request</span>
          )}
        </div>
      </div>
    </Card>
  );
}
