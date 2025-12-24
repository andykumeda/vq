import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Known tab names for the song library
const SHEET_TABS = [
  "Freestyle|Dance",
  "Hip Hop|Rap|Funk|R&B",
  "Rock",
  "New Wave",
  "Slow Jamz",
  "Disco",
  "Other"
];

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

    console.log(`Syncing ${SHEET_TABS.length} tabs from sheet ${sheetId}`);

    const allSongs: { title: string; artist: string; genre: string; is_available: boolean }[] = [];
    const seen = new Set<string>();
    const successfulTabs: string[] = [];

    for (const tabName of SHEET_TABS) {
      // Use gviz endpoint with sheet name - this works for public sheets
      const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tabName)}`;
      console.log(`Fetching tab: "${tabName}"`);

      try {
        const res = await fetch(csvUrl);
        
        if (!res.ok) {
          console.log(`Failed to fetch tab "${tabName}" - status ${res.status}`);
          continue;
        }

        const csvText = await res.text();
        const lines = csvText.split("\n").filter((line) => line.trim());
        
        if (lines.length < 2) {
          console.log(`Tab "${tabName}" has no data rows`);
          continue;
        }

        let tabSongCount = 0;
        for (let i = 1; i < lines.length; i++) {
          const cols = parseCSVRow(lines[i]);
          if (!cols[0] || cols[0].trim() === "") continue;

          const title = cols[0].trim();
          const artist = cols[1]?.trim() || "Unknown";
          const key = `${title}|||${artist}`.toLowerCase();

          if (!seen.has(key)) {
            seen.add(key);
            allSongs.push({ title, artist, genre: tabName, is_available: true });
            tabSongCount++;
          }
        }

        console.log(`Parsed ${tabSongCount} songs from tab "${tabName}"`);
        successfulTabs.push(tabName);
      } catch (e) {
        console.error(`Error fetching tab "${tabName}":`, e);
      }
    }

    if (allSongs.length === 0) {
      return new Response(
        JSON.stringify({ 
          error: "No songs found. Make sure the Google Sheet is publicly accessible and has the correct tab names.",
          expectedTabs: SHEET_TABS
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Total unique songs: ${allSongs.length} from ${successfulTabs.length} tabs`);

    // Clear existing songs and insert new ones
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
        sheets: successfulTabs,
        genres: successfulTabs
      }),
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
