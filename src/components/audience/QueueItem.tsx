import { Music, Clock, Play, Sparkles, DollarSign, Languages, Loader2, X } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Request } from '@/types/vibequeue';

interface QueueItemProps {
  request: Request;
  isOwn?: boolean;
}

export function QueueItem({ request, isOwn }: QueueItemProps) {
  const [showLyrics, setShowLyrics] = useState(false);
  const [lyrics, setLyrics] = useState<string | null>(null);
  const [isLoadingLyrics, setIsLoadingLyrics] = useState(false);

  const fetchLyrics = async () => {
    if (lyrics) {
      setShowLyrics(true);
      return;
    }

    setIsLoadingLyrics(true);
    try {
      // 1. Try via Edge Function first (best for security)
      try {
        const { data, error } = await supabase.functions.invoke('get-lyrics', {
          body: { q_track: request.song?.title, q_artist: request.song?.artist }
        });

        if (!error && data?.success) {
          setLyrics(data.lyrics);
          setShowLyrics(true);
          setIsLoadingLyrics(false);
          return;
        }
      } catch (e) {
        console.warn('Edge function failed, trying direct AudD call if token exists');
      }

      // 2. Fallback: Direct call to AudD if user has VITE_AUDD_API_TOKEN in .env
      const clientToken = import.meta.env.VITE_AUDD_API_TOKEN;
      if (clientToken) {
        const url = `https://api.audd.io/findLyrics/?api_token=${clientToken}&q=${encodeURIComponent(request.song?.artist + ' ' + request.song?.title)}`;
        const res = await fetch(url);
        const data = await res.json();
        
        if (data.result && data.result.length > 0) {
          setLyrics(data.result[0].lyrics);
          setShowLyrics(true);
          return;
        }
      }

      toast.info('Lyrics not found');
    } catch (error: any) {
      console.error('Lyrics error:', error);
      toast.error('Failed to fetch lyrics');
    } finally {
      setIsLoadingLyrics(false);
    }
  };

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
    <div className="space-y-3">
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
          <div className="flex flex-col items-end gap-2">
            <Badge className={config.className}>{config.label}</Badge>
            {request.status === 'playing' && (
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-7 text-[10px] uppercase tracking-wider text-primary hover:text-primary hover:bg-primary/10"
                onClick={fetchLyrics}
                disabled={isLoadingLyrics}
              >
                {isLoadingLyrics ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Languages className="w-3 h-3 mr-1" />}
                Lyrics
              </Button>
            )}
          </div>
        </div>
      </Card>

      {showLyrics && lyrics && (
        <Card className="glass-card p-6 animate-fade-in relative border-primary/20">
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-2 right-2 h-8 w-8 text-muted-foreground hover:text-white"
            onClick={() => setShowLyrics(false)}
          >
            <X className="w-4 h-4" />
          </Button>
          <div className="prose prose-invert max-w-none">
            <h5 className="text-xs uppercase tracking-[0.2em] text-primary mb-4">Lyrics</h5>
            <div className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground italic">
              {lyrics}
            </div>
            <p className="text-[10px] mt-6 text-muted-foreground/50 text-center uppercase tracking-widest">
              Lyrics powered by AudD
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}