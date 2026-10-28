"""Explicitly isolated, provider-free public rehearsal deployment."""
import os
import re
from pathlib import Path


def enabled():
    return os.getenv("SENTINEL_PUBLIC_DEMO") == "true"


def validate_environment():
    if not enabled():
        return
    data = Path(os.getenv("SENTINEL_DATA_DIR", "data"))
    if data.name != "public-demo" or os.getenv("DATABASE_URL") not in (
        None, f"sqlite:///{data}/sentinel.db"
    ):
        raise RuntimeError("Public demo requires a separate public-demo data directory.")
    for key in ("BOLNA_API_KEY", "GROQ_API_KEY", "OPENAI_API_KEY", "ALLOWED_TEST_NUMBERS", "TOOL_ENDPOINT_TOKEN", "WEBHOOK_SECRET"):
        if os.getenv(key):
            raise RuntimeError(f"Public demo must not have {key} configured.")
    if len(os.getenv("SENTINEL_API_TOKEN", "")) < 32:
        raise RuntimeError("Public demo requires the private gateway token.")


def allowed_request(method, path):
    if method in ("GET", "HEAD"):
        return bool(re.fullmatch(
            r"/api/(health|settings|registry|scenarios|demo-config|agents|recordings|compare|"
            r"workflows(?:/[\w-]+(?:/versions)?)?|campaigns(?:/[\w-]+)?|"
            r"runs(?:/[\w-]+(?:/(?:events|export|reviews))?)?)", path
        ))
    return method == "POST" and bool(re.fullmatch(r"/api/(campaigns|validate)", path))
