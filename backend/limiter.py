import ipaddress

from fastapi import Request
from slowapi import Limiter


def _real_ip(request: Request) -> str:
    """Resolve real client IP via X-Forwarded-For (Render injects this).

    Render's load balancer sets X-Forwarded-For to the real client IP.
    Without this, all requests share the load balancer's IP and hit the
    same rate-limit bucket, making per-IP limiting ineffective.
    """
    xff = request.headers.get("X-Forwarded-For")
    if xff:
        candidate = xff.split(",")[0].strip()
        try:
            ipaddress.ip_address(candidate)
            return candidate
        except ValueError:
            pass
    return request.client.host if request.client else "unknown"


limiter = Limiter(key_func=_real_ip)
