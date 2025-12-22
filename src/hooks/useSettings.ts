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
    mutationFn: async ({ key, value }: { key: string; value: string }) => {
      const { data, error } = await supabase
        .from('settings')
        .update({ value })
        .eq('key', key)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
    },
  });
}

export function useVerifyPin() {
  const { data: settings } = useSettings();

  return (pin: string): boolean => {
    return settings?.dj_pin === pin;
  };
}
