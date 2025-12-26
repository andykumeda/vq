import { useQuery } from '@tanstack/react-query';
import type { Song } from '@/types/vibequeue';

export function useSongs(searchQuery: string = '', genreFilters: string[] = []) {
  return useQuery({
    queryKey: ['/api/songs', searchQuery, genreFilters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchQuery.trim()) {
        params.set('search', searchQuery);
      }
      if (genreFilters.length > 0) {
        params.set('genres', genreFilters.join(','));
      }
      
      const url = `/api/songs${params.toString() ? `?${params.toString()}` : ''}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch songs');
      return res.json() as Promise<Song[]>;
    },
  });
}
