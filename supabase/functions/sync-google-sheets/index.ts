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

function extractFilenameFromContentDisposition(disposition: string): string {
  const filenameMatch = disposition.match(/filename\*=UTF-8''([^;]+)|filename="([^"]+)"/i);
  const filenameRaw = filenameMatch?.[1] ?? filenameMatch?.[2] ?? "";
  try {
    return decodeURIComponent(filenameRaw);
  } catch {
    return filenameRaw;
  }
}

function looksLikeCsvResponse(contentType: string | null): boolean {
  const ct = (contentType ?? "").toLowerCase();
  return ct.includes("text/csv") || ct.includes("application/vnd.ms-excel") || ct.includes("text/plain");
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

    // Discover sheet tabs (name + gid) without hardcoding.
    // IMPORTANT: gid values are typically large random integers (not 0..N), so probing ranges will miss tabs.
    // Strategy:
    //  1) Fetch the sheet HTML and extract any gid=123 occurrences.
    //  2) For each gid, validate by fetching CSV export and infer tab name from Content-Disposition filename.
    //  3) If we can't discover tabs, fall back to single-sheet mode (genre in 3rd column).

    const sheetTabs: { name: string; gid: string }[] = [];
    const pushUnique = (name: string, gid: string) => {
      const trimmed = name.trim();
      if (!trimmed || !gid) return;
      if (!sheetTabs.some((t) => t.gid === gid)) sheetTabs.push({ name: trimmed, gid });
    };

    // 1) HTML discovery
    try {
      const htmlUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/edit?usp=sharing`;
      const htmlRes = await fetch(htmlUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; VibeQueueSync/1.0)",
          Accept: "text/html,application/xhtml+xml",
        },
      });

      console.log(
        `Sheet HTML fetch status=${htmlRes.status} content-type=${htmlRes.headers.get("content-type")}`
      );

      if (htmlRes.ok) {
        const html = await htmlRes.text();
        const gids = Array.from(new Set(Array.from(html.matchAll(/\bgid=(\d+)\b/g)).map((m) => m[1])));

        console.log(`Found ${gids.length} candidate gids in HTML`);

        for (const gid of gids) {
          const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;
          const res = await fetch(csvUrl);
          if (!res.ok) continue;

          if (!looksLikeCsvResponse(res.headers.get("content-type"))) continue;

          const csvText = await res.text();
          const lines = csvText.split("\n").filter((l) => l.trim());
          if (lines.length < 2) continue;

          const filename = extractFilenameFromContentDisposition(res.headers.get("content-disposition") ?? "");
          const inferredName = filename.replace(/\.csv$/i, "").trim();

          pushUnique(inferredName || `Sheet ${gid}`, gid);
        }
      }

      if (sheetTabs.length > 0) {
        console.log(
          `Discovered ${sheetTabs.length} sheets via HTML gids: ${sheetTabs
            .map((s) => `${s.name}(gid=${s.gid})`)
            .join(", ")}`
        );
      }
    } catch (e) {
      console.log("Failed to discover tabs via HTML:", e);
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
        const lines = csvText.split("\n").filter((line) => line.trim());
        if (lines.length < 2) {
          console.log(`Sheet ${tab.name} has no data rows`);
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

      await supabase.from("songs").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      for (let i = 0; i < allSongs.length; i += 50) {
        const batch = allSongs.slice(i, i + 50);
        const { error } = await supabase.from("songs").insert(batch);
        if (error) console.error("Insert error:", error);
      }

      return new Response(
        JSON.stringify({ success: true, count: allSongs.length, sheets: sheetTabs.map((s) => s.name) }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fallback: single-sheet mode where column 3 is genre
    console.log(
      "Multi-sheet discovery failed. Falling back to single sheet mode with genre in 3rd column (or blank if not provided)."
    );

    const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`;
    const response = await fetch(csvUrl);
    if (!response.ok) {
      return new Response(
        JSON.stringify({
          error:
            "Failed to fetch Google Sheet. Make sure it is publicly accessible (Anyone with the link can view).",
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
