import stat

from duckmail import config


def test_save_and_load_credentials(tmp_path, monkeypatch):
    monkeypatch.setenv("DUCKMAIL_CONFIG_DIR", str(tmp_path))

    creds = config.Credentials(duck_username="alice", token="tok", main_address="alice")
    config.save_credentials(creds)

    loaded = config.load_credentials()
    assert loaded == creds

    path = tmp_path / "credentials.json"
    mode = stat.S_IMODE(path.stat().st_mode)
    assert mode == 0o600


def test_load_credentials_missing_returns_none(tmp_path, monkeypatch):
    monkeypatch.setenv("DUCKMAIL_CONFIG_DIR", str(tmp_path))
    assert config.load_credentials() is None


def test_clear_credentials(tmp_path, monkeypatch):
    monkeypatch.setenv("DUCKMAIL_CONFIG_DIR", str(tmp_path))
    config.save_credentials(config.Credentials(duck_username="alice", token="tok"))

    assert config.clear_credentials() is True
    assert config.load_credentials() is None
    assert config.clear_credentials() is False


def test_history_append_and_load(tmp_path, monkeypatch):
    monkeypatch.setenv("DUCKMAIL_CONFIG_DIR", str(tmp_path))

    assert config.load_history() == []

    config.append_history("abc123@duck.com", note="example.com")
    config.append_history("def456@duck.com")

    entries = config.load_history()
    assert len(entries) == 2
    assert entries[0]["address"] == "abc123@duck.com"
    assert entries[0]["note"] == "example.com"
    assert entries[1]["note"] is None
