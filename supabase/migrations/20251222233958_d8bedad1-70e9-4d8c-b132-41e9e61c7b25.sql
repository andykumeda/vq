-- Fix: DJ PIN publicly readable - Update RLS policy to exclude sensitive settings from public view
DROP POLICY IF EXISTS "Anyone can view settings" ON public.settings;

-- Allow public read only for non-sensitive settings (event_name, payment handles)
CREATE POLICY "Anyone can view public settings"
ON public.settings
FOR SELECT
USING (key IN ('event_name', 'venmo_handle', 'paypal_handle', 'cashapp_handle', 'google_sheet_url'));

-- Remove the overly permissive "Service role can manage settings" policy
-- and replace with a more restrictive one that only allows service role access
DROP POLICY IF EXISTS "Service role can manage settings" ON public.settings;