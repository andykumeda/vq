import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { RequestStatus } from '@/types/vibequeue';
import { useEffect, useRef } from 'react';
import { apiRequest } from '@/lib/queryClient';

interface RequestWithSong {
  id: string;
  songId: string;
  requesterUsername: string;
  status: RequestStatus;
  isTipped: boolean;
  createdAt: string;
  updatedAt: string;
  song: {
    id: string;
    title: string;
    artist: string;
    genre: string | null;
    isAvailable: boolean;
    createdAt: string;
    updatedAt: string;
  };
}

export function useRequests() {
  const queryClient = useQueryClient();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const query = useQuery({
    queryKey: ['/api/requests'],
    queryFn: async () => {
      const res = await fetch('/api/requests');
      if (!res.ok) throw new Error('Failed to fetch requests');
      return res.json() as Promise<RequestWithSong[]>;
    },
  });

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ['/api/requests'] });
    }, 3000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
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
      const res = await apiRequest('POST', '/api/requests', {
        songId,
        requesterUsername: username,
        isTipped,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/requests'] });
    },
  });
}

export function useCreateCustomRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      title,
      artist,
      username,
      isTipped,
    }: {
      title: string;
      artist: string;
      username: string;
      isTipped: boolean;
    }) => {
      const songRes = await apiRequest('POST', '/api/songs', {
        title,
        artist,
        isAvailable: false,
      });
      const song = await songRes.json();

      const res = await apiRequest('POST', '/api/requests', {
        songId: song.id,
        requesterUsername: username,
        isTipped,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/requests'] });
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
      const res = await apiRequest('PATCH', `/api/requests/${requestId}`, { status });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/requests'] });
    },
  });
}

export function useCheckDuplicateRequest() {
  return async (songId: string): Promise<boolean> => {
    const res = await fetch(`/api/requests/check-duplicate/${songId}`);
    if (!res.ok) throw new Error('Failed to check duplicate');
    const data = await res.json();
    return data.isDuplicate;
  };
}

export function useCreateManualPlay() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      title,
      artist,
    }: {
      title: string;
      artist: string;
    }) => {
      const songRes = await apiRequest('POST', '/api/songs', {
        title,
        artist,
        isAvailable: false,
      });
      const song = await songRes.json();

      const res = await apiRequest('POST', '/api/requests', {
        songId: song.id,
        requesterUsername: 'DJ',
        isTipped: false,
        status: 'playing',
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/requests'] });
    },
  });
}

export function useUpdateSong() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      songId,
      title,
      artist,
    }: {
      songId: string;
      title: string;
      artist: string;
    }) => {
      const res = await apiRequest('PATCH', `/api/songs/${songId}`, { title, artist });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/requests'] });
    },
  });
}
