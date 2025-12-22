import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Music, DollarSign, ExternalLink } from 'lucide-react';
import type { Song, PaymentHandles } from '@/types/vibequeue';

interface RequestModalProps {
  open: boolean;
  onClose: () => void;
  song: Song | null;
  paymentHandles: PaymentHandles;
  onSubmit: (isTipped: boolean) => void;
  isLoading?: boolean;
}

export function RequestModal({
  open,
  onClose,
  song,
  paymentHandles,
  onSubmit,
  isLoading,
}: RequestModalProps) {
  const [wantToTip, setWantToTip] = useState(false);

  const handleSubmit = () => {
    onSubmit(wantToTip);
    setWantToTip(false);
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

  if (!song) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="glass-card border-primary/20 sm:max-w-md">
        <DialogHeader className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center">
            <Music className="w-8 h-8 text-primary" />
          </div>
          <div>
            <DialogTitle className="text-xl font-bold">{song.title}</DialogTitle>
            <DialogDescription className="text-muted-foreground mt-1">
              {song.artist}
            </DialogDescription>
          </div>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {hasPaymentHandles && (
            <div className="space-y-4">
              <div className="flex items-center space-x-3">
                <Checkbox
                  id="tip"
                  checked={wantToTip}
                  onCheckedChange={(checked) => setWantToTip(checked as boolean)}
                />
                <label
                  htmlFor="tip"
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
                  <div className="text-xs text-muted-foreground pt-2 border-t border-border/50 mt-3">
                    {paymentHandles.venmo && <p>Venmo: @{paymentHandles.venmo}</p>}
                    {paymentHandles.paypal && <p>PayPal: {paymentHandles.paypal}</p>}
                    {paymentHandles.cashapp && <p>Cash App: ${paymentHandles.cashapp.replace('$', '')}</p>}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex gap-3">
            <Button variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isLoading}
              className="flex-1 neon-glow-purple"
            >
              {isLoading ? 'Submitting...' : 'Request Song'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
