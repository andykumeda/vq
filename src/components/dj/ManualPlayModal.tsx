import { useState } from 'react';
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

interface ManualPlayModalProps {
  open: boolean;
  onClose: () => void;
  onPlay: (song: { title: string; artist: string }) => void;
}

export function ManualPlayModal({ open, onClose, onPlay }: ManualPlayModalProps) {
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);

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
