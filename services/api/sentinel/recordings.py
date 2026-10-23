"""Fetch signed recording URLs without forwarding provider credentials."""
import asyncio
import ipaddress
import os
import socket
from urllib.parse import urlparse
import httpx


async def validate_url(url):
    parsed = urlparse(url)
    if parsed.scheme != 'https' or not parsed.hostname or parsed.username or parsed.password or parsed.port not in (None, 443):
        raise ValueError('Recording URL must use public HTTPS.')
    hosts = {h.strip().lower() for h in os.getenv('RECORDING_ALLOWED_HOSTS', '').split(',') if h.strip()}
    if hosts and parsed.hostname.lower() not in hosts:
        raise ValueError('Recording host is not in RECORDING_ALLOWED_HOSTS.')
    try:
        addresses = await asyncio.get_running_loop().getaddrinfo(parsed.hostname, 443, type=socket.SOCK_STREAM)
    except OSError:
        raise ValueError('Recording host could not be resolved.') from None
    if not addresses or any(not ipaddress.ip_address(a[4][0]).is_global for a in addresses):
        raise ValueError('Recording destination must be a public host.')


async def fetch_recording(url):
    limit = 25 * 1024 * 1024
    # No inherited Bolna credentials, redirects or proxy environment. Provider URLs must be signed/public.
    async with httpx.AsyncClient(timeout=30, follow_redirects=False, trust_env=False) as client:
        await validate_url(url)
        try:
            async with client.stream('GET', url) as response:
                if response.status_code != 200:
                    raise ValueError('Recording requires a supported signed URL. Open the original in Bolna if unavailable.')
                kind = response.headers.get('content-type', '').split(';')[0]
                if not (kind.startswith('audio/') or kind == 'application/octet-stream'):
                    raise ValueError('Provider returned an unsupported recording content type.')
                data = bytearray()
                async for part in response.aiter_bytes():
                    data.extend(part)
                    if len(data) > limit:
                        raise ValueError('Recording exceeds the 25 MB playback limit.')
                return bytes(data), kind
        except httpx.HTTPError:
            raise ValueError('Recording download failed; provider details omitted.') from None
