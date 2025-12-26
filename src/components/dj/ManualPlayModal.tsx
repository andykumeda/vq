import { useState, useEffect, useRef } from 'react';
import { Mic, Music, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useSongs } from '@/hooks/useSongs';
import type { Song } from '@/types/vibequeue';

interface ManualPlayModalProps {
  open: boolean;
  onClose: () => void;
  onPlay: (song: { title: string; artist: string }) => void;
}

export function ManualPlayModal({ open, onClose, onPlay }: ManualPlayModalProps) {
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [activeField, setActiveField] = useState<'title' | 'artist' | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  const searchQuery = activeField === 'title' ? title : activeField === 'artist' ? artist : '';
  const { data: songs = [] } = useSongs(searchQuery);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(event.target as Node)) {
        setActiveField(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!open) {
      setTitle('');
      setArtist('');
      setActiveField(null);
    }
  }, [open]);

  const handleSelectSong = (song: Song) => {
    setTitle(song.title);
    setArtist(song.artist);
    setActiveField(null);
  };

  const handleManualPlay = () => {
    if (!title.trim() || !artist.trim()) {
      toast.error('Please enter both title and artist');
      return;
    }
    onPlay({ title: title.trim(), artist: artist.trim() });
    setTitle('');
    setArtist('');
    onClose();
  };

  const startListening = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach(track => track.stop());
        toast.info('Song recognition requires an API key. Please enter the song details manually.');
        setIsListening(false);
      };

      setMediaRecorder(recorder);
      recorder.start();
      setIsListening(true);
      
      setTimeout(() => {
        if (recorder.state === 'recording') {
          recorder.stop();
        }
      }, 10000);

      toast.info('Listening for 10 seconds...');
    } catch (err) {
      console.error('Microphone error:', err);
      toast.error('Could not access microphone');
      setIsListening(false);
    }
  };

  const stopListening = () => {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.stop();
    }
  };

  const showSuggestions = activeField !== null && searchQuery.length > 0 && songs.length > 0;

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Music className="w-5 h-5" />
            Play a Song
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="p-4 rounded-lg bg-muted/50 border border-border">
            <p className="text-sm text-muted-foreground mb-3">
              Use your microphone to identify what's playing
            </p>
            <Button
              onClick={isListening ? stopListening : startListening}
              variant={isListening ? "destructive" : "secondary"}
              className="w-full"
              data-testid="button-listen-identify"
            >
              {isListening ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Listening... (tap to stop)
                </>
              ) : (
                <>
                  <Mic className="w-4 h-4 mr-2" />
                  Listen & Identify
                </>
              )}
            </Button>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                or enter manually
              </span>
            </div>
          </div>

          <div className="space-y-3" ref={suggestionsRef}>
            <div className="relative">
              <Label htmlFor="title">Song Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onFocus={() => setActiveField('title')}
                placeholder="Start typing to search..."
                autoComplete="off"
                data-testid="input-song-title"
              />
              {showSuggestions && activeField === 'title' && (
                <div className="absolute z-50 w-full mt-1 max-h-48 overflow-y-auto bg-popover border border-border rounded-md shadow-lg">
                  {songs.slice(0, 6).map((song) => (
                    <button
                      key={song.id}
                      onClick={() => handleSelectSong(song)}
                      className="w-full px-3 py-2 text-left hover:bg-accent transition-colors flex flex-col"
                      data-testid={`suggestion-title-${song.id}`}
                    >
                      <span className="font-medium text-sm truncate">{song.title}</span>
                      <span className="text-xs text-muted-foreground truncate">{song.artist}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="relative">
              <Label htmlFor="artist">Artist</Label>
              <Input
                id="artist"
                value={artist}
                onChange={(e) => setArtist(e.target.value)}
                onFocus={() => setActiveField('artist')}
                placeholder="Start typing to search..."
                autoComplete="off"
                data-testid="input-artist"
              />
              {showSuggestions && activeField === 'artist' && (
                <div className="absolute z-50 w-full mt-1 max-h-48 overflow-y-auto bg-popover border border-border rounded-md shadow-lg">
                  {songs.slice(0, 6).map((song) => (
                    <button
                      key={song.id}
                      onClick={() => handleSelectSong(song)}
                      className="w-full px-3 py-2 text-left hover:bg-accent transition-colors flex flex-col"
                      data-testid={`suggestion-artist-${song.id}`}
                    >
                      <span className="font-medium text-sm truncate">{song.title}</span>
                      <span className="text-xs text-muted-foreground truncate">{song.artist}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <Button onClick={handleManualPlay} className="w-full" data-testid="button-set-now-playing">
            <Music className="w-4 h-4 mr-2" />
            Set as Now Playing
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
