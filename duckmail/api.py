"""Thin client for the DuckDuckGo Email Protection ("duck.com") service.

This mirrors the private, unofficial API used internally by DuckDuckGo's
own browser extension (https://github.com/duckduckgo/duckduckgo-privacy-extension)
to log in and mint new "Generate Private Duck Address" aliases. It is not
a documented/public API and DuckDuckGo may change it at any time without
notice -- if requests start failing, check the extension's source for the
current endpoint shapes and update BASE_URL / paths below.

Only use this against an account you own.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from urllib.parse import urlparse, parse_qs

import requests

BASE_URL = "https://quack.duckduckgo.com/api"
USER_AGENT = "duckmail-cli/0.1 (+https://duckduckgo.com/email)"
REQUEST_TIMEOUT = 15


class DuckMailError(RuntimeError):
    """Raised for any failure talking to the Email Protection API."""


class AuthenticationError(DuckMailError):
    """Raised when the stored/provided credentials are rejected."""


@dataclass
class LoginResult:
    token: str
    main_address: str | None


def _session() -> requests.Session:
    s = requests.Session()
    s.headers.update({"User-Agent": USER_AGENT, "Accept": "application/json"})
    return s


def request_login_code(duck_username: str) -> None:
    """Ask DuckDuckGo to email a one-time login code to the account's backup address.

    ``duck_username`` is the local part of the user's personal duck.com
    address (the text before ``@duck.com``), not the backup email itself.
    """
    duck_username = duck_username.strip().removesuffix("@duck.com")
    resp = _session().get(
        f"{BASE_URL}/auth/loginlink",
        params={"user": duck_username},
        timeout=REQUEST_TIMEOUT,
    )
    if not resp.ok:
        raise DuckMailError(
            f"Failed to request a login code for '{duck_username}' "
            f"(HTTP {resp.status_code}): {resp.text[:200]}"
        )


def extract_otp(user_input: str) -> str:
    """Accept either a raw OTP code or a pasted magic-link URL and return the code."""
    user_input = user_input.strip()
    if user_input.startswith("http://") or user_input.startswith("https://"):
        query = parse_qs(urlparse(user_input).query)
        if "otp" in query and query["otp"]:
            return query["otp"][0]
        raise DuckMailError("Could not find an 'otp' parameter in the pasted link.")
    # Otherwise assume it's the raw code (DuckDuckGo codes are alphanumeric).
    code = re.sub(r"\s+", "", user_input)
    if not code:
        raise DuckMailError("Empty OTP code.")
    return code


def verify_login_code(duck_username: str, otp: str) -> LoginResult:
    """Exchange a one-time code for a bearer token, then fetch the main address."""
    duck_username = duck_username.strip().removesuffix("@duck.com")
    session = _session()
    resp = session.get(
        f"{BASE_URL}/auth/login",
        params={"user": duck_username, "otp": otp},
        timeout=REQUEST_TIMEOUT,
    )
    if resp.status_code in (401, 403):
        raise AuthenticationError("The login code was rejected or has expired. Request a new one.")
    if not resp.ok:
        raise DuckMailError(f"Login failed (HTTP {resp.status_code}): {resp.text[:200]}")

    token = _extract_token(resp)
    main_address = None
    try:
        main_address = get_main_address(token)
    except DuckMailError:
        pass  # Non-fatal: some accounts/responses may not expose this.
    return LoginResult(token=token, main_address=main_address)


def _extract_token(resp: requests.Response) -> str:
    try:
        data = resp.json()
    except ValueError as exc:
        raise DuckMailError("Unexpected (non-JSON) response from DuckDuckGo during login.") from exc
    token = data.get("token") or data.get("access_token")
    if not token:
        raise DuckMailError(f"Login response did not contain a token: {data!r}")
    return token


def _auth_headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def get_main_address(token: str) -> str:
    """Return the user's permanent personal duck.com address (local part)."""
    resp = _session().get(
        f"{BASE_URL}/email/addresses",
        headers=_auth_headers(token),
        timeout=REQUEST_TIMEOUT,
    )
    if resp.status_code in (401, 403):
        raise AuthenticationError("Session expired. Please log in again.")
    if not resp.ok:
        raise DuckMailError(f"Failed to fetch main address (HTTP {resp.status_code}): {resp.text[:200]}")
    data = resp.json()
    address = data.get("address")
    if not address:
        raise DuckMailError(f"Unexpected response fetching main address: {data!r}")
    return address


def generate_alias(token: str) -> str:
    """Mint a new random 'Generate Private Duck Address' alias, e.g. 'abc123'."""
    resp = _session().post(
        f"{BASE_URL}/email/addresses",
        headers=_auth_headers(token),
        timeout=REQUEST_TIMEOUT,
    )
    if resp.status_code in (401, 403):
        raise AuthenticationError("Session expired. Please log in again.")
    if not resp.ok:
        raise DuckMailError(f"Failed to generate alias (HTTP {resp.status_code}): {resp.text[:200]}")
    data = resp.json()
    address = data.get("address")
    if not address:
        raise DuckMailError(f"Unexpected response generating alias: {data!r}")
    return address
