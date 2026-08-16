"""Command-line interface for duckmail."""

from __future__ import annotations

import argparse
import getpass
import secrets
import sys

from . import api, config


def _full_address(local_part: str) -> str:
    local_part = local_part.removesuffix("@duck.com")
    return f"{local_part}@duck.com"


def cmd_login(args: argparse.Namespace) -> int:
    duck_username = args.username or input("Your duck.com address (e.g. yourname1234): ").strip()
    duck_username = duck_username.removesuffix("@duck.com")

    try:
        api.request_login_code(duck_username)
    except api.DuckMailError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1

    print(f"A login code was sent to the backup email for {_full_address(duck_username)}.")
    raw = getpass.getpass("Enter the code (or paste the full link from the email): ")
    try:
        otp = api.extract_otp(raw)
        result = api.verify_login_code(duck_username, otp)
    except api.DuckMailError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1

    config.save_credentials(
        config.Credentials(
            duck_username=duck_username,
            token=result.token,
            main_address=result.main_address,
        )
    )
    print("Logged in and saved credentials to your local config.")
    if result.main_address:
        print(f"Personal address: {_full_address(result.main_address)}")
    return 0


def cmd_logout(_args: argparse.Namespace) -> int:
    if config.clear_credentials():
        print("Removed stored credentials.")
    else:
        print("No stored credentials found.")
    return 0


def cmd_whoami(_args: argparse.Namespace) -> int:
    creds = config.load_credentials()
    if not creds:
        print("Not logged in. Run: duckmail login")
        return 1
    print(f"Duck.com username: {creds.duck_username}")
    if creds.main_address:
        print(f"Personal address:  {_full_address(creds.main_address)}")
    return 0


def _simulated_alias() -> str:
    return secrets.token_hex(6)


def cmd_generate(args: argparse.Namespace) -> int:
    if args.dry_run:
        alias = _simulated_alias()
        print(f"[dry-run, not saved to DuckDuckGo] {_full_address(alias)}")
        return 0

    creds = config.load_credentials()
    if not creds:
        print("Not logged in. Run: duckmail login", file=sys.stderr)
        return 1

    try:
        alias = api.generate_alias(creds.token)
    except api.AuthenticationError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1
    except api.DuckMailError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1

    full = _full_address(alias)
    config.append_history(full, note=args.note)
    print(full)
    return 0


def cmd_history(args: argparse.Namespace) -> int:
    entries = config.load_history()
    if not entries:
        print("No aliases generated yet.")
        return 0
    for entry in entries[-args.limit :]:
        note = f"  ({entry['note']})" if entry.get("note") else ""
        print(f"{entry['created_at']}  {entry['address']}{note}")
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="duckmail",
        description="Generate DuckDuckGo Email Protection (@duck.com) aliases from the command line.",
    )
    sub = parser.add_subparsers(dest="command", required=True)

    p_login = sub.add_parser("login", help="Log in to your duck.com account")
    p_login.add_argument("username", nargs="?", help="Your duck.com address, with or without @duck.com")
    p_login.set_defaults(func=cmd_login)

    p_logout = sub.add_parser("logout", help="Forget stored credentials")
    p_logout.set_defaults(func=cmd_logout)

    p_whoami = sub.add_parser("whoami", help="Show the logged-in account")
    p_whoami.set_defaults(func=cmd_whoami)

    p_gen = sub.add_parser("generate", aliases=["new", "alias"], help="Generate a new @duck.com alias")
    p_gen.add_argument("-n", "--note", help="Local note to remember what this alias is for (e.g. a site name)")
    p_gen.add_argument(
        "--dry-run",
        action="store_true",
        help="Print a locally-simulated alias without calling DuckDuckGo or requiring login",
    )
    p_gen.set_defaults(func=cmd_generate)

    p_hist = sub.add_parser("history", help="List previously generated aliases (stored locally)")
    p_hist.add_argument("-n", "--limit", type=int, default=20, help="Max entries to show (default: 20)")
    p_hist.set_defaults(func=cmd_history)

    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())
