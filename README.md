# VibeQueue 🎵

VibeQueue is a live song request and tipping platform designed for nightclubs, DJs, and event performers. It creates a seamless interaction between the audience and the DJ, featuring real-time queue management, integrated tipping, and live song lyrics.

## ✨ Features

-   **Audience Experience:**
    -   Browse the DJ's full song library.
    -   Request songs with optional priority tipping.
    -   Real-time queue status (Pending, Next Up, Now Playing).
    -   **Live Lyrics:** View lyrics for the currently playing song (powered by AudD).
    -   **Automatic Notifications:** Instant popups on the user's phone when their song starts playing.
-   **DJ Console:**
    -   Manage the request queue (Accept, Reject, Mark as Played).
    -   **Library Sync:** Automatically sync song lists from Google Sheets.
    -   **Tipping Integration:** Support for Venmo, PayPal, and Cash App handles.
    -   **Dynamic Event Names:** Customize the event title (e.g., "Brandon's Birthday Party").
-   **Visuals:**
    -   Premium nightclub dark theme with neon purple accents.
    -   Responsive design for mobile and desktop.

## 🚀 Tech Stack

-   **Frontend:** React, Vite, Tailwind CSS, shadcn/ui.
-   **Backend:** Supabase (Database, Real-time, Edge Functions).
-   **Runtime:** Bun (recommended) or Node.js.
-   **APIs:** AudD (Lyrics & Song Recognition).

## 🛠️ Local Setup

1.  **Clone the repository:**
    ```bash
    git clone <your-repo-url>
    cd vq
    ```

2.  **Install dependencies:**
    ```bash
    bun install
    ```

3.  **Configure Environment Variables:**
    Create a `.env` file in the root directory and add your keys:
    ```env
    VITE_SUPABASE_URL=your_supabase_url
    VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_anon_key
    VITE_AUDD_API_TOKEN=your_audd_api_token
    ```

4.  **Start the development server:**
    ```bash
    bun run dev
    ```
    Access the app at `http://localhost:8080`

## 🌐 Deployment (Ubuntu + Nginx)

To host VibeQueue on your own server:

1.  **Build the project:**
    ```bash
    bun run build
    ```
2.  **Configure Nginx:**
    Ensure your Nginx config handles SPA routing by adding `try_files`:
    ```nginx
    location / {
        try_files $uri $uri/ /index.html;
    }
    ```
3.  **SSL:** It is highly recommended to use HTTPS (via Certbot) for secure tipping links.

## 🔐 Security & Customization

-   **DJ Console PIN:** The default PIN is `1234`. This can be changed in the DJ Settings modal.
-   **Payment Handles:** Configure your Venmo/PayPal usernames directly in the DJ Console settings or as overrides in the `.env` file.

---
Built with 💜 for the nightclub vibe.