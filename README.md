# VibeQueue

VibeQueue is a live song request and tipping platform designed for nightclubs, DJs, and event performers. It creates a seamless interaction between the audience and the DJ, featuring real-time queue management, integrated tipping, and live song lyrics.

## Features

### Audience Experience
- Browse the DJ's full song library with search and genre filters
- Request songs with optional priority tipping
- Real-time queue status (Pending, Next Up, Now Playing)
- Live lyrics display for the currently playing song (powered by AudD)
- Automatic notifications when your song starts playing

### DJ Console
- Manage the request queue (Accept, Reject, Mark as Played)
- Song recognition via microphone to identify playing tracks
- Library sync from Google Sheets
- Manual song entry for custom requests
- Tipping integration with Venmo, PayPal, and Cash App handles
- Customizable event names (e.g., "Brandon's Birthday Party")

### Visuals
- Premium nightclub dark theme with neon purple accents
- Responsive design for mobile and desktop

## Tech Stack

- **Frontend:** React, Vite, TypeScript, Tailwind CSS, shadcn/ui
- **Backend:** Express.js, Node.js
- **Database:** PostgreSQL with Drizzle ORM
- **Runtime:** Bun (recommended) or Node.js
- **APIs:** AudD (Lyrics & Song Recognition)

## Environment Variables

### Required
- `DATABASE_URL` - PostgreSQL connection string (auto-configured on Replit)

### Optional
- `AUDD_API_TOKEN` - API token from audd.io for song recognition and lyrics features

## Local Development

1. **Install dependencies:**
    ```bash
    bun install
    ```

2. **Set up the database:**
    ```bash
    npm run db:push
    ```

3. **Start the development server:**
    ```bash
    npm run dev
    ```

## Deployment

The app is configured for deployment on Replit:
- **Build:** `npm run build` (creates frontend assets in `dist/public`)
- **Run:** `bun server/index.ts` (runs TypeScript server directly with bun)

The backend serves both the API and static frontend assets in production.

## Configuration

- **DJ Console PIN:** Default is `1234`. Can be changed in DJ Settings.
- **Payment Handles:** Configure Venmo/PayPal/Cash App usernames in DJ Console settings.
- **Google Sheets Sync:** Supports tabs named: "Freestyle|Dance", "Hip Hop|Rap|Funk|R&B", "Rock", "New Wave", "Slow Jamz", "Disco", "Other"

## API Endpoints

- `GET /api/songs` - Get available songs (with search/genre filters)
- `POST /api/songs` - Create a new song
- `GET /api/genres` - Get unique genres
- `GET /api/requests` - Get active requests
- `POST /api/requests` - Create a new request
- `PATCH /api/requests/:id` - Update request status
- `GET /api/settings` - Get public settings
- `POST /api/verify-pin` - Verify DJ PIN
- `POST /api/update-settings` - Update settings
- `POST /api/sync-google-sheets` - Sync song library from Google Sheets
- `POST /api/recognize-song` - Recognize song from audio
- `POST /api/get-lyrics` - Get lyrics for a song
