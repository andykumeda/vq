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
    // Strategy:
    //  1) Parse the Google Sheets HTML for (gid + title) pairs (works for "Anyone with link" sharing).
    //  2) If that fails, try the public worksheets feed (requires "Publish to web").
    //  3) If we still don't have multiple tabs, probe gids by attempting CSV exports and infer the tab name
    //     from the Content-Disposition filename.

    const sheetTabs: { name: string; gid: string }[] = [];

    const pushUniqueTab = (name: string, gid: string) => {
      const trimmed = name.trim();
      if (!trimmed || !gid) return;
      if (!sheetTabs.some((t) => t.gid === gid)) sheetTabs.push({ name: trimmed, gid });
    };

    const decodeGoogleString = (raw: string) =>
      raw
        .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
        .replace(/\\n/g, ' ')
        .replace(/\\"/g, '"')
        .trim();

    // 1) Parse HTML for sheet metadata
    try {
      const htmlUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/edit?usp=sharing`;
      const htmlRes = await fetch(htmlUrl);
      if (htmlRes.ok) {
        const html = await htmlRes.text();

        // Patterns observed in Google Sheets bootstrap data.
        // We try multiple patterns because Google changes markup frequently.
        const patterns: RegExp[] = [
          // "sheetId":0 ... "title":"Rock"
          /"sheetId"\s*:\s*(\d+)[\s\S]*?"title"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/g,
          // "title":"Rock" ... "sheetId":0
          /"title"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"[\s\S]*?"sheetId"\s*:\s*(\d+)/g,
          // "gid":123 ... "name":"Rock"
          /"gid"\s*:\s*(\d+)[\s\S]*?"name"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/g,
          // "name":"Rock" ... "gid":123
          /"name"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"[\s\S]*?"gid"\s*:\s*(\d+)/g,
        ];

        for (const re of patterns) {
          let m: RegExpExecArray | null;
          while ((m = re.exec(html))) {
            const gid = m[1] && /^\d+$/.test(m[1]) ? m[1] : m[2];
            const rawTitle = gid === m[1] ? m[2] : m[1];
            const name = decodeGoogleString(rawTitle);
            if (name && name.length <= 120) pushUniqueTab(name, gid);
          }
        }

        if (sheetTabs.length > 0) {
          console.log(
            `Discovered ${sheetTabs.length} sheets via HTML: ${sheetTabs.map((s) => `${s.name}(gid=${s.gid})`).join(', ')}`
          );
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
          console.log(
            `Worksheets feed not accessible (status=${feedRes.status}). Spreadsheet likely not published to web.`
          );
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
            console.log(
              `Discovered ${sheetTabs.length} sheets via feed: ${sheetTabs.map((s) => `${s.name}(gid=${s.gid})`).join(', ')}`
            );
          }
        }
      } catch (e) {
        console.log('Failed to read worksheets feed:', e);
      }
    }

    // 3) If we still don't have multiple tabs, probe gids and infer sheet names from filename.
    // This is slower, so we keep the probe bounded.
    if (sheetTabs.length <= 1) {
      const maxSheetsToFind = 25;
      const maxGidToProbe = 500; // bounded scan
      let consecutiveFails = 0;
      const maxConsecutiveFails = 60;

      console.log(`Probing gids for additional sheets (current=${sheetTabs.length})...`);

      for (let gid = 0; gid <= maxGidToProbe; gid++) {
        if (sheetTabs.length >= maxSheetsToFind) break;
        if (consecutiveFails >= maxConsecutiveFails) break;
        const gidStr = String(gid);
        if (sheetTabs.some((t) => t.gid === gidStr)) continue;

        const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gidStr}`;
        const res = await fetch(csvUrl);

        // 200 doesn't guarantee a real sheet; some responses are tiny error pages.
        if (!res.ok) {
          consecutiveFails++;
          continue;
        }

        const contentType = res.headers.get('content-type') ?? '';
        if (!contentType.includes('text/csv') && !contentType.includes('application/vnd.ms-excel')) {
          consecutiveFails++;
          continue;
        }

        const disposition = res.headers.get('content-disposition') ?? '';
        const filenameMatch = disposition.match(/filename\*=UTF-8''([^;]+)|filename="([^"]+)"/i);
        const filenameRaw = filenameMatch?.[1] ?? filenameMatch?.[2] ?? '';
        const filename = decodeURIComponent(filenameRaw);
        const inferredName = filename.replace(/\.csv$/i, '').trim();

        const csvText = await res.text();
        const lines = csvText.split('\n').filter((l) => l.trim());
        if (lines.length < 2) {
          consecutiveFails++;
          continue;
        }

        const name = inferredName && inferredName.length <= 120 ? inferredName : `Sheet ${gidStr}`;
        pushUniqueTab(name, gidStr);
        consecutiveFails = 0;
      }

      if (sheetTabs.length > 1) {
        console.log(
          `After probing, discovered ${sheetTabs.length} sheets: ${sheetTabs.map((s) => `${s.name}(gid=${s.gid})`).join(', ')}`
        );
      }
    }

    // If we have sheet tabs, import each tab using gid-based CSV export
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
