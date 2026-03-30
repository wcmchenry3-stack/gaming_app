"""Shared pytest fixtures."""

import pytest


@pytest.fixture(autouse=True)
def reset_rate_limiter():
    """Reset the in-memory rate limit store before each test.

    slowapi uses an in-memory storage backend by default. Without resetting
    between tests, rate-limit counters carry over and cause spurious 429s.
    """
    from limiter import limiter

    limiter.reset()
    yield
    limiter.reset()
