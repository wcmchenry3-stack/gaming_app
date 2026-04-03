"""Unit tests for helpers in main.py."""

import os

import pytest


class TestAllowedOrigins:
    """ALLOWED_ORIGINS env var is parsed into a list of origin strings."""

    def test_custom_domains_parsed(self, monkeypatch):
        monkeypatch.setenv(
            "ALLOWED_ORIGINS",
            "https://dev-games.buffingchi.com,https://dev-games-api.buffingchi.com",
        )
        # Re-import to pick up the patched env
        import importlib
        import main

        importlib.reload(main)
        assert "https://dev-games.buffingchi.com" in main._allowed_origins
        assert "https://dev-games-api.buffingchi.com" in main._allowed_origins

    def test_defaults_to_localhost_when_unset(self, monkeypatch):
        monkeypatch.delenv("ALLOWED_ORIGINS", raising=False)
        import importlib
        import main

        importlib.reload(main)
        assert "http://localhost:8081" in main._allowed_origins
        assert "http://localhost:19006" in main._allowed_origins
