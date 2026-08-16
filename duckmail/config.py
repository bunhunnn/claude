"""Local storage for duckmail: auth token and generated-alias history.

DuckDuckGo does not expose a server-side list of previously generated
aliases, so we keep a small local history file purely for the user's own
convenience (e.g. to remember which alias was handed to which site).
"""

from __future__ import annotations

import json
import os
import stat
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


def _config_dir() -> Path:
    override = os.environ.get("DUCKMAIL_CONFIG_DIR")
    if override:
        return Path(override)
    return Path.home() / ".config" / "duckmail"


def _credentials_path() -> Path:
    return _config_dir() / "credentials.json"


def _history_path() -> Path:
    return _config_dir() / "history.json"


def _write_private_file(path: Path, data: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp_path = path.with_suffix(path.suffix + ".tmp")
    tmp_path.write_text(json.dumps(data, indent=2, sort_keys=True))
    tmp_path.chmod(stat.S_IRUSR | stat.S_IWUSR)  # 0600, owner read/write only
    tmp_path.replace(path)


@dataclass
class Credentials:
    duck_username: str  # local part of the user's personal address, before @duck.com
    token: str
    main_address: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


def save_credentials(creds: Credentials) -> None:
    _write_private_file(_credentials_path(), creds.to_dict())


def load_credentials() -> Credentials | None:
    path = _credentials_path()
    if not path.exists():
        return None
    data = json.loads(path.read_text())
    return Credentials(**data)


def clear_credentials() -> bool:
    path = _credentials_path()
    if path.exists():
        path.unlink()
        return True
    return False


def append_history(address: str, note: str | None = None) -> None:
    path = _history_path()
    entries: list[dict[str, Any]] = []
    if path.exists():
        entries = json.loads(path.read_text()).get("entries", [])
    entries.append(
        {
            "address": address,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "note": note,
        }
    )
    _write_private_file(path, {"entries": entries})


def load_history() -> list[dict[str, Any]]:
    path = _history_path()
    if not path.exists():
        return []
    return json.loads(path.read_text()).get("entries", [])
