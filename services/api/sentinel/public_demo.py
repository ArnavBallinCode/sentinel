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


_ID = r"[\w.-]+"
_GET = (
    r"/api/(health|settings|registry|scenarios|demo-config|agents|recordings|compare|workflows|campaigns|runs|redteam/(attacks|prompt)|bolna/agents)",
    rf"/api/(agents|campaigns|runs|workflows|recordings)/{_ID}",
    rf"/api/runs/{_ID}/(events|export|reviews)",
    rf"/api/workflows/{_ID}/versions",
    rf"/api/recordings/{_ID}/audio",
    rf"/api/bolna/agents/{_ID}/executions",
    rf"/api/bolna/executions/{_ID}/recording",
)
_POST = (
    r"/api/(campaigns|validate|runs|recordings|redteam/(attacks|harden))",
    rf"/api/campaigns/{_ID}/cancel",
    rf"/api/runs/{_ID}/(cancel|refresh|replay|reviews)",
    rf"/api/bolna/executions/{_ID}/import",
    rf"/api/workflows/{_ID}/publish",
)
_PUT = (rf"/api/workflows/{_ID}",)
_DELETE = (rf"/api/(runs|recordings)/{_ID}",)


def allowed_request(method, path):
    """Everything judges need to run Sentinel end to end. Calls are refused separately (the server has no
    number allowlist); hosted-agent writes, rollbacks, callbacks and the server-side tool endpoint stay closed."""
    rules = {"GET": _GET, "HEAD": _GET, "POST": _POST, "PUT": _PUT, "DELETE": _DELETE}.get(method, ())
    return any(re.fullmatch(rule, path) for rule in rules)
