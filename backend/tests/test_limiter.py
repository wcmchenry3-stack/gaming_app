from unittest.mock import MagicMock

import pytest

from limiter import _real_ip, session_key


def _make_request(xff=None, client_host="1.2.3.4", session_id=None):
    request = MagicMock()
    headers = {}
    if xff is not None:
        headers["X-Forwarded-For"] = xff
    if session_id is not None:
        headers["X-Session-ID"] = session_id
    request.headers.get = lambda key, default=None: headers.get(key, default)
    if client_host is None:
        request.client = None
    else:
        request.client = MagicMock()
        request.client.host = client_host
    return request


def test_real_ip_no_xff():
    assert _real_ip(_make_request()) == "1.2.3.4"


def test_real_ip_valid_single_xff():
    assert _real_ip(_make_request(xff="5.6.7.8")) == "5.6.7.8"


def test_real_ip_proxy_chain_returns_leftmost():
    assert _real_ip(_make_request(xff="5.6.7.8, 10.0.0.1, 10.0.0.2")) == "5.6.7.8"


def test_real_ip_malformed_xff_falls_through():
    assert _real_ip(_make_request(xff="not-an-ip")) == "1.2.3.4"


def test_real_ip_no_xff_no_client():
    assert _real_ip(_make_request(xff=None, client_host=None)) == "unknown"


def test_session_key_with_session_id():
    request = _make_request(session_id="abc-123")
    assert session_key(request) == "abc-123"


def test_session_key_without_session_id_falls_back_to_ip():
    request = _make_request(xff="9.9.9.9")
    assert session_key(request) == "9.9.9.9"
