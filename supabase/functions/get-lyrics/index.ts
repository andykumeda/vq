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

    const { q_track, q_artist } = await req.json();
    
    if (!q_track || !q_artist) {
      throw new Error('Track title and artist are required');
    }

    console.log(`Searching AudD lyrics for: ${q_track} by ${q_artist}`);

    // AudD findLyrics endpoint
    const url = new URL('https://api.audd.io/findLyrics/');
    url.searchParams.append('api_token', AUDD_API_TOKEN);
    url.searchParams.append('q', `${q_artist} ${q_track}`);

    const response = await fetch(url.toString());
    const data = await response.json();

    if (data.status === 'error') {
      throw new Error(data.error?.error_message || 'AudD request failed');
    }

    if (data.result && data.result.length > 0) {
      // Return the first match
      return new Response(JSON.stringify({
        success: true,
        lyrics: data.result[0].lyrics,
        title: data.result[0].title,
        artist: data.result[0].artist
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      success: false,
      message: 'Lyrics not found'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Lyrics error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});