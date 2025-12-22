import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get Google Sheet URL from settings
    const { data: sheetSetting } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'google_sheet_url')
      .single();

    if (!sheetSetting?.value) {
      return new Response(
        JSON.stringify({ error: 'Google Sheet URL not configured. Add it in DJ Settings.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract sheet ID and convert to CSV export URL
    const sheetUrl = sheetSetting.value;
    const sheetIdMatch = sheetUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (!sheetIdMatch) {
      return new Response(
        JSON.stringify({ error: 'Invalid Google Sheet URL' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const sheetId = sheetIdMatch[1];
    const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`;

    // Fetch CSV data
    const response = await fetch(csvUrl);
    if (!response.ok) {
      return new Response(
        JSON.stringify({ error: 'Failed to fetch Google Sheet. Make sure it is publicly accessible.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const csvText = await response.text();
    const lines = csvText.split('\n').filter(line => line.trim());
    
    if (lines.length < 2) {
      return new Response(
        JSON.stringify({ error: 'Sheet is empty or has no data rows' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse CSV - Row 1 is header, data starts at row 2
    // Sheet format: Track Name, Artist Name(s), Genre
    const songs: { title: string; artist: string; genre: string | null; is_available: boolean }[] = [];
    const seen = new Set<string>();
    for (let i = 1; i < lines.length; i++) {
      // Handle CSV with quoted fields containing commas
      const row = lines[i];
      const cols = [];
      let current = '';
      let inQuotes = false;
      
      for (let j = 0; j < row.length; j++) {
        const char = row[j];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          cols.push(current.trim().replace(/^"|"$/g, ''));
          current = '';
        } else {
          current += char;
        }
      }
      cols.push(current.trim().replace(/^"|"$/g, ''));
      
      // Skip empty rows
      if (!cols[0] || cols[0].trim() === '') continue;
      
      const key = `${cols[0]}|||${cols[1]}`.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        songs.push({
          title: cols[0] || 'Unknown',
          artist: cols[1] || 'Unknown',
          genre: cols[2] || null,
          is_available: true,
        });
      }
    }
    
    console.log(`Parsed ${songs.length} unique songs from CSV`);

    // Clear existing songs and insert fresh data
    await supabase.from('songs').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    
    // Insert in batches of 50
    for (let i = 0; i < songs.length; i += 50) {
      const batch = songs.slice(i, i + 50);
      const { error } = await supabase.from('songs').insert(batch);
      if (error) {
        console.error('Insert error:', error);
      }
    }

    return new Response(
      JSON.stringify({ success: true, count: songs.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Sync error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
