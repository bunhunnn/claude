# DuckMail (desktop app)

A real desktop app (built with Electron) for generating DuckDuckGo Email
Protection (`@duck.com`) aliases — log in, generate one alias at a time, or
batch-generate several at once, all from a window with buttons instead of a
terminal.

> Uses DuckDuckGo's private, unofficial Email Protection API (the same one
> their browser extension uses). Only use it with an account you own.

## Windows

If you were handed a `DuckMail Setup 0.1.0.exe` file directly, that's a
ready-to-run installer — skip to **"Installing on Windows"** below. Otherwise,
build it yourself:

1. **Install Node.js.** Go to [nodejs.org](https://nodejs.org), download the
   Windows installer, and install it like any other program.
2. **Open PowerShell.** Click Start, type `PowerShell`, press Enter.
3. `cd` into the `desktop-app` folder (type `cd ` with a trailing space, then
   drag the folder from File Explorer into the window, then Enter).
4. Run:
   ```
   npm install
   npm run dist:win
   ```
5. Your installer appears at `desktop-app\dist\DuckMail Setup 0.1.0.exe`.

### Installing on Windows

Double-click `DuckMail Setup 0.1.0.exe`. Because it isn't signed with a paid
code-signing certificate, Windows SmartScreen will likely show a blue "Windows
protected your PC" warning. Click **More info**, then **Run anyway**. This is
normal for independently-built apps and only happens the first time. The
installer then adds a normal DuckMail shortcut to your Start Menu.

## Mac

1. **Install Node.js.** Go to [nodejs.org](https://nodejs.org), download the
   macOS installer, and install it like any other Mac app.
2. **Open Terminal** (`Cmd + Space`, type `Terminal`, Enter).
3. `cd` into the `desktop-app` folder (type `cd ` with a trailing space, drag
   the folder from Finder into Terminal, Enter).
4. Run:
   ```
   npm install
   npm run dist
   ```
5. Open the new `dist` folder — you'll see `DuckMail.app`. Drag it to
   `Applications`.

### Opening it the first time on Mac

Because it isn't signed with a paid Apple developer certificate, macOS will
refuse to open it normally the first time. To open it anyway: right-click
`DuckMail.app` → **Open** → **Open** again in the dialog. Only needed once.

## Using the app

- **Account tab**: enter your duck.com address, we email you a one-time
  code, paste it in to log in.
- **Generate tab**: make one new alias at a time.
- **Batch Generate tab**: make several at once (up to 25), at a gentle,
  human-like pace rather than firing them all at once.
- **History tab**: search, sort (newest/oldest/alphabetical), and export to
  CSV everything you've generated. Kept only on your own computer —
  DuckDuckGo doesn't keep a server-side list.

Credentials and history are stored locally in your OS's app-data folder,
readable only by your own user account.

## Developing / running without building an installer

If you just want to run the app while working on it (skips packaging):

```
npm install
npm start
```

## Tests

```
npm install
npm test
```
