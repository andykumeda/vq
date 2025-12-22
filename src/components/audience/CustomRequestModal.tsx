import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Music, DollarSign, ExternalLink, PlusCircle } from 'lucide-react';
import type { PaymentHandles } from '@/types/vibequeue';

interface CustomRequestModalProps {
  open: boolean;
  onClose: () => void;
  paymentHandles: PaymentHandles;
  onSubmit: (title: string, artist: string, isTipped: boolean) => void;
  isLoading?: boolean;
}

export function CustomRequestModal({
  open,
  onClose,
  paymentHandles,
  onSubmit,
  isLoading,
}: CustomRequestModalProps) {
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [wantToTip, setWantToTip] = useState(false);

  const handleSubmit = () => {
    if (!title.trim() || !artist.trim()) return;
    onSubmit(title.trim(), artist.trim(), wantToTip);
    setTitle('');
    setArtist('');
    setWantToTip(false);
  };

  const handleClose = () => {
    setTitle('');
    setArtist('');
    setWantToTip(false);
    onClose();
  };

  const hasPaymentHandles = paymentHandles.venmo || paymentHandles.paypal || paymentHandles.cashapp;

  const openPaymentLink = (type: 'venmo' | 'paypal' | 'cashapp') => {
    const handle = paymentHandles[type];
    if (!handle) return;

    let url = '';
    switch (type) {
      case 'venmo':
        url = `venmo://paycharge?txn=pay&recipients=${handle}`;
        break;
      case 'paypal':
        url = `https://paypal.me/${handle}`;
        break;
      case 'cashapp':
        url = `https://cash.app/$${handle.replace('$', '')}`;
        break;
    }
    window.open(url, '_blank');
  };

  const isValid = title.trim().length > 0 && artist.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="glass-card border-primary/20 sm:max-w-md">
        <DialogHeader className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-secondary/20 rounded-full flex items-center justify-center">
            <PlusCircle className="w-8 h-8 text-secondary" />
          </div>
          <div>
            <DialogTitle className="text-xl font-bold">Request a Song</DialogTitle>
            <DialogDescription className="text-muted-foreground mt-1">
              Can't find what you're looking for? Submit a custom request!
            </DialogDescription>
          </div>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="song-title">Song Title</Label>
              <Input
                id="song-title"
                placeholder="Enter song title..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={200}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="artist-name">Artist</Label>
              <Input
                id="artist-name"
                placeholder="Enter artist name..."
                value={artist}
                onChange={(e) => setArtist(e.target.value)}
                maxLength={200}
              />
            </div>
          </div>

          {hasPaymentHandles && (
            <div className="space-y-4">
              <div className="flex items-center space-x-3">
                <Checkbox
                  id="tip-custom"
                  checked={wantToTip}
                  onCheckedChange={(checked) => setWantToTip(checked as boolean)}
                />
                <label
                  htmlFor="tip-custom"
                  className="text-sm font-medium leading-none cursor-pointer flex items-center gap-2"
                >
                  <DollarSign className="w-4 h-4 text-warning" />
                  Bump your request with a tip
                </label>
              </div>

              {wantToTip && (
                <div className="space-y-2 animate-fade-in">
                  <p className="text-xs text-muted-foreground mb-3">
                    Tip the DJ to prioritize your request:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {paymentHandles.venmo && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openPaymentLink('venmo')}
                        className="border-[#008CFF]/50 text-[#008CFF] hover:bg-[#008CFF]/10"
                      >
                        Venmo <ExternalLink className="w-3 h-3 ml-1" />
                      </Button>
                    )}
                    {paymentHandles.paypal && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openPaymentLink('paypal')}
                        className="border-[#003087]/50 text-[#0070BA] hover:bg-[#0070BA]/10"
                      >
                        PayPal <ExternalLink className="w-3 h-3 ml-1" />
                      </Button>
                    )}
                    {paymentHandles.cashapp && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openPaymentLink('cashapp')}
                        className="border-[#00D632]/50 text-[#00D632] hover:bg-[#00D632]/10"
                      >
                        Cash App <ExternalLink className="w-3 h-3 ml-1" />
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex gap-3">
            <Button variant="outline" onClick={handleClose} className="flex-1">
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isLoading || !isValid}
              className="flex-1 neon-glow-purple"
            >
              {isLoading ? 'Submitting...' : 'Submit Request'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
