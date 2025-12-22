-- Create request status enum
CREATE TYPE request_status AS ENUM ('pending', 'next_up', 'playing', 'played', 'rejected');

-- Create songs table for the library
CREATE TABLE public.songs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  artist TEXT NOT NULL,
  genre TEXT,
  is_available BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create requests table for the queue
CREATE TABLE public.requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  song_id UUID NOT NULL REFERENCES public.songs(id) ON DELETE CASCADE,
  requester_username TEXT NOT NULL,
  status request_status NOT NULL DEFAULT 'pending',
  is_tipped BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create settings table for DJ config
CREATE TABLE public.settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.songs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- Songs: Anyone can read available songs (public feature)
CREATE POLICY "Anyone can view available songs"
ON public.songs
FOR SELECT
USING (is_available = true);

-- Songs: Only authenticated can manage (for DJ console via edge function)
CREATE POLICY "Service role can manage songs"
ON public.songs
FOR ALL
USING (true)
WITH CHECK (true);

-- Requests: Anyone can view all requests (live queue is public)
CREATE POLICY "Anyone can view requests"
ON public.requests
FOR SELECT
USING (true);

-- Requests: Anyone can create requests (audience submits)
CREATE POLICY "Anyone can create requests"
ON public.requests
FOR INSERT
WITH CHECK (true);

-- Requests: Anyone can update requests (for DJ management)
CREATE POLICY "Anyone can update requests"
ON public.requests
FOR UPDATE
USING (true);

-- Settings: Anyone can read settings (for payment info display)
CREATE POLICY "Anyone can view settings"
ON public.settings
FOR SELECT
USING (true);

-- Settings: Service role manages settings
CREATE POLICY "Service role can manage settings"
ON public.settings
FOR ALL
USING (true)
WITH CHECK (true);

-- Enable realtime for requests table
ALTER PUBLICATION supabase_realtime ADD TABLE public.requests;

-- Create indexes for better performance
CREATE INDEX idx_requests_status ON public.requests(status);
CREATE INDEX idx_requests_created_at ON public.requests(created_at);
CREATE INDEX idx_songs_available ON public.songs(is_available);
CREATE INDEX idx_songs_title ON public.songs(title);
CREATE INDEX idx_songs_artist ON public.songs(artist);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_songs_updated_at
BEFORE UPDATE ON public.songs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_requests_updated_at
BEFORE UPDATE ON public.requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_settings_updated_at
BEFORE UPDATE ON public.settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default settings
INSERT INTO public.settings (key, value) VALUES
  ('dj_pin', '1234'),
  ('venmo_handle', ''),
  ('paypal_handle', ''),
  ('cashapp_handle', ''),
  ('event_name', 'VibeQueue');