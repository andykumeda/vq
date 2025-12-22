import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Allowed settings keys that can be updated
const ALLOWED_KEYS = ['event_name', 'dj_pin', 'venmo_handle', 'paypal_handle', 'cashapp_handle', 'google_sheet_url'];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { pin, key, value } = await req.json();

    // Validate input
    if (!pin || typeof pin !== 'string') {
      return new Response(
        JSON.stringify({ error: 'DJ PIN is required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!key || typeof key !== 'string' || !ALLOWED_KEYS.includes(key)) {
      return new Response(
        JSON.stringify({ error: 'Invalid setting key' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (value === undefined || typeof value !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Value is required and must be a string' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate PIN format (should be 4 digits for dj_pin)
    if (key === 'dj_pin' && !/^\d{4}$/.test(value)) {
      return new Response(
        JSON.stringify({ error: 'DJ PIN must be 4 digits' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify DJ PIN
    const { data: pinSetting, error: pinError } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'dj_pin')
      .single();

    if (pinError) {
      console.error('Error fetching PIN:', pinError);
      return new Response(
        JSON.stringify({ error: 'Failed to verify PIN' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (pinSetting?.value !== pin) {
      return new Response(
        JSON.stringify({ error: 'Invalid DJ PIN' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update the setting
    const { data, error: updateError } = await supabase
      .from('settings')
      .update({ value })
      .eq('key', key)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating setting:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to update setting' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Setting '${key}' updated successfully`);

    return new Response(
      JSON.stringify({ success: true, data }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Update settings error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
