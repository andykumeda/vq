import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { PaymentHandles } from '@/types/vibequeue';

export function useSettings() {
  return useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('settings')
        .select('*');

      if (error) throw error;

      const settings: Record<string, string> = {};
      data.forEach((s) => {
        settings[s.key] = s.value;
      });

      return settings;
    },
  });
}

export function usePaymentHandles() {
  const { data: settings, isLoading } = useSettings();

  const handles: PaymentHandles = {
    venmo: settings?.venmo_handle || '',
    paypal: settings?.paypal_handle || '',
    cashapp: settings?.cashapp_handle || '',
  };

  return { handles, isLoading };
}

export function useUpdateSetting() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ key, value, pin }: { key: string; value: string; pin: string }) => {
      const { data, error } = await supabase.functions.invoke('update-settings', {
        body: { key, value, pin }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
    },
  });
}

export function useVerifyPin() {
  return async (pin: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase.functions.invoke('verify-dj-pin', {
        body: { pin }
      });
      
      if (error) {
        console.error('PIN verification error:', error);
        return false;
      }
      
      return data?.valid === true;
    } catch (error) {
      console.error('PIN verification error:', error);
      return false;
    }
  };
}
