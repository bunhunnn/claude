#!/usr/bin/env python3
"""sitewatch - watch a (login-protected) web page and alert you when it changes
or when a product goes in stock.

    python sitewatch.py login  --url https://alpineaio.com/purchase
    python sitewatch.py check  --url https://alpineaio.com/purchase --selector "main"
    python sitewatch.py watch  --url https://alpineaio.com/purchase --every 60

It only monitors and notifies you; you complete the purchase yourself.
"""
from __future__ import annotations

import argparse
import datetime as dt
import difflib
import hashlib
import json
import random
import sys
import time
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
STATE_DIR = HERE / ".sitewatch"
SESSION_FILE = STATE_DIR / "session.json"      # saved login cookies
SNAPSHOT_FILE = STATE_DIR / "last_snapshot.txt"
STATUS_FILE = STATE_DIR / "last_status.txt"

LOGIN_HINTS = ("/login", "/signin", "/sign-in", "/auth", "/oauth", "discord.com/oauth2")


# ---------------------------------------------------------------- browser ---
def _playwright():
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        sys.exit("Playwright missing. Run:  pip install playwright && playwright install chromium")
    return sync_playwright()


def cmd_login(args):
    """Open a visible browser so you can log in by hand; cookies are saved."""
    STATE_DIR.mkdir(exist_ok=True)
    with _playwright() as p:
        browser = p.chromium.launch(headless=False)
        ctx = browser.new_context()
        page = ctx.new_page()
        page.goto(args.url)
        input("Log in in the browser window (finish any 2FA), then press Enter here... ")
        ctx.storage_state(path=str(SESSION_FILE))
        browser.close()
    SESSION_FILE.chmod(0o600)
    print(f"Session saved to {SESSION_FILE}")


def fetch(args) -> tuple[str, str]:
    """Return (visible_text, final_url). Raises on navigation failure."""
    if not SESSION_FILE.exists() and not args.no_login:
        sys.exit("No saved session. Run `login` first (or pass --no-login).")
    with _playwright() as p:
        browser = p.chromium.launch(headless=not args.show)
        ctx = browser.new_context(
            storage_state=None if args.no_login else str(SESSION_FILE))
        page = ctx.new_page()
        page.goto(args.url, wait_until="networkidle", timeout=45_000)
        if args.wait_for:
            page.wait_for_selector(args.wait_for, timeout=15_000)
        loc = page.locator(args.selector) if args.selector else page.locator("body")
        text = loc.first.inner_text(timeout=15_000)
        final_url = page.url
        if not args.no_login:                       # keep cookies fresh
            ctx.storage_state(path=str(SESSION_FILE))
        browser.close()
    return text, final_url


# --------------------------------------------------------------- analysis ---
def normalise(text: str) -> str:
    return "\n".join(l.strip() for l in text.splitlines() if l.strip())


def evaluate(text: str, args) -> tuple[str, str]:
    """Return (status, detail). status in: in_stock, out_of_stock, changed, unchanged."""
    low = text.lower()
    if args.in_stock:
        for kw in args.in_stock:
            if kw.lower() in low:
                return "in_stock", f'found "{kw}"'
        return "out_of_stock", "none of the in-stock keywords present"
    if args.out_of_stock:
        for kw in args.out_of_stock:
            if kw.lower() in low:
                return "out_of_stock", f'found "{kw}"'
        return "in_stock", "out-of-stock keywords gone"
    # generic change detection
    old = SNAPSHOT_FILE.read_text() if SNAPSHOT_FILE.exists() else None
    SNAPSHOT_FILE.write_text(text)
    if old is None:
        return "unchanged", "first snapshot stored"
    if old == text:
        return "unchanged", ""
    diff = difflib.unified_diff(old.splitlines(), text.splitlines(), lineterm="", n=0)
    return "changed", "\n".join(list(diff)[:25])


# ----------------------------------------------------------- notifications ---
def notify(title: str, body: str, args):
    print(f"\a\n*** {title} ***\n{body}\n")
    if args.ntfy:                                    # https://ntfy.sh/<topic>
        _post(f"https://ntfy.sh/{args.ntfy}", body.encode(),
              {"Title": title, "Priority": "urgent", "Click": args.url})
    if args.discord_webhook:
        payload = json.dumps({"content": f"**{title}**\n{body}\n{args.url}"}).encode()
        _post(args.discord_webhook, payload, {"Content-Type": "application/json"})


