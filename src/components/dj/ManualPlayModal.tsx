import { useState, useEffect, useRef } from 'react';
import { Mic, Music, Loader2, Search } from 'lucide-react';
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
  const [searchQuery, setSearchQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  const { data: songs = [] } = useSongs(searchQuery);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!open) {
      setTitle('');
      setArtist('');
      setSearchQuery('');
      setShowSuggestions(false);
    }
  }, [open]);

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setShowSuggestions(value.length > 0);
  };

  const handleSelectSong = (song: Song) => {
    setTitle(song.title);
    setArtist(song.artist);
    setSearchQuery('');
    setShowSuggestions(false);
  };

  const handleManualPlay = () => {
    if (!title.trim() || !artist.trim()) {
      toast.error('Please enter both title and artist');
      return;
    }
    onPlay({ title: title.trim(), artist: artist.trim() });
    setTitle('');
    setArtist('');
    setSearchQuery('');
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
                or search library
              </span>
            </div>
          </div>

          <div className="relative" ref={suggestionsRef}>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Search songs in library..."
                className="pl-9"
                data-testid="input-search-library"
              />
            </div>
            {showSuggestions && songs.length > 0 && (
              <div className="absolute z-50 w-full mt-1 max-h-48 overflow-y-auto bg-popover border border-border rounded-md shadow-lg">
                {songs.slice(0, 8).map((song) => (
                  <button
                    key={song.id}
                    onClick={() => handleSelectSong(song)}
                    className="w-full px-3 py-2 text-left hover:bg-accent transition-colors flex flex-col"
                    data-testid={`suggestion-${song.id}`}
                  >
                    <span className="font-medium text-sm truncate">{song.title}</span>
                    <span className="text-xs text-muted-foreground truncate">{song.artist}</span>
                  </button>
                ))}
              </div>
            )}
            {showSuggestions && searchQuery.length > 0 && songs.length === 0 && (
              <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-md shadow-lg p-3 text-sm text-muted-foreground">
                No songs found. Enter details manually below.
              </div>
            )}
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

          <div className="space-y-3">
            <div>
              <Label htmlFor="title">Song Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter song title"
                data-testid="input-song-title"
              />
            </div>
            <div>
              <Label htmlFor="artist">Artist</Label>
              <Input
                id="artist"
                value={artist}
                onChange={(e) => setArtist(e.target.value)}
                placeholder="Enter artist name"
                data-testid="input-artist"
              />
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
