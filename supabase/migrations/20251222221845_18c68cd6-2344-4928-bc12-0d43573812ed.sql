-- Allow anyone to insert songs (for custom requests)
CREATE POLICY "Anyone can insert songs"
ON public.songs
FOR INSERT
WITH CHECK (true);