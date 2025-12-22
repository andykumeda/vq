-- Add unique constraint for upsert to work
ALTER TABLE public.songs ADD CONSTRAINT songs_title_artist_unique UNIQUE (title, artist);