def _post(url, data, headers):
    try:
        req = urllib.request.Request(url, data=data, headers=headers, method="POST")
        urllib.request.urlopen(req, timeout=10).read()
    except Exception as e:                           # never let alerts crash the loop
        print(f"[warn] notification failed: {e}")


# ------------------------------------------------------------------- check ---
def run_check(args) -> str:
    stamp = dt.datetime.now().strftime("%H:%M:%S")
    STATE_DIR.mkdir(exist_ok=True)
    try:
        text, final_url = fetch(args)
    except Exception as e:
        print(f"[{stamp}] fetch error: {e}")
        return "error"

    if not args.no_login and any(h in final_url.lower() for h in LOGIN_HINTS):
        notify("sitewatch: login expired",
               "Redirected to a login page. Run `login` again.", args)
        return "logged_out"

    text = normalise(text)
    status, detail = evaluate(text, args)
    prev = STATUS_FILE.read_text() if STATUS_FILE.exists() else ""
    STATUS_FILE.write_text(status)
    print(f"[{stamp}] {status} {detail.splitlines()[0] if detail else ''}")

    if status == "in_stock" and prev != "in_stock":
        notify("IN STOCK", f"{args.url}\n{detail}", args)
    elif status == "changed":
        notify("Page changed", detail, args)
    return status


# -------------------------------------------------------------------- watch ---
def parse_hhmm(s: str) -> dt.time:
    return dt.datetime.strptime(s.strip(), "%H:%M").time()


def in_window(window: str | None) -> bool:
    if not window:
        return True
    a, b = (parse_hhmm(x) for x in window.split("-"))
    now = dt.datetime.now().time()
    return a <= now <= b if a <= b else (now >= a or now <= b)


def next_at(times: list[dt.time]) -> dt.datetime:
    now = dt.datetime.now()
    cands = [dt.datetime.combine(now.date(), t) for t in times]
    cands += [c + dt.timedelta(days=1) for c in cands]
    return min(c for c in cands if c > now)


def cmd_watch(args):
    at_times = [parse_hhmm(t) for t in args.at.split(",")] if args.at else None
    print(f"Watching {args.url}  ({'at ' + args.at if at_times else f'every ~{args.every}s'}"
          f"{', window ' + args.between if args.between else ''}). Ctrl+C to stop.")
    try:
        while True:
            if at_times:
                target = next_at(at_times)
                print(f"next check at {target:%Y-%m-%d %H:%M}")
                time.sleep(max(0, (target - dt.datetime.now()).total_seconds()))
                run_check(args)
            else:
                if in_window(args.between):
                    run_check(args)
                time.sleep(args.every + random.uniform(0, args.jitter))
    except KeyboardInterrupt:
        print("\nstopped")


# --------------------------------------------------------------------- CLI ---
def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)

    def common(p):
        p.add_argument("--url", required=True)
        p.add_argument("--selector", help="CSS selector to watch (default: whole page)")
        p.add_argument("--wait-for", help="CSS selector to wait for before reading")
        p.add_argument("--in-stock", action="append",
                       help='text that means available, e.g. "Add to cart" (repeatable)')
        p.add_argument("--out-of-stock", action="append",
                       help='text that means unavailable, e.g. "Sold out" (repeatable)')
        p.add_argument("--no-login", action="store_true", help="don't use saved session")
        p.add_argument("--show", action="store_true", help="show the browser window")
        p.add_argument("--ntfy", help="ntfy.sh topic for phone push alerts")
        p.add_argument("--discord-webhook", help="Discord webhook URL for alerts")

    p = sub.add_parser("login", help="log in once and save the session")
    p.add_argument("--url", required=True)
    p.set_defaults(fn=cmd_login)

    p = sub.add_parser("check", help="check once and exit")
    common(p)
    p.set_defaults(fn=lambda a: run_check(a))

    p = sub.add_parser("watch", help="check repeatedly")
    common(p)
    p.add_argument("--every", type=int, default=60, help="seconds between checks")
    p.add_argument("--jitter", type=int, default=10, help="random extra seconds")
    p.add_argument("--at", help='specific daily times, e.g. "09:00,12:30,18:00"')
    p.add_argument("--between", help='only check inside this window, e.g. "08:00-22:00"')
    p.set_defaults(fn=cmd_watch)

    args = ap.parse_args()
    args.fn(args)


if __name__ == "__main__":
    main()
