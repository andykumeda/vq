import { useState } from 'react';
import { Mic, Music, Search, Loader2 } from 'lucide-react';
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
import { supabase } from '@/integrations/supabase/client';

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
        const audioBlob = new Blob(chunks, { type: 'audio/webm' });
        
        // Convert to base64
        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64Audio = (reader.result as string).split(',')[1];
          
          toast.info('Analyzing audio...');
          
          try {
            const { data, error } = await supabase.functions.invoke('recognize-song', {
              body: { audio: base64Audio }
            });

            if (error) throw error;
            
            if (data.success && data.song) {
              setTitle(data.song.title);
              setArtist(data.song.artist);
              toast.success(`Recognized: ${data.song.title} by ${data.song.artist}`);
            } else {
              toast.error('Could not recognize the song. Try again or enter manually.');
            }
          } catch (err: any) {
            console.error('Recognition error:', err);
            toast.error(err.message || 'Failed to recognize song');
          }
        };
        reader.readAsDataURL(audioBlob);
        setIsListening(false);
      };

      setMediaRecorder(recorder);
      recorder.start();
      setIsListening(true);
      
      // Stop after 10 seconds
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
          {/* Song Recognition */}
          <div className="p-4 rounded-lg bg-muted/50 border border-border">
            <p className="text-sm text-muted-foreground mb-3">
              Use your microphone to identify what's playing
            </p>
            <Button
              onClick={isListening ? stopListening : startListening}
              variant={isListening ? "destructive" : "secondary"}
              className="w-full"
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

          {/* Manual Entry */}
          <div className="space-y-3">
            <div>
              <Label htmlFor="title">Song Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter song title"
              />
            </div>
            <div>
              <Label htmlFor="artist">Artist</Label>
              <Input
                id="artist"
                value={artist}
                onChange={(e) => setArtist(e.target.value)}
                placeholder="Enter artist name"
              />
            </div>
          </div>

          <Button onClick={handleManualPlay} className="w-full">
            <Music className="w-4 h-4 mr-2" />
            Set as Now Playing
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
