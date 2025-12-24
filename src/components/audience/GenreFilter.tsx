import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Check } from 'lucide-react';

interface GenreFilterProps {
  genres: string[];
  selectedGenres: string[];
  onToggleGenre: (genre: string) => void;
  onClearAll: () => void;
}

export function GenreFilter({ genres, selectedGenres = [], onToggleGenre, onClearAll }: GenreFilterProps) {
  const allSelected = selectedGenres.length === 0;

  return (
    <ScrollArea className="w-full whitespace-nowrap">
      <div className="flex gap-2 pb-2">
        <Button
          variant={allSelected ? 'default' : 'outline'}
          size="sm"
          onClick={onClearAll}
          className="flex-shrink-0"
        >
          All
        </Button>
        {genres.map((genre) => {
          const isSelected = selectedGenres.includes(genre);
          return (
            <Button
              key={genre}
              variant={isSelected ? 'default' : 'outline'}
              size="sm"
              onClick={() => onToggleGenre(genre)}
              className="flex-shrink-0 gap-1"
            >
              {isSelected && <Check className="w-3 h-3" />}
              {genre}
            </Button>
          );
        })}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
}
