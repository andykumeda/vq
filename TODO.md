# VQ App - Project TODO

A list of planned features, improvements, and bug fixes for the Vibe Queen (VQ) application.

## 🔴 High Priority
- [ ] **DJ Login Persistence**: Modify DJ login flow to use session/local storage for the PIN so it is only entered once per session or event.
- [ ] **Stability Fix (Frequent Refreshes)**: Investigate and fix the issue where the app reloads/refreshes automatically, especially during manual song entry.
- [ ] **Song Syncing Consolidation**:
    - [ ] Migrate to a single Google Workbook sheet for all song data.
    - [ ] Remove hard-coded genres and fetch them dynamically.

## 🟡 Mid Priority
- [ ] **Global Song Database**: Research and implement querying a global song database (e.g., Spotify API, MusicBrainz, or similar) instead of relying solely on manually managed Google Sheets.
- [ ] **Configuration Audit**: Move hard-coded values (like the site URL in the QR code) into environment variables (`.VITE_APP_URL`).

## 🟢 Maintenance & UI/UX
- [ ] **QR Code Fallbacks**: Add a loading state or fallback for the QR code component.
- [ ] **Error Boundaries**: Implement React Error Boundaries to capture and handle UI crashes gracefully.
- [ ] **Session Management**: Improve client-side session handling to prevent unexpected state loss.

---
*Last Updated: 2026-01-02*
