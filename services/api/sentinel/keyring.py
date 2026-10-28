"""Per-request provider keys and visitor identity for the public demo.

Keys arrive in request headers and live only in this request's context (and the tasks it starts). They are never
written to the database, the event log, evidence exports or the server log.
"""
import contextvars
import os
import re

KEYS: contextvars.ContextVar[dict] = contextvars.ContextVar("provider_keys", default={})
OWNER: contextvars.ContextVar[str | None] = contextvars.ContextVar("owner", default=None)

HEADER_KEYS = {"x-groq-key": "GROQ_API_KEY", "x-openai-key": "OPENAI_API_KEY", "x-bolna-key": "BOLNA_API_KEY"}
_KEY = re.compile(r"[\x21-\x7e]{8,300}")
_SESSION = re.compile(r"[A-Za-z0-9_-]{16,64}")


def get_key(name: str) -> str | None:
    return KEYS.get().get(name) or os.getenv(name) or None


def bind(headers) -> None:
    """Adopt the visitor's session id and any keys they sent. Malformed values are ignored."""
    session = headers.get("x-sentinel-session", "")
    OWNER.set(session if _SESSION.fullmatch(session) else None)
    KEYS.set({
        env: value for header, env in HEADER_KEYS.items()
        if _KEY.fullmatch(value := headers.get(header, ""))
    })
