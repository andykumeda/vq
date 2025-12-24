import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { XCircle, Music } from 'lucide-react';
import type { Request } from '@/types/vibequeue';

interface RejectionModalProps {
  open: boolean;
  onClose: () => void;
  request: Request | null;
}

export function RejectionModal({ open, onClose, request }: RejectionModalProps) {
  if (!request?.song) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <XCircle className="w-5 h-5" />
            Request Not Available
          </DialogTitle>
          <DialogDescription className="text-base">
            <span className="font-semibold text-foreground">{request.song.title}</span>
            {' '}by{' '}
            <span className="text-muted-foreground">{request.song.artist}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="bg-muted/50 rounded-lg p-4 text-center">
            <p className="text-sm text-muted-foreground">
              Sorry, the DJ doesn't have this song available right now. 
              Please try requesting something different!
            </p>
          </div>

          <Button onClick={onClose} className="w-full">
            <Music className="w-4 h-4 mr-2" />
            Find Another Song
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
