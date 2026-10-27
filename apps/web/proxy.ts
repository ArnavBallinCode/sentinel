import { createHash, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

// A shared workspace gate, not user accounts or tenant isolation.
export function proxy(request: NextRequest) {
  const required = process.env.SENTINEL_REQUIRE_AUTH === "true" || process.env.RENDER === "true";
  if (!required) return NextResponse.next();
  const base = process.env.NEXT_PUBLIC_BASE_PATH || "";
  const path = request.nextUrl.pathname;
  if (path === "/api/health" || path === `${base}/api/health`) return NextResponse.next();

  const username = process.env.SENTINEL_WEB_USERNAME || "";
  const password = process.env.SENTINEL_WEB_PASSWORD || "";
  const token = process.env.SENTINEL_API_TOKEN || "";
  if (!username || password.length < 24 || token.length < 32) {
    return NextResponse.json({ detail: "Hosted access is not configured." }, { status: 503 });
  }

  const header = request.headers.get("authorization") || "";
  let credentials = "";
  if (/^Basic [A-Za-z0-9+/]+=*$/i.test(header) && header.length < 4096) {
    credentials = Buffer.from(header.slice(6), "base64").toString("utf8");
  }
  const hash = (value: string) => createHash("sha256").update(value).digest();
  if (!timingSafeEqual(hash(credentials), hash(`${username}:${password}`))) {
    return NextResponse.json({ detail: "Sign in to Sentinel." }, {
      status: 401,
      headers: { "WWW-Authenticate": 'Basic realm="Sentinel workspace", charset="UTF-8"', "Cache-Control": "no-store" },
    });
  }

  const headers = new Headers(request.headers);
  headers.delete("authorization");
  headers.delete("cookie");
  // Never trust a caller-supplied gateway token.
  headers.set("X-Sentinel-Token", token);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}
