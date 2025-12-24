import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Music, Heart, ExternalLink } from 'lucide-react';
import type { Request } from '@/types/vibequeue';

interface TippingModalProps {
  open: boolean;
  onClose: () => void;
  request: Request | null;
  paymentHandles: {
    venmo?: string;
    paypal?: string;
    cashapp?: string;
  };
}

export function TippingModal({ open, onClose, request, paymentHandles }: TippingModalProps) {
  if (!request?.song) return null;

  const hasPaymentOptions = paymentHandles.venmo || paymentHandles.paypal || paymentHandles.cashapp;

  const openPaymentLink = (type: 'venmo' | 'paypal' | 'cashapp', handle: string) => {
    let url = '';
    const cleanHandle = handle.replace('@', '').replace('$', '');
    
    switch (type) {
      case 'venmo':
        // Universal link that works on mobile and web
        url = `https://venmo.com/${cleanHandle}`;
        break;
      case 'paypal':
        url = `https://paypal.me/${cleanHandle}`;
        break;
      case 'cashapp':
        url = `https://cash.app/$${cleanHandle}`;
        break;
    }
    window.open(url, '_blank');
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-primary">
            <Music className="w-5 h-5" />
            Your Song is Playing!
          </DialogTitle>
          <DialogDescription className="text-base">
            <span className="font-semibold text-foreground">{request.song.title}</span>
            {' '}by{' '}
            <span className="text-muted-foreground">{request.song.artist}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {hasPaymentOptions && (
            <>
              <div className="text-center">
                <p className="text-sm text-muted-foreground flex items-center justify-center gap-2">
                  <Heart className="w-4 h-4 text-red-500" />
                  Enjoying the vibe? Show the DJ some love!
                </p>
              </div>

              <div className="grid gap-3">
                {paymentHandles.venmo && (
                  <Button
                    variant="outline"
                    className="w-full justify-between border-[#008CFF]/30 hover:bg-[#008CFF]/10 hover:border-[#008CFF]/50"
                    onClick={() => openPaymentLink('venmo', paymentHandles.venmo!)}
                  >
                    <span className="font-medium text-[#008CFF]">Venmo</span>
                    <span className="flex items-center gap-2 text-muted-foreground">
                      @{paymentHandles.venmo}
                      <ExternalLink className="w-4 h-4" />
                    </span>
                  </Button>
                )}

                {paymentHandles.paypal && (
                  <Button
                    variant="outline"
                    className="w-full justify-between border-[#003087]/30 hover:bg-[#003087]/10 hover:border-[#003087]/50"
                    onClick={() => openPaymentLink('paypal', paymentHandles.paypal!)}
                  >
                    <span className="font-medium text-[#003087]">PayPal</span>
                    <span className="flex items-center gap-2 text-muted-foreground">
                      @{paymentHandles.paypal}
                      <ExternalLink className="w-4 h-4" />
                    </span>
                  </Button>
                )}

                {paymentHandles.cashapp && (
                  <Button
                    variant="outline"
                    className="w-full justify-between border-[#00D632]/30 hover:bg-[#00D632]/10 hover:border-[#00D632]/50"
                    onClick={() => openPaymentLink('cashapp', paymentHandles.cashapp!)}
                  >
                    <span className="font-medium text-[#00D632]">Cash App</span>
                    <span className="flex items-center gap-2 text-muted-foreground">
                      ${paymentHandles.cashapp.replace('$', '')}
                      <ExternalLink className="w-4 h-4" />
                    </span>
                  </Button>
                )}
              </div>
            </>
          )}

          <Button onClick={onClose} className="w-full">
            {hasPaymentOptions ? 'Maybe Later' : 'Awesome!'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
