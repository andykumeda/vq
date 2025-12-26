import { useState } from 'react';
import { Music, User, Clock, DollarSign, Check, X, Play, Pencil } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { formatDistanceToNow } from 'date-fns';
import type { Request } from '@/types/vibequeue';

interface RequestRowProps {
  request: Request;
  onAccept: () => void;
  onReject: () => void;
  onMarkPlayed: () => void;
  onUpdateSong?: (songId: string, title: string, artist: string) => void;
}

export function RequestRow({ request, onAccept, onReject, onMarkPlayed, onUpdateSong }: RequestRowProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editArtist, setEditArtist] = useState('');

  const createdAt = request.createdAt || request.created_at || new Date().toISOString();
  const timeAgo = formatDistanceToNow(new Date(createdAt), { addSuffix: true });
  const isTipped = request.isTipped ?? request.is_tipped ?? false;
  const requesterUsername = request.requesterUsername || request.requester_username || 'Unknown';

  const songTitle = request.song?.title || 'Unknown';
  const songArtist = request.song?.artist || 'Unknown Artist';
  const needsEdit = songTitle.includes('Unknown') || songArtist.includes('Unknown');

  const handleStartEdit = () => {
    setEditTitle(songTitle === 'Unknown Title' ? '' : songTitle);
    setEditArtist(songArtist === 'Unknown Artist' ? '' : songArtist);
    setIsEditing(true);
  };

  const handleSaveEdit = () => {
    if (request.song && onUpdateSong) {
      const newTitle = editTitle.trim() || songTitle;
      const newArtist = editArtist.trim() || songArtist;
      onUpdateSong(request.song.id, newTitle, newArtist);
    }
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditTitle('');
    setEditArtist('');
  };

  return (
    <Card
      className={`glass-card p-4 transition-all duration-300 ${
        isTipped ? 'border-warning/50 bg-warning/5' : ''
      } ${request.status === 'playing' ? 'border-primary/50 animate-pulse-glow' : ''}`}
      data-testid={`request-row-${request.id}`}
    >
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 bg-primary/20 rounded-lg flex items-center justify-center flex-shrink-0">
          <Music className="w-6 h-6 text-primary" />
        </div>

        <div className="flex-1 min-w-0">
          {isEditing ? (
            <div className="space-y-2">
              <Input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="Song title"
                className="h-8 text-sm"
                data-testid="input-edit-title"
              />
              <Input
                value={editArtist}
                onChange={(e) => setEditArtist(e.target.value)}
                placeholder="Artist name"
                className="h-8 text-sm"
                data-testid="input-edit-artist"
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={handleSaveEdit} data-testid="button-save-edit">
                  <Check className="w-3 h-3 mr-1" />
                  Save
                </Button>
                <Button size="sm" variant="outline" onClick={handleCancelEdit} data-testid="button-cancel-edit">
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="font-semibold text-foreground truncate">
                  {songTitle}
                </h4>
                {isTipped && (
                  <Badge variant="outline" className="border-warning text-warning bg-warning/10">
                    <DollarSign className="w-3 h-3 mr-1" />
                    Tipped
                  </Badge>
                )}
                {needsEdit && onUpdateSong && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleStartEdit}
                    className="h-6 px-2 text-muted-foreground hover:text-foreground"
                    data-testid="button-edit-song"
                  >
                    <Pencil className="w-3 h-3 mr-1" />
                    Edit
                  </Button>
                )}
              </div>
              <p className="text-sm text-muted-foreground truncate">
                {songArtist}
              </p>
            </>
          )}
        </div>

        {!isEditing && (
          <>
            <div className="hidden sm:flex items-center gap-2 text-sm text-muted-foreground">
              <User className="w-4 h-4" />
              <span>{requesterUsername}</span>
            </div>

            <div className="hidden md:flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="w-4 h-4" />
              <span>{timeAgo}</span>
            </div>

            <div className="flex items-center gap-2">
              {request.status === 'pending' && (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={onAccept}
                    className="border-success/50 text-success hover:bg-success/10"
                    data-testid="button-accept"
                  >
                    <Check className="w-4 h-4" />
                    <span className="hidden sm:inline ml-1">Accept</span>
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={onReject}
                    className="border-destructive/50 text-destructive hover:bg-destructive/10"
                    data-testid="button-reject"
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
                  data-testid="button-play-now"
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
                  data-testid="button-done"
                >
                  <Check className="w-4 h-4 mr-1" />
                  Done
                </Button>
              )}
            </div>
          </>
        )}
      </div>

      {!isEditing && (
        <div className="sm:hidden mt-3 pt-3 border-t border-border/50 flex items-center justify-between gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4" />
            <span>{requesterUsername}</span>
          </div>
          <span>{timeAgo}</span>
        </div>
      )}
    </Card>
  );
}
