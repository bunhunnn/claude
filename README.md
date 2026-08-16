# duckmail

A command-line tool for [DuckDuckGo Email Protection](https://duckduckgo.com/email/) —
log in to your own `@duck.com` account and generate new forwarding aliases
("Generate Private Duck Address") without opening a browser.

Every generated alias forwards to the personal/backup email you registered
with DuckDuckGo, with trackers stripped, exactly like the official browser
extension. This tool talks to the same private API the extension uses.

> **Note:** DuckDuckGo does not publish this API publicly, so it may change
> without notice. Only use this against an account you own. This project is
> not affiliated with or endorsed by DuckDuckGo.

Two ways to use it:

- **[`desktop-app/`](desktop-app/)** — a real Mac app with buttons and tabs
  (login, generate one alias, batch-generate several, history). No coding
  experience needed after a one-time setup — see
  [`desktop-app/README.md`](desktop-app/README.md).
- **This CLI** — for the terminal-comfortable, described below.

## Install

```bash
pip install -e .
```

## Usage

```bash
# Log in (you'll be emailed a one-time code at your backup address)
duckmail login yourname1234

# Check who you're logged in as
duckmail whoami

# Generate a new alias
duckmail generate
duckmail generate --note "signup for example.com"

# Try the CLI without a real account (prints a locally-simulated address,
# does not call DuckDuckGo or create anything)
duckmail generate --dry-run

# See aliases you've generated (tracked locally only -- DuckDuckGo itself
# doesn't expose a server-side history)
duckmail history

# Forget stored credentials
duckmail logout
```

## How it works

1. `duckmail login <username>` requests a one-time code be emailed to your
   account's backup address.
2. You paste the code (or the full magic-link URL from the email).
3. duckmail exchanges it for a bearer token and stores it at
   `~/.config/duckmail/credentials.json` (permissions `0600`, owner-only).
4. `duckmail generate` calls the same "mint a new private address" endpoint
   the browser extension's "Generate Private Duck Address" button uses, and
   records the result in `~/.config/duckmail/history.json` for your own
   reference.

Set `DUCKMAIL_CONFIG_DIR` to change where credentials/history are stored.

## Development

```bash
pip install -e .
pip install pytest
pytest
```
