import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Request } from '@/types/vibequeue';

interface NotificationState {
  playingRequest: Request | null;
  rejectedRequest: Request | null;
}

export function useRequestNotifications(username: string | null) {
  const [notification, setNotification] = useState<NotificationState>({
    playingRequest: null,
    rejectedRequest: null,
  });
  
  // Track which requests we've already notified about
  const notifiedRequests = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!username) return;

    const channel = supabase
      .channel('user-request-notifications')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'requests',
        },
        async (payload) => {
          const updatedRequest = payload.new as any;
          
          // Only notify for this user's requests
          if (updatedRequest.requester_username !== username) return;
          
          // Check if we've already notified about this status change
          const notificationKey = `${updatedRequest.id}-${updatedRequest.status}`;
          if (notifiedRequests.current.has(notificationKey)) return;
          
          // Fetch the full request with song data
          const { data: fullRequest, error } = await supabase
            .from('requests')
            .select(`
              *,
              song:songs(*)
            `)
            .eq('id', updatedRequest.id)
            .single();
          
          if (error || !fullRequest) return;
          
          // Mark as notified
          notifiedRequests.current.add(notificationKey);
          
          if (updatedRequest.status === 'playing') {
            setNotification((prev) => ({ ...prev, playingRequest: fullRequest as Request }));
          } else if (updatedRequest.status === 'rejected') {
            setNotification((prev) => ({ ...prev, rejectedRequest: fullRequest as Request }));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [username]);

  const clearPlayingNotification = () => {
    setNotification((prev) => ({ ...prev, playingRequest: null }));
  };

  const clearRejectedNotification = () => {
    setNotification((prev) => ({ ...prev, rejectedRequest: null }));
  };

  return {
    playingRequest: notification.playingRequest,
    rejectedRequest: notification.rejectedRequest,
    clearPlayingNotification,
    clearRejectedNotification,
  };
}
