import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Song } from '@/types/vibequeue';

export function useSongs(searchQuery: string = '', genreFilters: string[] = []) {
  return useQuery({
    queryKey: ['songs', searchQuery, genreFilters],
    queryFn: async () => {
      let query = supabase
        .from('songs')
        .select('*')
        .eq('is_available', true)
        .order('title');

      if (searchQuery.trim()) {
        query = query.or(`title.ilike.%${searchQuery}%,artist.ilike.%${searchQuery}%`);
      }

      if (genreFilters.length > 0) {
        query = query.in('genre', genreFilters);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as Song[];
    },
  });
}
