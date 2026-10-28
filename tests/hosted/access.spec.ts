import { test, expect } from "@playwright/test";
const at = (path: string) => `${process.env.E2E_BASE_PATH || ""}${path}`;

test("anonymous, malformed and spoofed requests cannot reach private evidence", async ({ playwright, baseURL }) => {
  const anonymous = await playwright.request.newContext({ baseURL, httpCredentials: undefined });
  for (const path of ["/", "/release-check", "/api/settings", "/api/runs", "/api/campaigns", "/api/runs/unknown/export"]) {
    const response = await anonymous.get(at(path));
    expect(response.status()).toBe(401);
    expect(response.headers()["www-authenticate"]).toContain("Basic");
  }
  for (const headers of [
    {"X-Sentinel-Token": "synthetic-internal-token-for-hosted-tests-only"},
    {Authorization: "Basic !!!"},
    {Authorization: `Basic ${Buffer.from("sentinel-test:wrong").toString("base64")}`},
    {"x-middleware-subrequest": "proxy:proxy:proxy:proxy:proxy"},
  ]) expect((await anonymous.get(at("/api/runs"), { headers })).status()).toBe(401);
  expect((await anonymous.get(at("/api/health"))).status()).toBe(200);
  expect((await anonymous.get(`${process.env.E2E_API_URL}/api/runs`)).status()).toBe(401);
  await anonymous.dispose();
});

test("signed-in browser can run a release check and inspect streamed evidence", async ({ page, request, baseURL }) => {
  await page.goto(at("/release-check"));
  await expect(page.getByRole("heading", {name: "Release check", level: 1})).toBeVisible();
  const settings = await request.get(at("/api/settings"));
  expect(settings.status()).toBe(200);
  expect(settings.headers()["cache-control"]).toContain("no-store");
  const badOrigin = await request.post(at("/api/campaigns"), {data: {engine: "scripted"}, headers: {Origin: "https://untrusted.invalid"}});
  expect(badOrigin.status()).toBe(403);
  await page.getByRole("button", {name: "Run release check"}).click();
  await expect(page.locator(".studio-gate strong")).toHaveText("Rehearsal passed", {timeout: 30000});
  await page.locator(".studio-table tbody tr").first().getByRole("button", {name: "Inspect Needs review evidence"}).click();
  await expect(page.getByRole("dialog")).toContainText("BLOCKED IN TEST");
  const trace = await page.getByRole("link", {name: "Open workflow trace"}).getAttribute("href");
  const id = new URL(trace!, baseURL).searchParams.get("run");
  expect((await request.get(at(`/api/runs/${id}/export`))).status()).toBe(200);
  const stream = await request.get(at(`/api/runs/${id}/events`));
  expect(stream.status()).toBe(200);
  expect(stream.headers()["content-type"]).toContain("text/event-stream");
  await page.getByRole("link", {name: "Open workflow trace"}).click();
  await expect(page.locator(".react-flow__node").first()).toBeVisible();
});
