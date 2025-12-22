import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Music } from 'lucide-react';

interface UsernameModalProps {
  open: boolean;
  onSubmit: (username: string) => void;
}

export function UsernameModal({ open, onSubmit }: UsernameModalProps) {
  const [username, setUsername] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (username.trim()) {
      onSubmit(username.trim());
    }
  };

  return (
    <Dialog open={open}>
      <DialogContent className="glass-card border-primary/20 sm:max-w-md">
        <DialogHeader className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center neon-glow-purple">
            <Music className="w-8 h-8 text-primary" />
          </div>
          <DialogTitle className="text-2xl font-bold neon-text-purple">
            Welcome to VibeQueue
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Enter your name to start requesting songs
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 mt-4">
          <Input
            placeholder="Your name"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="h-12 text-center text-lg bg-muted/50 border-border/50 focus:border-primary"
            maxLength={20}
            autoFocus
          />
          <Button
            type="submit"
            className="w-full h-12 text-lg font-semibold neon-glow-purple"
            disabled={!username.trim()}
          >
            Let's Go
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
