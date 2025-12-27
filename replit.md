# VibeQueue

A live song request queue application for DJs and audiences at events.

## Overview

VibeQueue allows audiences to browse a song library and request songs for the DJ to play. The DJ can manage incoming requests through a console, accept/reject them, and mark songs as "now playing".

## Project Architecture

### Frontend (React + Vite)
- Located in `src/`
- Uses React Router for routing (`/`, `/audience`, `/dj`)
- Shadcn UI components in `src/components/ui/`
- TanStack Query for data fetching
- Tailwind CSS for styling

### Backend (Express + Node.js)
- Located in `server/`
- Express server with API routes
- Drizzle ORM for database operations
- PostgreSQL database (Neon-backed)

### Shared
- `shared/schema.ts` - Drizzle schema definitions for songs, requests, and settings tables

## Key Files

- `server/index.ts` - Express server entry point
- `server/routes.ts` - API route definitions
- `server/storage.ts` - Database operations interface
- `server/db.ts` - Database connection
- `src/App.tsx` - React app entry point
- `src/pages/` - Page components
- `src/hooks/` - Custom React hooks for data fetching

## Database Schema

### Tables
1. **songs** - Song library with title, artist, genre, availability
2. **requests** - Song request queue with status (pending, next_up, playing, played, rejected)
3. **settings** - Key-value store for app settings (event_name, dj_pin, payment handles)

## API Endpoints

- `GET /api/songs` - Get available songs (with optional search/genre filters)
- `POST /api/songs` - Create a new song (for custom requests)
- `GET /api/genres` - Get unique genres
- `GET /api/requests` - Get active requests
- `POST /api/requests` - Create a new request
- `PATCH /api/requests/:id` - Update request status
- `GET /api/settings` - Get public settings
- `POST /api/verify-pin` - Verify DJ PIN
- `POST /api/update-settings` - Update settings (requires PIN)
- `POST /api/sync-google-sheets` - Sync song library from Google Sheets
- `POST /api/recognize-song` - Recognize song from audio using AudD API
- `POST /api/get-lyrics` - Get lyrics for a song using AudD API

## Environment Variables

Required:
- `DATABASE_URL` - PostgreSQL connection string (auto-configured by Replit)

Optional:
- `AUDD_API_TOKEN` - API token from audd.io for song recognition and lyrics features

## User Preferences

- Default DJ PIN: 1234
- Dark theme by default
- Uses bun for running/building (not npm)

## Deployment

The app is configured for autoscale deployment:
- **Build**: `npm run build` (creates frontend assets in `dist/public`)
- **Run**: `bun server/index.ts` (runs TypeScript server directly with bun)

The backend serves both the API and the static frontend assets in production.

## Recent Changes

- December 2024: Migrated from Supabase to Replit's built-in PostgreSQL database
- Converted Supabase Edge Functions to Express API routes
- Removed Supabase client dependency, using direct API calls
- Switched from npm to bun for better performance
- Configured deployment to run TypeScript server directly with bun
- Fixed manual play feature: DJ can now manually set a song as "now playing" and it persists to the database, so the audience can see it in real-time
- Fixed song recognition feature: Increased server body limit to 10MB for audio uploads, fixed API endpoint routing and audio format handling (webm/opus → ogg)
- Added "Recently Played" section to audience queue view showing last 10 played songs
- Added drag-and-drop reordering for DJ Console "Up Next" queue using @dnd-kit
- Added position column to requests table for queue ordering
