from unittest.mock import MagicMock, patch

import pytest

from duckmail import api


def _mock_response(status_code=200, json_data=None, text=""):
    resp = MagicMock()
    resp.status_code = status_code
    resp.ok = 200 <= status_code < 400
    resp.text = text
    resp.json.return_value = json_data or {}
    return resp


def test_extract_otp_from_raw_code():
    assert api.extract_otp(" ABC 123 ") == "ABC123"


def test_extract_otp_from_link():
    url = "https://duckduckgo.com/email/login?otp=xyz789&user=someone"
    assert api.extract_otp(url) == "xyz789"


def test_extract_otp_from_link_missing_param_raises():
    with pytest.raises(api.DuckMailError):
        api.extract_otp("https://duckduckgo.com/email/login?user=someone")


def test_extract_otp_empty_raises():
    with pytest.raises(api.DuckMailError):
        api.extract_otp("   ")


@patch("duckmail.api._session")
def test_request_login_code_success(mock_session_factory):
    session = MagicMock()
    session.get.return_value = _mock_response(200)
    mock_session_factory.return_value = session

    api.request_login_code("user@duck.com")

    called_url = session.get.call_args.args[0]
    called_params = session.get.call_args.kwargs["params"]
    assert called_url == f"{api.BASE_URL}/auth/loginlink"
    assert called_params == {"user": "user"}  # @duck.com suffix stripped


@patch("duckmail.api._session")
def test_request_login_code_failure_raises(mock_session_factory):
    session = MagicMock()
    session.get.return_value = _mock_response(500, text="boom")
    mock_session_factory.return_value = session

    with pytest.raises(api.DuckMailError):
        api.request_login_code("user")


@patch("duckmail.api.get_main_address")
@patch("duckmail.api._session")
def test_verify_login_code_success(mock_session_factory, mock_get_main):
    session = MagicMock()
    session.get.return_value = _mock_response(200, json_data={"token": "tok123"})
    mock_session_factory.return_value = session
    mock_get_main.return_value = "myaddress"

    result = api.verify_login_code("user", "123456")

    assert result.token == "tok123"
    assert result.main_address == "myaddress"


@patch("duckmail.api._session")
def test_verify_login_code_rejected_raises_auth_error(mock_session_factory):
    session = MagicMock()
    session.get.return_value = _mock_response(401)
    mock_session_factory.return_value = session

    with pytest.raises(api.AuthenticationError):
        api.verify_login_code("user", "bad")


@patch("duckmail.api._session")
def test_generate_alias_success(mock_session_factory):
    session = MagicMock()
    session.post.return_value = _mock_response(200, json_data={"address": "abc123"})
    mock_session_factory.return_value = session

    alias = api.generate_alias("tok123")

    assert alias == "abc123"
    headers = session.post.call_args.kwargs["headers"]
    assert headers == {"Authorization": "Bearer tok123"}


@patch("duckmail.api._session")
def test_generate_alias_expired_session_raises(mock_session_factory):
    session = MagicMock()
    session.post.return_value = _mock_response(403)
    mock_session_factory.return_value = session

    with pytest.raises(api.AuthenticationError):
        api.generate_alias("tok123")


@patch("duckmail.api._session")
def test_get_main_address_missing_field_raises(mock_session_factory):
    session = MagicMock()
    session.get.return_value = _mock_response(200, json_data={})
    mock_session_factory.return_value = session

    with pytest.raises(api.DuckMailError):
        api.get_main_address("tok123")
