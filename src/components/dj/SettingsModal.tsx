import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Settings, Save, Loader2 } from 'lucide-react';
import { useSettings, useUpdateSetting } from '@/hooks/useSettings';
import { toast } from 'sonner';

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
  djPin: string;
}

export function SettingsModal({ open, onClose, djPin }: SettingsModalProps) {
  const { data: settings } = useSettings();
  const updateSetting = useUpdateSetting();
  const [isSaving, setIsSaving] = useState(false);

  const [formData, setFormData] = useState({
    dj_pin: '',
    venmo_handle: '',
    paypal_handle: '',
    cashapp_handle: '',
    event_name: '',
  });

  // Sync form data when settings load
  useEffect(() => {
    if (settings) {
      setFormData({
        dj_pin: settings.dj_pin || '',
        venmo_handle: settings.venmo_handle || '',
        paypal_handle: settings.paypal_handle || '',
        cashapp_handle: settings.cashapp_handle || '',
        event_name: settings.event_name || '',
      });
    }
  }, [settings, open]);

  const handleSave = async () => {
    if (!settings) return;
    setIsSaving(true);
    
    try {
      // Find keys that actually changed
      const changedEntries = Object.entries(formData).filter(([key, value]) => 
        value !== (settings[key] || '')
      );

      if (changedEntries.length === 0) {
        toast.info('No changes to save');
        onClose();
        return;
      }

      // Sort so dj_pin is updated last, to avoid invalidating the PIN for other updates in this batch
      const sortedEntries = [...changedEntries].sort(([a], [b]) => {
        if (a === 'dj_pin') return 1;
        if (b === 'dj_pin') return -1;
        return 0;
      });

      for (const [key, value] of sortedEntries) {
        await updateSetting.mutateAsync({ key, value, pin: djPin });
      }

      toast.success('Settings saved!');
      onClose();
    } catch (error: any) {
      console.error('Save settings error:', error);
      toast.error(error.message || 'Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="glass-card border-primary/20 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            DJ Settings
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          <div className="space-y-4">
            <div>
              <Label htmlFor="event_name">Event Name</Label>
              <Input
                id="event_name"
                value={formData.event_name || settings?.event_name || ''}
                onChange={(e) => setFormData({ ...formData, event_name: e.target.value })}
                placeholder="VibeQueue"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="dj_pin">Console PIN</Label>
              <Input
                id="dj_pin"
                type="password"
                value={formData.dj_pin || settings?.dj_pin || ''}
                onChange={(e) => setFormData({ ...formData, dj_pin: e.target.value })}
                placeholder="1234"
                maxLength={4}
                className="mt-1"
              />
            </div>
          </div>

          <div className="border-t border-border/50 pt-4">
            <h4 className="text-sm font-medium mb-4">Payment Handles (for tips)</h4>
            <div className="space-y-4">
              <div>
                <Label htmlFor="venmo">Venmo Username</Label>
                <Input
                  id="venmo"
                  value={formData.venmo_handle || settings?.venmo_handle || ''}
                  onChange={(e) => setFormData({ ...formData, venmo_handle: e.target.value })}
                  placeholder="@yourhandle"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="paypal">PayPal.me Username</Label>
                <Input
                  id="paypal"
                  value={formData.paypal_handle || settings?.paypal_handle || ''}
                  onChange={(e) => setFormData({ ...formData, paypal_handle: e.target.value })}
                  placeholder="yourhandle"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="cashapp">Cash App Handle</Label>
                <Input
                  id="cashapp"
                  value={formData.cashapp_handle || settings?.cashapp_handle || ''}
                  onChange={(e) => setFormData({ ...formData, cashapp_handle: e.target.value })}
                  placeholder="$yourhandle"
                  className="mt-1"
                />
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <Button variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSaving}
              className="flex-1"
            >
              {isSaving ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              {isSaving ? 'Saving...' : 'Save Settings'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
