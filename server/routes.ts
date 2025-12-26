import type { Express } from "express";
import { storage } from "./storage";
import { insertSongSchema, insertRequestSchema, type RequestStatus } from "../shared/schema";
import { z } from "zod";

const SHEET_TABS = [
  "Freestyle|Dance",
  "Hip Hop|Rap|Funk|R&B",
  "Rock",
  "New Wave",
  "Slow Jamz",
  "Disco",
  "Other"
];

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

export async function registerRoutes(app: Express): Promise<void> {
  app.get("/api/songs", async (req, res) => {
    try {
      const searchQuery = req.query.search as string | undefined;
      const genreFilters = req.query.genres 
        ? (req.query.genres as string).split(",").filter(Boolean)
        : [];
      
      const songs = await storage.getSongs(searchQuery, genreFilters);
      res.json(songs);
    } catch (error) {
      console.error("Error fetching songs:", error);
      res.status(500).json({ error: "Failed to fetch songs" });
    }
  });

  app.get("/api/songs/:id", async (req, res) => {
    try {
      const song = await storage.getSongById(req.params.id);
      if (!song) {
        return res.status(404).json({ error: "Song not found" });
      }
      res.json(song);
    } catch (error) {
      console.error("Error fetching song:", error);
      res.status(500).json({ error: "Failed to fetch song" });
    }
  });

  app.post("/api/songs", async (req, res) => {
    try {
      const data = insertSongSchema.parse(req.body);
      const song = await storage.createSong(data);
      res.status(201).json(song);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid song data", details: error.errors });
      }
      console.error("Error creating song:", error);
      res.status(500).json({ error: "Failed to create song" });
    }
  });

  app.get("/api/genres", async (req, res) => {
    try {
      const genres = await storage.getGenres();
      res.json(genres);
    } catch (error) {
      console.error("Error fetching genres:", error);
      res.status(500).json({ error: "Failed to fetch genres" });
    }
  });

  app.get("/api/requests", async (req, res) => {
    try {
      const statusFilters = req.query.status 
        ? (req.query.status as string).split(",") as RequestStatus[]
        : ["pending", "next_up", "playing"] as RequestStatus[];
      
      const requests = await storage.getRequests(statusFilters);
      res.json(requests);
    } catch (error) {
      console.error("Error fetching requests:", error);
      res.status(500).json({ error: "Failed to fetch requests" });
    }
  });

  app.post("/api/requests", async (req, res) => {
    try {
      const data = insertRequestSchema.parse(req.body);
      const request = await storage.createRequest(data);
      res.status(201).json(request);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid request data", details: error.errors });
      }
      console.error("Error creating request:", error);
      res.status(500).json({ error: "Failed to create request" });
    }
  });

  app.patch("/api/requests/:id", async (req, res) => {
    try {
      const { status } = req.body;
      if (!status) {
        return res.status(400).json({ error: "Status is required" });
      }
      
      const request = await storage.updateRequestStatus(req.params.id, status);
      if (!request) {
        return res.status(404).json({ error: "Request not found" });
      }
      res.json(request);
    } catch (error) {
      console.error("Error updating request:", error);
      res.status(500).json({ error: "Failed to update request" });
    }
  });

  app.get("/api/requests/check-duplicate/:songId", async (req, res) => {
    try {
      const isDuplicate = await storage.checkDuplicateRequest(req.params.songId);
      res.json({ isDuplicate });
    } catch (error) {
      console.error("Error checking duplicate:", error);
      res.status(500).json({ error: "Failed to check duplicate" });
    }
  });

  app.get("/api/settings", async (req, res) => {
    try {
      const allSettings = await storage.getSettings();
      const publicSettings: Record<string, string> = {};
      const publicKeys = ["event_name", "venmo_handle", "paypal_handle", "cashapp_handle", "google_sheet_url"];
      
      for (const key of publicKeys) {
        if (allSettings[key] !== undefined) {
          publicSettings[key] = allSettings[key];
        }
      }
      
      res.json(publicSettings);
    } catch (error) {
      console.error("Error fetching settings:", error);
      res.status(500).json({ error: "Failed to fetch settings" });
    }
  });

  app.post("/api/verify-pin", async (req, res) => {
    try {
      const { pin } = req.body;
      
      if (!pin || typeof pin !== "string") {
        return res.status(400).json({ valid: false, error: "PIN is required" });
      }
      
      const storedPin = await storage.getSetting("dj_pin");
      const isValid = storedPin === pin;
      
      res.json({ valid: isValid });
    } catch (error) {
      console.error("Error verifying PIN:", error);
      res.status(500).json({ valid: false, error: "Failed to verify PIN" });
    }
  });

  app.post("/api/update-settings", async (req, res) => {
    try {
      const { pin, key, value } = req.body;
      
      if (!pin || typeof pin !== "string") {
        return res.status(401).json({ error: "DJ PIN is required" });
      }
      
      const allowedKeys = ["event_name", "dj_pin", "venmo_handle", "paypal_handle", "cashapp_handle", "google_sheet_url"];
      if (!key || !allowedKeys.includes(key)) {
        return res.status(400).json({ error: "Invalid setting key" });
      }
      
      if (value === undefined || typeof value !== "string") {
        return res.status(400).json({ error: "Value is required and must be a string" });
      }
      
      if (key === "dj_pin" && !/^\d{4}$/.test(value)) {
        return res.status(400).json({ error: "DJ PIN must be 4 digits" });
      }
      
      const storedPin = await storage.getSetting("dj_pin");
      if (storedPin !== pin) {
        return res.status(401).json({ error: "Invalid DJ PIN" });
      }
      
      await storage.updateSetting(key, value);
      res.json({ success: true });
    } catch (error) {
      console.error("Error updating setting:", error);
      res.status(500).json({ error: "Failed to update setting" });
    }
  });

  app.post("/api/recognize-song", async (req, res) => {
    try {
      const { audioData } = req.body;
      
      const apiToken = process.env.AUDD_API_TOKEN;
      if (!apiToken) {
        return res.status(503).json({ 
          error: "Song recognition is not configured. Add AUDD_API_TOKEN to enable this feature."
        });
      }
      
      if (!audioData) {
        return res.status(400).json({ error: "Audio data is required" });
      }
      
      const response = await fetch("https://api.audd.io/", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          api_token: apiToken,
          audio: audioData,
          return: "lyrics,spotify"
        })
      });
      
      if (!response.ok) {
        throw new Error(`AudD API error: ${response.status}`);
      }
      
      const result = await response.json();
      
      if (result.status === "error") {
        return res.status(400).json({ error: result.error?.error_message || "Recognition failed" });
      }
      
      if (!result.result) {
        return res.json({ found: false, message: "No song recognized" });
      }
      
      res.json({
        found: true,
        song: {
          title: result.result.title,
          artist: result.result.artist,
          album: result.result.album,
          releaseDate: result.result.release_date,
          lyrics: result.result.lyrics?.lyrics,
          spotify: result.result.spotify
        }
      });
    } catch (error) {
      console.error("Song recognition error:", error);
      res.status(500).json({ error: "Failed to recognize song" });
    }
  });

  app.post("/api/get-lyrics", async (req, res) => {
    try {
      const { title, artist } = req.body;
      
      const apiToken = process.env.AUDD_API_TOKEN;
      if (!apiToken) {
        return res.status(503).json({
          error: "Lyrics lookup is not configured. Add AUDD_API_TOKEN to enable this feature."
        });
      }
      
      if (!title || !artist) {
        return res.status(400).json({ error: "Title and artist are required" });
      }
      
      const response = await fetch("https://api.audd.io/findLyrics/", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          api_token: apiToken,
          q: `${artist} ${title}`
        })
      });
      
      if (!response.ok) {
        throw new Error(`AudD API error: ${response.status}`);
      }
      
      const result = await response.json();
      
      if (result.status === "error") {
        return res.status(400).json({ error: result.error?.error_message || "Lyrics lookup failed" });
      }
      
      if (!result.result || result.result.length === 0) {
        return res.json({ found: false, message: "No lyrics found" });
      }
      
      const match = result.result[0];
      res.json({
        found: true,
        lyrics: {
          title: match.title,
          artist: match.artist,
          lyrics: match.lyrics
        }
      });
    } catch (error) {
      console.error("Lyrics lookup error:", error);
      res.status(500).json({ error: "Failed to get lyrics" });
    }
  });

  app.post("/api/sync-google-sheets", async (req, res) => {
    try {
      const { pin } = req.body;
      
      if (!pin || typeof pin !== "string") {
        return res.status(401).json({ error: "DJ PIN is required to sync library" });
      }
      
      const storedPin = await storage.getSetting("dj_pin");
      if (storedPin !== pin) {
        return res.status(401).json({ error: "Invalid DJ PIN" });
      }
      
      const sheetUrl = await storage.getSetting("google_sheet_url");
      if (!sheetUrl) {
        return res.status(400).json({ error: "Google Sheet URL not configured. Add it in DJ Settings." });
      }
      
      const sheetId = parseSheetIdFromUrl(sheetUrl);
      if (!sheetId) {
        return res.status(400).json({ error: "Invalid Google Sheet URL" });
      }
      
      console.log(`Syncing ${SHEET_TABS.length} tabs from sheet ${sheetId}`);
      
      const allSongs: { title: string; artist: string; genre: string; isAvailable: boolean }[] = [];
      const seen = new Set<string>();
      const successfulTabs: string[] = [];
      
      for (const tabName of SHEET_TABS) {
        const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tabName)}`;
        console.log(`Fetching tab: "${tabName}"`);
        
        try {
          const response = await fetch(csvUrl);
          
          if (!response.ok) {
            console.log(`Failed to fetch tab "${tabName}" - status ${response.status}`);
            continue;
          }
          
          const csvText = await response.text();
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
              allSongs.push({ title, artist, genre: tabName, isAvailable: true });
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
        return res.status(400).json({
          error: "No songs found. Make sure the Google Sheet is publicly accessible and has the correct tab names.",
          expectedTabs: SHEET_TABS
        });
      }
      
      console.log(`Total unique songs: ${allSongs.length} from ${successfulTabs.length} tabs`);
      
      const count = await storage.syncSongsFromSheet(allSongs);
      
      res.json({
        success: true,
        count,
        sheets: successfulTabs,
        genres: successfulTabs
      });
    } catch (error) {
      console.error("Sync error:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error occurred" });
    }
  });
}
