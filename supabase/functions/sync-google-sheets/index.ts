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
    
    // Get sheet names by fetching the feed endpoint which works for public sheets
    const sheetNames: string[] = [];
    const sheetGids: number[] = [];
    
    try {
      // Try fetching the HTML and looking for sheet info in the embedded JSON data
      const htmlResponse = await fetch(`https://docs.google.com/spreadsheets/d/${sheetId}/edit?usp=sharing`);
      const htmlText = await htmlResponse.text();
      
      // Look for the sheet metadata in the page's embedded data
      // Google embeds sheet info in a specific JavaScript variable
      const jsonMatch = htmlText.match(/\{"sheets":\[(\{[^\]]+\})\]/);
      if (jsonMatch) {
        try {
          const sheetsData = JSON.parse(`[${jsonMatch[1]}]`);
          for (const sheet of sheetsData) {
            if (sheet.name) {
              sheetNames.push(sheet.name);
              if (sheet.sheetId !== undefined) sheetGids.push(sheet.sheetId);
            }
          }
        } catch (e) {
          console.log('Could not parse embedded JSON:', e);
        }
      }
      
      // Alternative: Look for gid patterns with names
      if (sheetNames.length === 0) {
        // Pattern: "name":"SheetName","index":0,"sheetId":123
        const pattern = /"name":"([^"]+)","index":\d+,"sheetId":(\d+)/g;
        let match;
        while ((match = pattern.exec(htmlText)) !== null) {
          const name = match[1].replace(/\\u([0-9A-Fa-f]{4})/g, (_, hex) => 
            String.fromCharCode(parseInt(hex, 16))
          );
          if (!sheetNames.includes(name)) {
            sheetNames.push(name);
            sheetGids.push(parseInt(match[2]));
          }
        }
      }
      
      // Try another pattern commonly found in Google Sheets HTML
      if (sheetNames.length === 0) {
        const pattern2 = /\["([^"]+)",\d+,\d+,(\d+),/g;
        let match;
        while ((match = pattern2.exec(htmlText)) !== null) {
          const name = match[1];
          // Filter out obvious non-sheet names
          if (name && name.length < 50 && !name.includes('http') && !sheetNames.includes(name)) {
            sheetNames.push(name);
            sheetGids.push(parseInt(match[2]));
          }
        }
      }
      
      console.log(`Found ${sheetNames.length} sheets via HTML parsing: ${sheetNames.join(', ')}`);
    } catch (err) {
      console.log('Could not parse HTML for sheet names:', err);
    }
    
    // If HTML parsing failed, try to discover sheets by testing common gids
    if (sheetNames.length === 0) {
      console.log('HTML parsing failed, trying to discover sheets via gid probing...');
      
      // Try gid=0 first (default sheet), then probe a few more
      const testGids = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
      
      for (const gid of testGids) {
        try {
          const testUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;
          const response = await fetch(testUrl, { method: 'HEAD' });
          
          if (response.ok) {
            // Sheet exists, now get its content to find the name
            // We'll use the gid as a temporary identifier
            sheetGids.push(gid);
            console.log(`Found sheet at gid=${gid}`);
          }
        } catch (e) {
          // Sheet doesn't exist at this gid
        }
      }
      
      // If we found sheets by gid, fetch them
      if (sheetGids.length > 0) {
        console.log(`Discovered ${sheetGids.length} sheets by gid probing`);
        
        const allSongs: { title: string; artist: string; genre: string; is_available: boolean }[] = [];
        const seen = new Set<string>();
        const foundGenres: string[] = [];
        
        for (const gid of sheetGids) {
          const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;
          
          try {
            const response = await fetch(csvUrl);
            if (!response.ok) continue;
            
            const csvText = await response.text();
            const lines = csvText.split('\n').filter(line => line.trim());
            
            if (lines.length < 2) continue;
            
            // Try to infer sheet name from first row header or use gid as fallback
            // Check if there's a pattern in the data that suggests a genre/category
            const headerCols = parseCSVRow(lines[0]);
            
            // Use the response URL or a pattern to identify sheet name
            // For now, we'll need to look at the data or use gid
            let sheetName = `Sheet ${gid + 1}`;
            
            // Check content-disposition header for sheet name
            const contentDisposition = response.headers.get('content-disposition');
            if (contentDisposition) {
              const nameMatch = contentDisposition.match(/filename\*?=(?:UTF-8'')?["']?([^"';\n]+)/i);
              if (nameMatch) {
                // Extract sheet name from filename like "Spreadsheet Name - SheetName.csv"
                const filename = decodeURIComponent(nameMatch[1]);
                const parts = filename.replace('.csv', '').split(' - ');
                if (parts.length > 1) {
                  sheetName = parts[parts.length - 1].trim();
                }
              }
            }
            
            if (!foundGenres.includes(sheetName)) {
              foundGenres.push(sheetName);
            }
            
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
                  genre: sheetName,
                  is_available: true,
                });
              }
            }
            
            console.log(`Parsed ${lines.length - 1} rows from gid=${gid} (${sheetName})`);
          } catch (err) {
            console.error(`Error fetching gid=${gid}:`, err);
          }
        }
        
        if (allSongs.length > 0) {
          await supabase.from('songs').delete().neq('id', '00000000-0000-0000-0000-000000000000');
          
          for (let i = 0; i < allSongs.length; i += 50) {
            const batch = allSongs.slice(i, i + 50);
            const { error } = await supabase.from('songs').insert(batch);
            if (error) console.error('Insert error:', error);
          }
          
          return new Response(
            JSON.stringify({ 
              success: true, 
              count: allSongs.length, 
              sheets: foundGenres,
              message: `Imported ${allSongs.length} songs from ${foundGenres.length} sheets`
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
      
      // Final fallback: single sheet mode with genre column
      console.log('Falling back to single sheet mode with genre column');
      
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
      const seenSongs = new Set<string>();
      const genreSet = new Set<string>();
      
      for (let i = 1; i < lines.length; i++) {
        const cols = parseCSVRow(lines[i]);
        if (!cols[0] || cols[0].trim() === '') continue;
        
        const title = cols[0] || 'Unknown';
        const artist = cols[1] || 'Unknown';
        const genre = cols[2]?.trim() || null;
        
        if (genre) genreSet.add(genre);
        
        const key = `${title}|||${artist}`.toLowerCase();
        if (!seenSongs.has(key)) {
          seenSongs.add(key);
          songs.push({
            title,
            artist,
            genre,
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
        JSON.stringify({ 
          success: true, 
          count: songs.length, 
          sheets: ['default'],
          genres: Array.from(genreSet).sort()
        }),
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
