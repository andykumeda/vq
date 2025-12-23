import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function useGenres() {
  return useQuery({
    queryKey: ['genres'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('songs')
        .select('genre')
        .eq('is_available', true)
        .not('genre', 'is', null);

      if (error) throw error;

      // Get unique genres
      const genres = [...new Set(data.map((s) => s.genre).filter(Boolean))] as string[];
      return genres.sort();
    },
  });
}
