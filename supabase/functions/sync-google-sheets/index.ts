import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Parse CSV row handling quoted fields
function parseCSVRow(row: string): string[] {
  const cols: string[] = [];
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
  return cols;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify DJ PIN before allowing sync
    let pin: string | null = null;
    try {
      const body = await req.json();
      pin = body?.pin;
    } catch {
      // No body provided
    }

    if (!pin || typeof pin !== 'string') {
      return new Response(
        JSON.stringify({ error: 'DJ PIN is required to sync library' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify PIN against stored value
    const { data: pinSetting, error: pinError } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'dj_pin')
      .single();

    if (pinError || pinSetting?.value !== pin) {
      return new Response(
        JSON.stringify({ error: 'Invalid DJ PIN' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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

    // Extract sheet ID
    const sheetUrl = sheetSetting.value;
    const sheetIdMatch = sheetUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (!sheetIdMatch) {
      return new Response(
        JSON.stringify({ error: 'Invalid Google Sheet URL' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const sheetId = sheetIdMatch[1];
    
    // First, get the spreadsheet metadata to find all sheet names
    const metadataUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/edit?format=json`;
    
    // Try to get sheet names by fetching the HTML and parsing it
    // Google Sheets exposes sheet names in the page content
    const htmlResponse = await fetch(`https://docs.google.com/spreadsheets/d/${sheetId}/edit`);
    const htmlText = await htmlResponse.text();
    
    // Extract sheet names from the HTML - Google embeds sheet data in the page
    const sheetNames: string[] = [];
    
    // Try to find sheet tabs in the HTML - they appear in a specific format
    const sheetTabMatches = htmlText.matchAll(/gid=(\d+)[^>]*>([^<]+)</g);
    for (const match of sheetTabMatches) {
      const name = match[2].trim();
      if (name && !sheetNames.includes(name)) {
        sheetNames.push(name);
      }
    }
    
    // If we couldn't find sheet names from HTML, try to infer from common patterns
    // Fallback: just fetch the first sheet and use genre column
    if (sheetNames.length === 0) {
      console.log('Could not extract sheet names, falling back to single sheet mode');
      
      const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`;
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

      const songs: { title: string; artist: string; genre: string | null; is_available: boolean }[] = [];
      const seen = new Set<string>();
      
      for (let i = 1; i < lines.length; i++) {
        const cols = parseCSVRow(lines[i]);
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

      await supabase.from('songs').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      
      for (let i = 0; i < songs.length; i += 50) {
        const batch = songs.slice(i, i + 50);
        const { error } = await supabase.from('songs').insert(batch);
        if (error) console.error('Insert error:', error);
      }

      return new Response(
        JSON.stringify({ success: true, count: songs.length, sheets: ['default'] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch each sheet by name and use sheet name as genre
    console.log(`Found ${sheetNames.length} sheets: ${sheetNames.join(', ')}`);
    
    const allSongs: { title: string; artist: string; genre: string; is_available: boolean }[] = [];
    const seen = new Set<string>();

    for (const sheetName of sheetNames) {
      const encodedSheetName = encodeURIComponent(sheetName);
      const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodedSheetName}`;
      
      console.log(`Fetching sheet: ${sheetName}`);
      
      try {
        const response = await fetch(csvUrl);
        if (!response.ok) {
          console.error(`Failed to fetch sheet ${sheetName}`);
          continue;
        }

        const csvText = await response.text();
        const lines = csvText.split('\n').filter(line => line.trim());
        
        if (lines.length < 2) {
          console.log(`Sheet ${sheetName} is empty or has only headers`);
          continue;
        }

        // Use sheet name as genre, skip first row (header)
        for (let i = 1; i < lines.length; i++) {
          const cols = parseCSVRow(lines[i]);
          if (!cols[0] || cols[0].trim() === '') continue;
          
          const title = cols[0] || 'Unknown';
          const artist = cols[1] || 'Unknown';
          const key = `${title}|||${artist}`.toLowerCase();
          
          if (!seen.has(key)) {
            seen.add(key);
            allSongs.push({
              title,
              artist,
              genre: sheetName, // Use sheet name as genre
              is_available: true,
            });
          }
        }
        
        console.log(`Parsed ${lines.length - 1} rows from sheet ${sheetName}`);
      } catch (err) {
        console.error(`Error fetching sheet ${sheetName}:`, err);
      }
    }

    console.log(`Total unique songs: ${allSongs.length}`);

    // Clear existing songs and insert fresh data
    await supabase.from('songs').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    
    // Insert in batches of 50
    for (let i = 0; i < allSongs.length; i += 50) {
      const batch = allSongs.slice(i, i + 50);
      const { error } = await supabase.from('songs').insert(batch);
      if (error) {
        console.error('Insert error:', error);
      }
    }

    return new Response(
      JSON.stringify({ success: true, count: allSongs.length, sheets: sheetNames }),
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
