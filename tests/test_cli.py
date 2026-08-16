from duckmail import cli, config


def test_generate_dry_run_does_not_require_login(capsys):
    args = cli.build_parser().parse_args(["generate", "--dry-run"])
    rc = args.func(args)
    out = capsys.readouterr().out
    assert rc == 0
    assert "@duck.com" in out
    assert "dry-run" in out


def test_generate_without_login_fails(tmp_path, monkeypatch, capsys):
    monkeypatch.setenv("DUCKMAIL_CONFIG_DIR", str(tmp_path))
    args = cli.build_parser().parse_args(["generate"])
    rc = args.func(args)
    assert rc == 1
    assert "Not logged in" in capsys.readouterr().err


def test_whoami_without_login(tmp_path, monkeypatch, capsys):
    monkeypatch.setenv("DUCKMAIL_CONFIG_DIR", str(tmp_path))
    args = cli.build_parser().parse_args(["whoami"])
    rc = args.func(args)
    assert rc == 1
    assert "Not logged in" in capsys.readouterr().out


def test_whoami_logged_in(tmp_path, monkeypatch, capsys):
    monkeypatch.setenv("DUCKMAIL_CONFIG_DIR", str(tmp_path))
    config.save_credentials(config.Credentials(duck_username="alice", token="tok", main_address="alice"))

    args = cli.build_parser().parse_args(["whoami"])
    rc = args.func(args)
    out = capsys.readouterr().out
    assert rc == 0
    assert "alice" in out
    assert "alice@duck.com" in out


def test_logout(tmp_path, monkeypatch, capsys):
    monkeypatch.setenv("DUCKMAIL_CONFIG_DIR", str(tmp_path))
    config.save_credentials(config.Credentials(duck_username="alice", token="tok"))

    args = cli.build_parser().parse_args(["logout"])
    rc = args.func(args)
    assert rc == 0
    assert "Removed" in capsys.readouterr().out
    assert config.load_credentials() is None


def test_history_empty(tmp_path, monkeypatch, capsys):
    monkeypatch.setenv("DUCKMAIL_CONFIG_DIR", str(tmp_path))
    args = cli.build_parser().parse_args(["history"])
    rc = args.func(args)
    assert rc == 0
    assert "No aliases" in capsys.readouterr().out


def test_history_lists_entries(tmp_path, monkeypatch, capsys):
    monkeypatch.setenv("DUCKMAIL_CONFIG_DIR", str(tmp_path))
    config.append_history("abc123@duck.com", note="example.com")

    args = cli.build_parser().parse_args(["history"])
    rc = args.func(args)
    out = capsys.readouterr().out
    assert rc == 0
    assert "abc123@duck.com" in out
    assert "example.com" in out


def test_alias_command_alias_name_works():
    args = cli.build_parser().parse_args(["new", "--dry-run"])
    assert args.func is cli.cmd_generate
