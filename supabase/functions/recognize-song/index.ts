import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const AUDD_API_TOKEN = Deno.env.get('AUDD_API_TOKEN');
    if (!AUDD_API_TOKEN) {
      throw new Error('AUDD_API_TOKEN is not configured');
    }

    const { audio } = await req.json();
    
    if (!audio) {
      throw new Error('No audio data provided');
    }

    console.log('Sending audio to AudD for recognition...');

    const formData = new FormData();
    formData.append('api_token', AUDD_API_TOKEN);
    formData.append('audio', audio);
    formData.append('return', 'apple_music,spotify');

    const response = await fetch('https://api.audd.io/', {
      method: 'POST',
      body: formData,
    });

    const data = await response.json();
    console.log('AudD response:', JSON.stringify(data));

    if (data.status === 'error') {
      throw new Error(data.error?.error_message || 'Recognition failed');
    }

    if (data.result) {
      return new Response(JSON.stringify({
        success: true,
        song: {
          title: data.result.title,
          artist: data.result.artist,
          album: data.result.album,
          release_date: data.result.release_date,
          spotify: data.result.spotify,
          apple_music: data.result.apple_music,
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      success: false,
      message: 'No song recognized'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Recognition error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
