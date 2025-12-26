import { useQuery } from '@tanstack/react-query';

export function useGenres() {
  return useQuery({
    queryKey: ['/api/genres'],
    queryFn: async () => {
      const res = await fetch('/api/genres');
      if (!res.ok) throw new Error('Failed to fetch genres');
      return res.json() as Promise<string[]>;
    },
  });
}
