import { appPath } from "./paths";

// Visitor identity and provider keys for the public demo. The session id isolates this visitor's data; keys live in
// this tab's sessionStorage only and travel as per-request headers, never stored by the server.
const KEY_HEADERS = { groq: "X-Groq-Key", openai: "X-OpenAI-Key", bolna: "X-Bolna-Key" } as const;
export type KeyName = keyof typeof KEY_HEADERS;

function session(): string {
  if (typeof window === "undefined") return "";
  let id = window.localStorage.getItem("sentinel-session") || "";
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(id)) {
    id = Array.from(crypto.getRandomValues(new Uint8Array(18)), (b) => b.toString(16).padStart(2, "0")).join("");
    window.localStorage.setItem("sentinel-session", id);
  }
  return id;
}

export function getKeys(): Partial<Record<KeyName, string>> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.sessionStorage.getItem("sentinel-keys") || "{}");
  } catch {
    return {};
  }
}

export function saveKeys(keys: Partial<Record<KeyName, string>>) {
  const clean = Object.fromEntries(Object.entries(keys).filter(([, v]) => v && v.trim()).map(([k, v]) => [k, v!.trim()]));
  window.sessionStorage.setItem("sentinel-keys", JSON.stringify(clean));
}

export function providerHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const keys = getKeys();
  return {
    "X-Sentinel-Session": session(),
    ...Object.fromEntries((Object.keys(KEY_HEADERS) as KeyName[]).filter((k) => keys[k]).map((k) => [KEY_HEADERS[k], keys[k]!])),
  };
}

export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(appPath(`/api${path}`), {
    ...options,
    headers: {
      ...(options.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...providerHeaders(),
      ...(options.headers as Record<string, string> | undefined),
    },
  });
  const result = await response.json();
  if (!response.ok)
    throw new Error(
      typeof result.detail === "string"
        ? result.detail
        : JSON.stringify(result.detail || result),
    );
  return result;
}
export const post = <T>(path: string, body?: unknown) =>
  api<T>(path, {
    method: "POST",
    body: body ? JSON.stringify(body) : undefined,
  });
