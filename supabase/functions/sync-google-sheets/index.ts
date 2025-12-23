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
    
    // Discover sheet tabs (name + gid) without hardcoding.
    // We first try parsing the Google Sheets HTML (works for "Anyone with link" shared sheets).
    // If that fails, we fall back to the public worksheets feed (requires "Publish to web").

    const sheetTabs: { name: string; gid: string }[] = [];

    const pushUniqueTab = (name: string, gid: string) => {
      const trimmed = name.trim();
      if (!trimmed || !gid) return;
      if (!sheetTabs.some((t) => t.gid === gid)) sheetTabs.push({ name: trimmed, gid });
    };

    // 1) Parse HTML for sheet metadata
    try {
      const htmlUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/edit?usp=sharing`;
      const htmlRes = await fetch(htmlUrl);
      if (htmlRes.ok) {
        const html = await htmlRes.text();

        // Common patterns in bootstrap data:
        //   "sheetId":0,..."title":"My Tab"
        //   "title":"My Tab",..."sheetId":0
        const patterns = [
          /"sheetId"\s*:\s*(\d+)[\s\S]*?"title"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/g,
          /"title"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"[\s\S]*?"sheetId"\s*:\s*(\d+)/g,
        ];

        for (const re of patterns) {
          let m: RegExpExecArray | null;
          while ((m = re.exec(html))) {
            const gid = re === patterns[0] ? m[1] : m[2];
            const rawTitle = re === patterns[0] ? m[2] : m[1];
            const name = rawTitle
              .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
              .replace(/\\n/g, ' ')
              .replace(/\\"/g, '"')
              .trim();

            // Avoid accidental matches from unrelated embedded strings
            if (name && name.length <= 80) pushUniqueTab(name, gid);
          }
        }

        if (sheetTabs.length > 0) {
          console.log(`Discovered ${sheetTabs.length} sheets via HTML: ${sheetTabs.map((s) => s.name).join(', ')}`);
        }
      }
    } catch (e) {
      console.log('Failed to parse sheet HTML for tabs:', e);
    }

    // 2) Fallback: public worksheets feed (requires "Publish to web")
    if (sheetTabs.length === 0) {
      const feedUrl = `https://spreadsheets.google.com/feeds/worksheets/${sheetId}/public/full?alt=json`;

      type FeedEntry = {
        title?: { $t?: string };
        id?: { $t?: string };
        link?: { rel?: string; href?: string }[];
      };

      try {
        const feedRes = await fetch(feedUrl);
        if (!feedRes.ok) {
          console.log(`Worksheets feed not accessible (status=${feedRes.status}). Spreadsheet likely not published to web.`);
        } else {
          const feedJson = await feedRes.json();
          const entries: FeedEntry[] = feedJson?.feed?.entry ?? [];

          for (const entry of entries) {
            const name = entry?.title?.$t?.trim();
            if (!name) continue;

            const idText = entry?.id?.$t ?? '';
            const hrefText = (entry?.link ?? []).map((l) => l.href).join(' ');
            const combined = `${idText} ${hrefText}`;
            const gidMatch = combined.match(/gid=(\d+)/);

            if (gidMatch?.[1]) {
              pushUniqueTab(name, gidMatch[1]);
            } else {
              console.log(`Could not find gid for sheet: ${name}`);
            }
          }

          if (sheetTabs.length > 0) {
            console.log(`Discovered ${sheetTabs.length} sheets via feed: ${sheetTabs.map((s) => s.name).join(', ')}`);
          }
        }
      } catch (e) {
        console.log('Failed to read worksheets feed:', e);
      }
    }

    // If we have sheet tabs, import each tab using gid-based CSV export (reliable)
    if (sheetTabs.length > 0) {
      const allSongs: { title: string; artist: string; genre: string; is_available: boolean }[] = [];
      const seen = new Set<string>();

      for (const tab of sheetTabs) {
        const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${tab.gid}`;
        console.log(`Fetching sheet: ${tab.name} (gid=${tab.gid})`);

        const res = await fetch(csvUrl);
        if (!res.ok) {
          console.log(`Failed to fetch sheet ${tab.name} (gid=${tab.gid}) status=${res.status}`);
          continue;
        }

        const csvText = await res.text();
        const lines = csvText.split('\n').filter((line) => line.trim());
        if (lines.length < 2) {
          console.log(`Sheet ${tab.name} has no data rows`);
          continue;
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
              genre: tab.name,
              is_available: true,
            });
          }
        }

        console.log(`Parsed ${lines.length - 1} rows from sheet ${tab.name}`);
      }

      console.log(`Total unique songs: ${allSongs.length}`);

      await supabase.from('songs').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      for (let i = 0; i < allSongs.length; i += 50) {
        const batch = allSongs.slice(i, i + 50);
        const { error } = await supabase.from('songs').insert(batch);
        if (error) console.error('Insert error:', error);
      }

      return new Response(
        JSON.stringify({ success: true, count: allSongs.length, sheets: sheetTabs.map((s) => s.name) }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fallback: single-sheet mode where column 3 is genre
    console.log('Multi-sheet discovery failed (spreadsheet not published?). Falling back to single sheet mode with genre in 3rd column.');

    const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`;
    const response = await fetch(csvUrl);
    if (!response.ok) {
      return new Response(
        JSON.stringify({
          error: 'Failed to fetch Google Sheet. Make sure it is publicly accessible. If you want multi-sheet genres, publish the sheet to the web.',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const csvText = await response.text();
    const lines = csvText.split('\n').filter((line) => line.trim());

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
        songs.push({ title, artist, genre, is_available: true });
      }
    }

    await supabase.from('songs').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    for (let i = 0; i < songs.length; i += 50) {
      const batch = songs.slice(i, i + 50);
      const { error } = await supabase.from('songs').insert(batch);
      if (error) console.error('Insert error:', error);
    }

    return new Response(
      JSON.stringify({ success: true, count: songs.length, sheets: ['default'], genres: Array.from(genreSet).sort() }),
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
