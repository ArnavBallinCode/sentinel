import logging, os, httpx
from .keyring import get_key
from urllib.parse import quote


log = logging.getLogger("sentinel.bolna")


class ProviderError(Exception):
    pass


class BolnaAdapter:
    def __init__(self, transport=None):
        self.transport = transport

    async def request(self, method, path, payload=None):
        key = get_key("BOLNA_API_KEY")
        if not key:
            from .public_demo import enabled
            raise ProviderError(
                "Add your Bolna API key under Connections to use hosted Bolna."
                if enabled() else "Configure BOLNA_API_KEY on the server to use hosted Bolna."
            )
        async with httpx.AsyncClient(
            base_url="https://api.bolna.ai",
            headers={"Authorization": f"Bearer {key}"},
            timeout=30,
            transport=self.transport,
        ) as client:
            try:
                r = await client.request(method, path, json=payload)
                r.raise_for_status()
                return r.json()
            except (httpx.HTTPError, ValueError) as e:
                # The provider's reason stays in the server log; clients only see the status.
                response = getattr(e, "response", None)
                if response is not None:
                    log.warning("Bolna %s %s -> %s: %s", method, path, response.status_code, response.text[:500])
                raise ProviderError(
                    f"Bolna request failed ({getattr(getattr(e, 'response', None), 'status_code', 'network')}). No automatic call retry was attempted."
                ) from None

    async def agent(self, id):
        return await self.request("GET", f"/v2/agent/{quote(id, safe='')}")

    async def start(self, id, recipient):
        payload = {"agent_id": id, "recipient_phone_number": recipient}
        # Without a sender Bolna uses the account default, which may not be the provider the agent dials with.
        if sender := os.getenv("BOLNA_FROM_PHONE_NUMBER"):
            payload["from_phone_number"] = sender
        return await self.request("POST", "/call", payload)

    async def execution(self, id):
        return await self.request("GET", f"/executions/{quote(id, safe='')}")


def normalize_execution(raw):
    transcript = raw.get("transcript") or ""
    segments = []
    if isinstance(transcript, str):
        for i, line in enumerate(transcript.splitlines()):
            if line.strip():
                speaker, sep, body = line.partition(":")
                segments.append(
                    {
                        "id": f"s{i + 1}",
                        "speaker": (
                            "agent"
                            if speaker.strip().lower() in ("assistant", "agent")
                            else "caller"
                        )
                        if sep
                        else "unknown",
                        "text": body.strip() if sep else line,
                        "start": None,
                        "end": None,
                        "timestamp_quality": "unavailable",
                    }
                )
    elif isinstance(transcript, list):
        for i, s in enumerate(transcript):
            if isinstance(s, dict):
                segments.append(
                    {
                        "id": f"s{i + 1}",
                        "speaker": {"assistant": "agent", "user": "caller"}.get(
                            s.get("role", s.get("speaker")),
                            s.get("role", s.get("speaker", "unknown")),
                        ),
                        "text": s.get("content", s.get("text", "")),
                        "start": None,
                        "end": None,
                        "timestamp_quality": "unavailable",
                    }
                )
    execution_id = raw.get("execution_id") or raw.get("id")
    telephony = raw.get("telephony_data") or {}
    duration = raw.get("conversation_duration") or telephony.get("duration")
    coverage = []
    try:
        duration = float(duration)
    except (TypeError, ValueError):
        duration = None
    if duration and segments:
        # Bolna transcripts carry no timestamps; spread the call duration by text length so playback
        # lands near each turn. Marked "estimated" so nobody mistakes it for alignment.
        total = sum(max(len(s["text"]), 1) for s in segments)
        clock = 0.0
        for s in segments:
            span = duration * max(len(s["text"]), 1) / total
            s.update(start=round(clock, 1), end=round(clock + span, 1), timestamp_quality="estimated")
            clock += span
        coverage.append("Segment timestamps are estimated from call duration and text length, not aligned to audio.")
    else:
        coverage.append("Provider timestamps are unavailable.")
    result = {
        "transcript": segments,
        "provider_execution_id": execution_id,
        "provider_status": raw.get("status"),
        "audio": f"/api/bolna/executions/{quote(str(execution_id), safe='')}/recording"
        if telephony.get("recording_url") and execution_id
        else None,
        "coverage": coverage,
        "cost": raw.get("total_cost"),
        "findings": [],
    }
    logs = raw.get("tool_call_logs")
    if isinstance(logs, list) and logs:
        requests = []
        for log in logs:
            if not isinstance(log, dict):
                continue
            args = log.get("arguments") or log.get("params") or log.get("request") or {}
            if isinstance(args, str):
                try:
                    import json as _json
                    args = _json.loads(args)
                except ValueError:
                    args = {}
            if not isinstance(args, dict):
                args = {}
            requests.append({
                "tool": str(log.get("tool_name") or log.get("name") or log.get("tool") or "unknown_tool"),
                "account_id": str((args or {}).get("account_id", "")),
                "segment_id": None,
                "provider_trace": True,
                "provider_outcome": log.get("status") or "unknown",
            })
        if requests:
            result["tool_requests"] = requests
    else:
        coverage.append("The provider returned no tool call logs for this call.")
    return result
