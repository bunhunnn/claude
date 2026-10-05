# sitewatch

Watches a login-protected page and alerts you when it changes or goes in stock.
It only monitors and notifies — you buy manually.

## Setup
    pip install -r requirements.txt
    playwright install chromium

## Usage
1. Log in once (opens a real browser; your cookies are saved to `.sitewatch/session.json`):

        python sitewatch.py login --url https://alpineaio.com/purchase

2. Look at what the page says, then pick keywords:

        python sitewatch.py check --url https://alpineaio.com/purchase --show

3. Watch for stock (phone push via https://ntfy.sh — install the app and subscribe to your topic):

        python sitewatch.py watch --url https://alpineaio.com/purchase \
            --out-of-stock "Sold out" --every 60 --ntfy my-secret-topic

   Other styles:

        --in-stock "Add to cart"          # alert when this text appears
        --at "09:00,12:30,18:00"          # only check at specific times
        --between "08:00-22:00"           # only check inside a daily window
        --selector "#product-list"        # watch just one part of the page
        --discord-webhook <url>           # alert to Discord
        (no keyword flags)                # alert on any text change, with a diff

Notes: keep the interval polite (≥30s). If the session expires you get a
"login expired" alert; re-run `login`. `.sitewatch/` holds credentials — don't commit it.
