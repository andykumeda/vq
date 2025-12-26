import { useEffect, useRef, useState } from 'react';
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
  
  const notifiedRequests = useRef<Set<string>>(new Set());
  const previousRequests = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    if (!username) return;

    const checkForUpdates = async () => {
      try {
        const res = await fetch('/api/requests');
        if (!res.ok) return;
        
        const requests = await res.json();
        
        for (const request of requests) {
          if (request.requesterUsername !== username) continue;
          
          const notificationKey = `${request.id}-${request.status}`;
          const previousStatus = previousRequests.current.get(request.id);
          
          if (previousStatus && previousStatus !== request.status && !notifiedRequests.current.has(notificationKey)) {
            notifiedRequests.current.add(notificationKey);
            
            if (request.status === 'playing') {
              setNotification((prev) => ({ ...prev, playingRequest: request }));
            } else if (request.status === 'rejected') {
              setNotification((prev) => ({ ...prev, rejectedRequest: request }));
            }
          }
          
          previousRequests.current.set(request.id, request.status);
        }
      } catch (error) {
        console.error('Error checking for updates:', error);
      }
    };

    const interval = setInterval(checkForUpdates, 3000);
    checkForUpdates();

    return () => {
      clearInterval(interval);
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
