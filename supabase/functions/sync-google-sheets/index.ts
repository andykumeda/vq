import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Parse CSV row handling quoted fields
function parseCSVRow(row: string): string[] {
  const cols: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let j = 0; j < row.length; j++) {
    const char = row[j];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      cols.push(current.trim().replace(/^"|"$/g, ""));
      current = "";
    } else {
      current += char;
    }
  }
  cols.push(current.trim().replace(/^"|"$/g, ""));
  return cols;
}

function parseSheetIdFromUrl(url: string): string | null {
  const m = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
  return m?.[1] ?? null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify DJ PIN before allowing sync
    let pin: string | null = null;
    try {
      const body = await req.json();
      pin = body?.pin;
    } catch {
      // No body provided
    }

    if (!pin || typeof pin !== "string") {
      return new Response(JSON.stringify({ error: "DJ PIN is required to sync library" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: pinSetting, error: pinError } = await supabase
      .from("settings")
      .select("value")
      .eq("key", "dj_pin")
      .single();

    if (pinError || pinSetting?.value !== pin) {
      return new Response(JSON.stringify({ error: "Invalid DJ PIN" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get Google Sheet URL from settings
    const { data: sheetSetting } = await supabase
      .from("settings")
      .select("value")
      .eq("key", "google_sheet_url")
      .single();

    if (!sheetSetting?.value) {
      return new Response(
        JSON.stringify({ error: "Google Sheet URL not configured. Add it in DJ Settings." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const sheetUrl = sheetSetting.value;
    const sheetId = parseSheetIdFromUrl(sheetUrl);
    if (!sheetId) {
      return new Response(JSON.stringify({ error: "Invalid Google Sheet URL" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Strategy: Use Google's public feeds API to get sheet metadata including all tab names and gids.
    // This endpoint works for public sheets without authentication.
    // URL: https://spreadsheets.google.com/feeds/worksheets/{sheetId}/public/basic?alt=json
    
    const sheetTabs: { name: string; gid: string }[] = [];
    
    try {
      // Try the newer Sheets v4-like public endpoint first (works for many public sheets)
      // Format: https://docs.google.com/spreadsheets/d/{id}/gviz/tq?tqx=out:json&sheet={sheetName}
      // But we need sheet names first, so let's try another approach:
      
      // Approach: Probe gid=0 first, then try to find other sheets by checking common patterns
      // OR use the worksheets feed which returns all sheet names
      
      const feedUrl = `https://spreadsheets.google.com/feeds/worksheets/${sheetId}/public/basic?alt=json`;
      console.log(`Fetching worksheets feed: ${feedUrl}`);
      
      const feedRes = await fetch(feedUrl);
      console.log(`Worksheets feed status: ${feedRes.status}`);
      
      if (feedRes.ok) {
        const feedData = await feedRes.json();
        const entries = feedData?.feed?.entry || [];
        
        console.log(`Found ${entries.length} sheets in feed`);
        
        for (const entry of entries) {
          const title = entry.title?.$t || "Unknown";
          // The link contains the gid in the format: .../od6 or similar, but we need to extract from id
          // The id format is: https://spreadsheets.google.com/feeds/worksheets/{sheetId}/public/basic/{worksheetId}
          // We can use the worksheetId to construct a proper gid
          const entryId = entry.id?.$t || "";
          const worksheetIdMatch = entryId.match(/\/([^/]+)$/);
          const worksheetId = worksheetIdMatch?.[1] || "";
          
          // The worksheetId in feeds API is like 'od6', 'od7', etc. or the actual gid
          // We need to find the actual gid - it's often embedded in the link
          const links = entry.link || [];
          let gid = "0";
          
          for (const link of links) {
            const href = link.href || "";
            const gidMatch = href.match(/gid=(\d+)/);
            if (gidMatch) {
              gid = gidMatch[1];
              break;
            }
          }
          
          // If no gid found in links, try to get it from the export URL
          if (gid === "0" && worksheetId && worksheetId !== "od6") {
            // Try fetching with the worksheet ID pattern
            gid = worksheetId;
          }
          
          console.log(`Sheet found: "${title}" worksheetId=${worksheetId}`);
          sheetTabs.push({ name: title, gid: worksheetId });
        }
      } else {
        // Fallback: Try the alternate approach - probe using gviz endpoint
        console.log("Worksheets feed failed, trying alternate discovery method...");
        
        // First, get the default sheet to confirm access works
        const testUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&gid=0`;
        const testRes = await fetch(testUrl);
        
        if (testRes.ok) {
          console.log("Default sheet accessible, probing for more sheets...");
          
          // Try common gid values (0, and probe a range)
          const gidsToTry = ["0"];
          
          // Also try to get sheet info from the HTML/JSON that Google sometimes returns
          const htmlUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/edit`;
          const htmlRes = await fetch(htmlUrl, {
            headers: { "Accept": "text/html" }
          });
          
          if (htmlRes.ok) {
            const html = await htmlRes.text();
            
            // Look for patterns like: {"name":"SheetName","index":0,"id":123456789}
            const sheetMatches = html.matchAll(/"name"\s*:\s*"([^"]+)"\s*,\s*"index"\s*:\s*\d+\s*,\s*"id"\s*:\s*(\d+)/g);
            for (const match of sheetMatches) {
              const name = match[1];
              const gid = match[2];
              if (!sheetTabs.some(t => t.gid === gid)) {
                sheetTabs.push({ name, gid });
                console.log(`Found sheet from HTML: "${name}" gid=${gid}`);
              }
            }
            
            // Also try: gid=123456 patterns
            const gidMatches = html.matchAll(/gid[=:](\d+)/g);
            for (const match of gidMatches) {
              if (!gidsToTry.includes(match[1])) {
                gidsToTry.push(match[1]);
              }
            }
          }
          
          // If we still haven't found sheets, probe the gids we found
          if (sheetTabs.length === 0) {
            for (const gid of gidsToTry.slice(0, 20)) {
              const probeUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&gid=${gid}`;
              const probeRes = await fetch(probeUrl);
              if (probeRes.ok) {
                const contentDisposition = probeRes.headers.get("content-disposition") || "";
                let sheetName = `Sheet ${gid}`;
                const filenameMatch = contentDisposition.match(/filename="([^"]+)"/);
                if (filenameMatch) {
                  sheetName = filenameMatch[1].replace(/\.csv$/i, "");
                }
                if (!sheetTabs.some(t => t.gid === gid)) {
                  sheetTabs.push({ name: sheetName, gid });
                  console.log(`Found sheet via probe: "${sheetName}" gid=${gid}`);
                }
              }
            }
          }
        }
      }
    } catch (e) {
      console.error("Error discovering sheets:", e);
    }

    // If we found sheets via the feed/discovery, fetch each one
    if (sheetTabs.length > 0) {
      console.log(`Discovered ${sheetTabs.length} sheets: ${sheetTabs.map(s => s.name).join(", ")}`);
      
      const allSongs: { title: string; artist: string; genre: string; is_available: boolean }[] = [];
      const seen = new Set<string>();

      for (const tab of sheetTabs) {
        // Use gviz endpoint which is more reliable for public sheets
        const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tab.name)}`;
        console.log(`Fetching sheet: "${tab.name}"`);

        const res = await fetch(csvUrl);
        if (!res.ok) {
          // Try with gid instead
          const gidUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${tab.gid}`;
          const gidRes = await fetch(gidUrl);
          if (!gidRes.ok) {
            console.log(`Failed to fetch sheet "${tab.name}"`);
            continue;
          }
          
          const csvText = await gidRes.text();
          const lines = csvText.split("\n").filter((line) => line.trim());
          if (lines.length < 2) continue;

          for (let i = 1; i < lines.length; i++) {
            const cols = parseCSVRow(lines[i]);
            if (!cols[0] || cols[0].trim() === "") continue;

            const title = cols[0] || "Unknown";
            const artist = cols[1] || "Unknown";
            const key = `${title}|||${artist}`.toLowerCase();

            if (!seen.has(key)) {
              seen.add(key);
              allSongs.push({ title, artist, genre: tab.name, is_available: true });
            }
          }
          continue;
        }

        const csvText = await res.text();
        const lines = csvText.split("\n").filter((line) => line.trim());
        if (lines.length < 2) {
          console.log(`Sheet "${tab.name}" has no data rows`);
          continue;
        }

        for (let i = 1; i < lines.length; i++) {
          const cols = parseCSVRow(lines[i]);
          if (!cols[0] || cols[0].trim() === "") continue;

          const title = cols[0] || "Unknown";
          const artist = cols[1] || "Unknown";
          const key = `${title}|||${artist}`.toLowerCase();

          if (!seen.has(key)) {
            seen.add(key);
            allSongs.push({ title, artist, genre: tab.name, is_available: true });
          }
        }

        console.log(`Parsed data from sheet "${tab.name}"`);
      }

      if (allSongs.length > 0) {
        console.log(`Total unique songs: ${allSongs.length}`);

        await supabase.from("songs").delete().neq("id", "00000000-0000-0000-0000-000000000000");
        for (let i = 0; i < allSongs.length; i += 50) {
          const batch = allSongs.slice(i, i + 50);
          const { error } = await supabase.from("songs").insert(batch);
          if (error) console.error("Insert error:", error);
        }

        return new Response(
          JSON.stringify({ 
            success: true, 
            count: allSongs.length, 
            sheets: sheetTabs.map((s) => s.name),
            genres: sheetTabs.map((s) => s.name)
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Fallback: single-sheet mode where column 3 is genre
    console.log("Multi-sheet discovery failed. Falling back to single sheet mode with genre in 3rd column.");

    const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`;
    const response = await fetch(csvUrl);
    if (!response.ok) {
      return new Response(
        JSON.stringify({
          error: "Failed to fetch Google Sheet. Make sure it is publicly accessible (Anyone with the link can view).",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const csvText = await response.text();
    const lines = csvText.split("\n").filter((line) => line.trim());

    if (lines.length < 2) {
      return new Response(JSON.stringify({ error: "Sheet is empty or has no data rows" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const songs: { title: string; artist: string; genre: string | null; is_available: boolean }[] = [];
    const seenSongs = new Set<string>();
    const genreSet = new Set<string>();

    for (let i = 1; i < lines.length; i++) {
      const cols = parseCSVRow(lines[i]);
      if (!cols[0] || cols[0].trim() === "") continue;

      const title = cols[0] || "Unknown";
      const artist = cols[1] || "Unknown";
      const genre = cols[2]?.trim() || null;

      if (genre) genreSet.add(genre);

      const key = `${title}|||${artist}`.toLowerCase();
      if (!seenSongs.has(key)) {
        seenSongs.add(key);
        songs.push({ title, artist, genre, is_available: true });
      }
    }

    await supabase.from("songs").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    for (let i = 0; i < songs.length; i += 50) {
      const batch = songs.slice(i, i + 50);
      const { error } = await supabase.from("songs").insert(batch);
      if (error) console.error("Insert error:", error);
    }

    return new Response(
      JSON.stringify({ success: true, count: songs.length, sheets: ["default"], genres: Array.from(genreSet).sort() }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Sync error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
