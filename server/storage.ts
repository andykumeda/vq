import { db } from "./db";
import { songs, requests, settings, type Song, type Request, type InsertSong, type InsertRequest, type RequestWithSong, type RequestStatus } from "../shared/schema";
import { eq, and, inArray, ilike, or, desc, asc } from "drizzle-orm";

export interface IStorage {
  getSongs(searchQuery?: string, genreFilters?: string[]): Promise<Song[]>;
  getSongById(id: string): Promise<Song | null>;
  createSong(data: InsertSong): Promise<Song>;
  updateSong(id: string, data: { title?: string; artist?: string }): Promise<Song | null>;
  
  getRequests(statusFilters?: RequestStatus[]): Promise<RequestWithSong[]>;
  getPlayedRequests(limit?: number): Promise<RequestWithSong[]>;
  getRequestById(id: string): Promise<RequestWithSong | null>;
  createRequest(data: InsertRequest): Promise<Request>;
  updateRequestStatus(id: string, status: RequestStatus): Promise<Request | null>;
  updateRequestPositions(positions: { id: string; position: number }[]): Promise<void>;
  checkDuplicateRequest(songId: string): Promise<boolean>;
  clearPlayedRequests(): Promise<number>;
  
  getSettings(): Promise<Record<string, string>>;
  getSetting(key: string): Promise<string | null>;
  updateSetting(key: string, value: string): Promise<void>;
  
  getGenres(): Promise<string[]>;
  syncSongsFromSheet(songsData: InsertSong[]): Promise<number>;
  
  initializeDefaultSettings(): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getSongs(searchQuery?: string, genreFilters?: string[]): Promise<Song[]> {
    let query = db.select().from(songs).where(eq(songs.isAvailable, true));
    
    const conditions = [eq(songs.isAvailable, true)];
    
    if (searchQuery && searchQuery.trim()) {
      const search = `%${searchQuery}%`;
      conditions.push(
        or(
          ilike(songs.title, search),
          ilike(songs.artist, search)
        )!
      );
    }
    
    if (genreFilters && genreFilters.length > 0) {
      conditions.push(inArray(songs.genre, genreFilters));
    }
    
    const result = await db.select().from(songs)
      .where(and(...conditions))
      .orderBy(asc(songs.title));
    
    return result;
  }

  async getSongById(id: string): Promise<Song | null> {
    const result = await db.select().from(songs).where(eq(songs.id, id)).limit(1);
    return result[0] || null;
  }

  async createSong(data: InsertSong): Promise<Song> {
    const result = await db.insert(songs).values(data).returning();
    return result[0];
  }

  async updateSong(id: string, data: { title?: string; artist?: string }): Promise<Song | null> {
    const updateData: { title?: string; artist?: string; updatedAt: Date } = { updatedAt: new Date() };
    if (data.title) updateData.title = data.title;
    if (data.artist) updateData.artist = data.artist;
    
    const result = await db
      .update(songs)
      .set(updateData)
      .where(eq(songs.id, id))
      .returning();
    return result[0] || null;
  }

  async getRequests(statusFilters: RequestStatus[] = ["pending", "next_up", "playing"]): Promise<RequestWithSong[]> {
    const result = await db
      .select({
        id: requests.id,
        songId: requests.songId,
        requesterUsername: requests.requesterUsername,
        status: requests.status,
        isTipped: requests.isTipped,
        position: requests.position,
        createdAt: requests.createdAt,
        updatedAt: requests.updatedAt,
        song: songs,
      })
      .from(requests)
      .innerJoin(songs, eq(requests.songId, songs.id))
      .where(inArray(requests.status, statusFilters))
      .orderBy(asc(requests.position), asc(requests.createdAt));
    
    return result;
  }

  async getPlayedRequests(limit: number = 10): Promise<RequestWithSong[]> {
    const result = await db
      .select({
        id: requests.id,
        songId: requests.songId,
        requesterUsername: requests.requesterUsername,
        status: requests.status,
        isTipped: requests.isTipped,
        position: requests.position,
        createdAt: requests.createdAt,
        updatedAt: requests.updatedAt,
        song: songs,
      })
      .from(requests)
      .innerJoin(songs, eq(requests.songId, songs.id))
      .where(eq(requests.status, "played"))
      .orderBy(desc(requests.updatedAt))
      .limit(limit);
    
    return result;
  }

