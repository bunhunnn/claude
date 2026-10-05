# SiteWatch (desktop app)

A desktop app (Electron, same setup as DuckMail) that watches web pages — including
ones behind a login — and alerts you when something changes or an item goes in stock.
It only monitors and notifies; you complete any purchase yourself.

## Run it
    npm install
    npm start

Build an installer: `npm run dist:win` (Windows), `npm run dist` (Mac), `npm run dist:linux`.
Output lands in `dist/`. Windows SmartScreen will warn about an unsigned app —
click **More info → Run anyway**.

## Use it
1. **+ New watch** → name, page URL (e.g. `https://alpineaio.com/purchase`).
2. Pick what to alert on:
   - *the "sold out" text disappears* (keywords like `Sold out`) — most reliable for restocks
   - *the "in stock" text appears* (e.g. `Add to cart`)
   - *anything on the page changes*
3. Pick a schedule: every N seconds (min 30, optional daily window like `08:00-22:00`),
   or at specific times (`09:00, 12:30, 18:00`).
4. Save, then click **Log in**. A browser window opens; log in normally (2FA is fine) and
   close it. The login is kept in the app and reused for every check.
5. Click **Check now** and read the Activity log to confirm it sees the right text, and adjust
   keywords or the CSS selector if needed.
6. **Alert settings**: add an ntfy.sh topic and/or Discord webhook for phone alerts.
   Desktop notifications are always on.

Leave the app running (it keeps your computer from suspending while open).
If your login expires you get a "Login expired" alert — click **Log in** again.

## Tests
    npm test
