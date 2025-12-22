import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { Music, Lock, Loader2 } from 'lucide-react';

interface PinModalProps {
  open: boolean;
  onVerify: (pin: string) => Promise<boolean>;
  onSuccess: (pin: string) => void;
}

export function PinModal({ open, onVerify, onSuccess }: PinModalProps) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  const handleComplete = async (value: string) => {
    setPin(value);
    if (value.length === 4) {
      setIsVerifying(true);
      try {
        const isValid = await onVerify(value);
        if (isValid) {
          onSuccess(value);
        } else {
          setError(true);
          setTimeout(() => {
            setPin('');
            setError(false);
          }, 1000);
        }
      } catch (err) {
        setError(true);
        setTimeout(() => {
          setPin('');
          setError(false);
        }, 1000);
      } finally {
        setIsVerifying(false);
      }
    }
  };

  return (
    <Dialog open={open}>
      <DialogContent className="glass-card border-primary/20 sm:max-w-md">
        <DialogHeader className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center neon-glow-purple">
            <Lock className="w-8 h-8 text-primary" />
          </div>
          <DialogTitle className="text-2xl font-bold">DJ Console</DialogTitle>
          <p className="text-muted-foreground">Enter your PIN to access the console</p>
        </DialogHeader>

        <div className="flex flex-col items-center space-y-6 mt-4">
          <InputOTP
            maxLength={4}
            value={pin}
            onChange={handleComplete}
            disabled={isVerifying}
            className={error ? 'animate-shake' : ''}
          >
            <InputOTPGroup>
              <InputOTPSlot index={0} className={error ? 'border-destructive' : ''} />
              <InputOTPSlot index={1} className={error ? 'border-destructive' : ''} />
              <InputOTPSlot index={2} className={error ? 'border-destructive' : ''} />
              <InputOTPSlot index={3} className={error ? 'border-destructive' : ''} />
            </InputOTPGroup>
          </InputOTP>

          {isVerifying && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              Verifying...
            </div>
          )}

          {error && (
            <p className="text-sm text-destructive animate-fade-in">
              Incorrect PIN. Try again.
            </p>
          )}

          <p className="text-xs text-muted-foreground">
            Default PIN: 1234
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
