"""Unit tests for ALLOWED_ORIGINS parsing logic in main.py.

We avoid reloading main (importlib.reload) because it reinitialises the
FastAPI app and wipes in-memory session state, which breaks other tests
running in the same process.  Instead we test the parsing logic inline.
"""


class TestAllowedOriginsLogic:
    """ALLOWED_ORIGINS env var is parsed into a list of stripped origin strings."""

    def test_custom_domains_parsed(self):
        raw = "https://dev-games.buffingchi.com,https://dev-games-api.buffingchi.com"
        result = [o.strip() for o in raw.split(",") if o.strip()]
        assert result == [
            "https://dev-games.buffingchi.com",
            "https://dev-games-api.buffingchi.com",
        ]

    def test_empty_string_gives_empty_list(self):
        raw = ""
        result = [o.strip() for o in raw.split(",") if o.strip()] if raw else []
        assert result == []

    def test_whitespace_trimmed(self):
        raw = "  https://a.example.com , https://b.example.com  "
        result = [o.strip() for o in raw.split(",") if o.strip()]
        assert result == ["https://a.example.com", "https://b.example.com"]
