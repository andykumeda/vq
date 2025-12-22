import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Request, RequestStatus } from '@/types/vibequeue';
import { useEffect } from 'react';

export function useRequests() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['requests'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('requests')
        .select(`
          *,
          song:songs(*)
        `)
        .in('status', ['pending', 'next_up', 'playing'])
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data as Request[];
    },
  });

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel('requests-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'requests',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['requests'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return query;
}

export function useCreateRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      songId,
      username,
      isTipped,
    }: {
      songId: string;
      username: string;
      isTipped: boolean;
    }) => {
      const { data, error } = await supabase
        .from('requests')
        .insert({
          song_id: songId,
          requester_username: username,
          is_tipped: isTipped,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['requests'] });
    },
  });
}

export function useUpdateRequestStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      requestId,
      status,
    }: {
      requestId: string;
      status: RequestStatus;
    }) => {
      const { data, error } = await supabase
        .from('requests')
        .update({ status })
        .eq('id', requestId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['requests'] });
    },
  });
}

export function useCheckDuplicateRequest() {
  return async (songId: string): Promise<boolean> => {
    const { data, error } = await supabase
      .from('requests')
      .select('id')
      .eq('song_id', songId)
      .in('status', ['pending', 'next_up', 'playing'])
      .limit(1);

    if (error) throw error;
    return data.length > 0;
  };
}
