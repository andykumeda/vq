import { Music, User, Clock, DollarSign, Check, X, Play } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
import type { Request } from '@/types/vibequeue';

interface RequestRowProps {
  request: Request;
  onAccept: () => void;
  onReject: () => void;
  onMarkPlayed: () => void;
}

export function RequestRow({ request, onAccept, onReject, onMarkPlayed }: RequestRowProps) {
  const timeAgo = formatDistanceToNow(new Date(request.created_at), { addSuffix: true });

  return (
    <Card
      className={`glass-card p-4 transition-all duration-300 ${
        request.is_tipped ? 'border-warning/50 bg-warning/5' : ''
      } ${request.status === 'playing' ? 'border-primary/50 animate-pulse-glow' : ''}`}
    >
      <div className="flex items-center gap-4">
        {/* Song Info */}
        <div className="w-12 h-12 bg-primary/20 rounded-lg flex items-center justify-center flex-shrink-0">
          <Music className="w-6 h-6 text-primary" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="font-semibold text-foreground truncate">
              {request.song?.title || 'Unknown'}
            </h4>
            {request.is_tipped && (
              <Badge variant="outline" className="border-warning text-warning bg-warning/10">
                <DollarSign className="w-3 h-3 mr-1" />
                Tipped
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground truncate">
            {request.song?.artist || 'Unknown Artist'}
          </p>
        </div>

        {/* Requester */}
        <div className="hidden sm:flex items-center gap-2 text-sm text-muted-foreground">
          <User className="w-4 h-4" />
          <span>{request.requester_username}</span>
        </div>

        {/* Time */}
        <div className="hidden md:flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="w-4 h-4" />
          <span>{timeAgo}</span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {request.status === 'pending' && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={onAccept}
                className="border-success/50 text-success hover:bg-success/10"
              >
                <Check className="w-4 h-4" />
                <span className="hidden sm:inline ml-1">Accept</span>
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={onReject}
                className="border-destructive/50 text-destructive hover:bg-destructive/10"
              >
                <X className="w-4 h-4" />
                <span className="hidden sm:inline ml-1">Reject</span>
              </Button>
            </>
          )}
          {request.status === 'next_up' && (
            <Button
              size="sm"
              onClick={onMarkPlayed}
              className="bg-primary hover:bg-primary/80"
            >
              <Play className="w-4 h-4 mr-1" />
              Play Now
            </Button>
          )}
          {request.status === 'playing' && (
            <Button
              size="sm"
              variant="outline"
              onClick={onMarkPlayed}
              className="border-muted-foreground/50"
            >
              <Check className="w-4 h-4 mr-1" />
              Done
            </Button>
          )}
        </div>
      </div>

      {/* Mobile: Show requester below */}
      <div className="sm:hidden mt-3 pt-3 border-t border-border/50 flex items-center justify-between text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <User className="w-4 h-4" />
          <span>{request.requester_username}</span>
        </div>
        <span>{timeAgo}</span>
      </div>
    </Card>
  );
}
