# DuckMail (desktop app)

A real Mac app (built with Electron) for generating DuckDuckGo Email
Protection (`@duck.com`) aliases — log in, generate one alias at a time, or
batch-generate several at once, all from a window with buttons instead of a
terminal.

> Uses DuckDuckGo's private, unofficial Email Protection API (the same one
> their browser extension uses). Only use it with an account you own.

## One-time setup (about 5 minutes)

You only need to do this once. After this, you'll have a normal app icon you
can just double-click forever.

1. **Install Node.js.** Go to [nodejs.org](https://nodejs.org), download the
   macOS installer (the "LTS" button), and install it like any other Mac app
   (double-click, click through, done).

2. **Open Terminal.** Press `Cmd + Space`, type `Terminal`, press Enter.

3. **Get this folder onto your Mac** (skip if you already have it), then in
   Terminal, navigate into the `desktop-app` folder — the easiest way is to
   type `cd ` (with a trailing space) and drag the `desktop-app` folder from
   Finder into the Terminal window, then press Enter.

4. **Run these two commands** (copy-paste each, press Enter, wait for it to
   finish before the next one):

   ```
   npm install
   npm run dist
   ```

   The first downloads what the app needs. The second builds the actual
   `.app`. It can take a couple of minutes.

5. **Find your app.** A new folder called `dist` will appear inside
   `desktop-app`. Open it in Finder — you'll see `DuckMail.app` (and a
   `.dmg` installer). Drag `DuckMail.app` to your `Applications` folder.

## Opening it the first time

Because this app isn't signed with a paid Apple developer certificate,
macOS will refuse to open it normally the first time and may say it's
"damaged" or from an "unidentified developer." To open it anyway:

1. Right-click (or Control-click) `DuckMail.app` in Applications.
2. Choose **Open**.
3. Click **Open** again in the dialog that appears.

You only need to do this once — after that it opens normally like any app.

## Using the app

- **Account tab**: enter your duck.com address, we email you a one-time
  code, paste it in to log in.
- **Generate tab**: make one new alias at a time.
- **Batch Generate tab**: make several at once (up to 25), at a gentle,
  human-like pace rather than firing them all at once.
- **History tab**: everything you've generated, kept only on your own
  computer (DuckDuckGo doesn't keep a server-side list).

Credentials and history are stored locally in your Mac's app-data folder,
readable only by your own user account.

## Developing / running without building an installer

If you just want to run the app while working on it (skips the `.app`
packaging step):

```
npm install
npm start
```

## Tests

```
npm install
npm test
```
