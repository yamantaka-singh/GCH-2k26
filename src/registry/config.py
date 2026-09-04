import os
from dataclasses import dataclass

from dotenv import load_dotenv

# RFC 7518 section 3.2: an HMAC-SHA256 key must be at least as long as the hash
# output. PyJWT warns below this; for a police system it should be a hard failure.
MIN_JWT_SECRET_BYTES = 32

# 12 hours. A dataclass field for this was config for a value that never varied;
# move it back into Settings if a deployment ever needs its own TTL.
JWT_TTL_SECONDS = 43200


@dataclass(frozen=True)
class Settings:
    database_url: str
    jwt_secret: str


def load_settings() -> Settings:
    """Raises RuntimeError rather than defaulting, so a missing secret fails at boot."""
    # Every entry point (uvicorn, scripts/migrate.py, workers/health_probe.py, ad-hoc
    # scripts) goes through here, so loading .env once in this one place is enough for
    # all of them. Already-set env vars win; load_dotenv() never overrides them.
    load_dotenv()
    url = os.environ.get("DATABASE_URL")
    if not url:
        raise RuntimeError("DATABASE_URL is not set")
    secret = os.environ.get("JWT_SECRET")
    if not secret:
        raise RuntimeError("JWT_SECRET is not set")
    if len(secret.encode()) < MIN_JWT_SECRET_BYTES:
        raise RuntimeError(
            f"JWT_SECRET is {len(secret.encode())} bytes; "
            f"HMAC-SHA256 needs at least {MIN_JWT_SECRET_BYTES} (RFC 7518 3.2)"
        )
    return Settings(database_url=url, jwt_secret=secret)
