import os

from .keyring import get_key


def _provider(kind: str) -> str:
    requested = os.getenv(f"{kind.upper()}_PROVIDER", "auto").lower()
    available = {
        "openai": bool(get_key("OPENAI_API_KEY")),
        "groq": bool(get_key("GROQ_API_KEY")),
    }
    if requested == "auto":
        for name in ("groq", "openai"):
            if available[name]:
                return name
        from .public_demo import enabled
        raise ValueError(
            "Add your Groq or OpenAI key under Connections to use this capability."
            if enabled() else "Configure GROQ_API_KEY or OPENAI_API_KEY for this capability."
        )
    if requested not in available:
        raise ValueError(f"Unsupported {kind} provider: {requested}.")
    if not available[requested]:
        raise ValueError(f"{requested.upper()}_API_KEY is required for {kind}.")
    return requested


def semantic_provider() -> dict:
    name = _provider("evaluator")
    if name == "groq":
        return {
            "name": name,
            "key": get_key("GROQ_API_KEY"),
            "url": "https://api.groq.com/openai/v1/chat/completions",
            "model": os.getenv("GROQ_EVALUATOR_MODEL", "openai/gpt-oss-20b"),
        }
    return {
        "name": name,
        "key": get_key("OPENAI_API_KEY"),
        "url": "https://api.openai.com/v1/chat/completions",
        "model": os.getenv("EVALUATOR_MODEL", "gpt-4.1-mini"),
    }


def transcription_provider() -> dict:
    name = _provider("transcription")
    if name == "groq":
        return {
            "name": name,
            "key": get_key("GROQ_API_KEY"),
            "url": "https://api.groq.com/openai/v1/audio/transcriptions",
            "model": os.getenv("GROQ_TRANSCRIPTION_MODEL", "whisper-large-v3-turbo"),
        }
    return {
        "name": name,
        "key": get_key("OPENAI_API_KEY"),
        "url": "https://api.openai.com/v1/audio/transcriptions",
        "model": os.getenv("TRANSCRIPTION_MODEL", "whisper-1"),
    }


def configured_providers() -> list[str]:
    return [
        name
        for name, configured in {
            "groq": bool(get_key("GROQ_API_KEY")),
            "openai": bool(get_key("OPENAI_API_KEY")),
        }.items()
        if configured
    ]
