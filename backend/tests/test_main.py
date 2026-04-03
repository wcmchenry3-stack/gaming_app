"""Unit tests for helpers in main.py."""

from main import _normalise_origin


class TestNormaliseOrigin:
    def test_bare_slug_gets_https_and_onrender_suffix(self):
        assert _normalise_origin("gaming-app-api") == "https://gaming-app-api.onrender.com"

    def test_https_url_unchanged(self):
        assert _normalise_origin("https://example.onrender.com") == "https://example.onrender.com"

    def test_http_url_unchanged(self):
        assert _normalise_origin("http://localhost:8000") == "http://localhost:8000"

    def test_whitespace_trimmed_before_check(self):
        assert _normalise_origin("  gaming-app-api  ") == "https://gaming-app-api.onrender.com"

    def test_https_with_leading_whitespace_unchanged(self):
        result = _normalise_origin("  https://example.com  ")
        assert result == "https://example.com"