  async getRequestById(id: string): Promise<RequestWithSong | null> {
    const result = await db
      .select({
        id: requests.id,
        songId: requests.songId,
        requesterUsername: requests.requesterUsername,
        status: requests.status,
        isTipped: requests.isTipped,
        position: requests.position,
        createdAt: requests.createdAt,
        updatedAt: requests.updatedAt,
        song: songs,
      })
      .from(requests)
      .innerJoin(songs, eq(requests.songId, songs.id))
      .where(eq(requests.id, id))
      .limit(1);
    
    return result[0] || null;
  }

  async createRequest(data: InsertRequest): Promise<Request> {
    const result = await db.insert(requests).values(data).returning();
    return result[0];
  }

  async updateRequestStatus(id: string, status: RequestStatus): Promise<Request | null> {
    const result = await db
      .update(requests)
      .set({ status, updatedAt: new Date() })
      .where(eq(requests.id, id))
      .returning();
    return result[0] || null;
  }

  async checkDuplicateRequest(songId: string): Promise<boolean> {
    const result = await db
      .select({ id: requests.id })
      .from(requests)
      .where(
        and(
          eq(requests.songId, songId),
          inArray(requests.status, ["pending", "next_up", "playing"])
        )
      )
      .limit(1);
    
    return result.length > 0;
  }

  async updateRequestPositions(positions: { id: string; position: number }[]): Promise<void> {
    for (const { id, position } of positions) {
      await db
        .update(requests)
        .set({ position, updatedAt: new Date() })
        .where(eq(requests.id, id));
    }
  }

  async clearPlayedRequests(): Promise<number> {
    const result = await db
      .delete(requests)
      .where(eq(requests.status, "played"))
      .returning({ id: requests.id });
    return result.length;
  }

  async getSettings(): Promise<Record<string, string>> {
    const result = await db.select().from(settings);
    const settingsMap: Record<string, string> = {};
    result.forEach((s) => {
      settingsMap[s.key] = s.value;
    });
    return settingsMap;
  }

  async getSetting(key: string): Promise<string | null> {
    const result = await db
      .select()
      .from(settings)
      .where(eq(settings.key, key))
      .limit(1);
    return result[0]?.value || null;
  }

  async updateSetting(key: string, value: string): Promise<void> {
    const existing = await db.select().from(settings).where(eq(settings.key, key)).limit(1);
    
    if (existing.length > 0) {
      await db
        .update(settings)
        .set({ value, updatedAt: new Date() })
        .where(eq(settings.key, key));
    } else {
      await db.insert(settings).values({ key, value });
    }
  }

  async getGenres(): Promise<string[]> {
    const result = await db
      .selectDistinct({ genre: songs.genre })
      .from(songs)
      .where(eq(songs.isAvailable, true));
    
    return result
      .map((r) => r.genre)
      .filter((g): g is string => g !== null)
      .sort();
  }

  async syncSongsFromSheet(songsData: InsertSong[]): Promise<number> {
    await db.delete(songs);
    
    for (let i = 0; i < songsData.length; i += 50) {
      const batch = songsData.slice(i, i + 50);
      await db.insert(songs).values(batch);
    }
    
    return songsData.length;
  }

  async initializeDefaultSettings(): Promise<void> {
    const defaults = [
      { key: 'dj_pin', value: '1234' },
      { key: 'event_name', value: 'VibeQueue' },
      { key: 'venmo_handle', value: '' },
      { key: 'paypal_handle', value: '' },
      { key: 'cashapp_handle', value: '' },
      { key: 'google_sheet_url', value: '' },
    ];

    for (const { key, value } of defaults) {
      const existing = await db.select().from(settings).where(eq(settings.key, key)).limit(1);
      if (existing.length === 0) {
        await db.insert(settings).values({ key, value });
        console.log(`Initialized default setting: ${key}`);
      }
    }
  }
}

export const storage = new DatabaseStorage();
