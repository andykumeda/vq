import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { PaymentHandles } from '@/types/vibequeue';
import { apiRequest } from '@/lib/queryClient';

export function useSettings() {
  return useQuery({
    queryKey: ['/api/settings'],
    queryFn: async () => {
      const res = await fetch('/api/settings');
      if (!res.ok) throw new Error('Failed to fetch settings');
      return res.json() as Promise<Record<string, string>>;
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
      const res = await apiRequest('POST', '/api/update-settings', { key, value, pin });
      const data = await res.json();
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/settings'] });
    },
  });
}

export function useVerifyPin() {
  return async (pin: string): Promise<boolean> => {
    try {
      const res = await fetch('/api/verify-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      });
      
      if (!res.ok) return false;
      const data = await res.json();
      return data?.valid === true;
    } catch (error) {
      console.error('PIN verification error:', error);
      return false;
    }
  };
}

export function useSyncGoogleSheets() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (pin: string) => {
      const res = await apiRequest('POST', '/api/sync-google-sheets', { pin });
      const data = await res.json();
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/songs'] });
      queryClient.invalidateQueries({ queryKey: ['/api/genres'] });
    },
  });
}
