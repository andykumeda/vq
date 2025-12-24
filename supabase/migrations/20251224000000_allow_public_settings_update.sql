-- Allow anyone to update settings
-- In a production app, you would restrict this to authenticated users or use an edge function
CREATE POLICY "Anyone can update settings"
ON public.settings
FOR UPDATE
USING (true)
WITH CHECK (true);
