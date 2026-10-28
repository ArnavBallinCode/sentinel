import { test, expect } from "@playwright/test";
// Use a fresh isolated database when running this test. It intentionally creates versions and run evidence.
test("graph execution, evidence, refusal fix, regression and reload", async ({
  page,
}) => {
  test.setTimeout(60000);
  const existingRuns = await (await page.request.get("/api/runs")).json();
  await page.goto("/");
  await page.getByRole("button", { name: "Run an attack" }).click();
  await expect(page.getByLabel("Workflow name")).toHaveValue(
    "Bolna Agent Security Test",
  );
  const bolna = page
    .locator(".react-flow__node")
    .filter({ hasText: "Bolna agent" });
  await expect(bolna).toBeVisible();
  await page.getByRole("radio", { name: "Baseline" }).click();
  await page.getByRole("button", { name: "Run test", exact: true }).click();
  await expect(page.locator(".verdict-actions")).toBeVisible({timeout: 15000});
  await expect(page.locator(".verdict h3")).toContainText("Unauthorized tool request blocked in test");
  await page.getByRole("button", {name: "Expand Manual trigger"}).click();
  const detail = page.getByRole("dialog", {name: "Expanded node details"});
  for (let i = 0; i < 9; i++) {
    await expect(detail.getByText("WHAT THIS STEP DOES", {exact: true})).toBeVisible();
    await expect(detail.getByText("WHAT ACTUALLY HAPPENED", {exact: true})).toBeVisible();
    await detail.getByRole("button", {name: /^Trace/}).click();
    await expect(detail.locator(".node-trace article").first()).toBeVisible();
    await detail.getByRole("button", {name: "Overview", exact: true}).click();
    if (i < 8) await detail.getByRole("button", {name: "Next step"}).click();
  }
  await detail.getByRole("button", {name: "Close node details"}).click();
  await page.getByRole("button", { name: "Findings 1", exact: true }).click();
  await expect(page.locator(".console-body")).toContainText("blocked");
  await page.locator(".console-tabs").getByRole("button", { name: "Verdict" }).click();
  await page.getByRole("button", { name: "Harden agent & retest" }).click();
  await expect(page.locator(".before-after")).toContainText("Resolved: identity", {timeout: 15000});
  await expect(
    page.getByRole("button", { name: "Findings", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Regression comparison", exact: true })
    .click();
  await page.getByLabel("Before", { exact: true }).selectOption({ index: 2 });
  await page.getByLabel("After", { exact: true }).selectOption({ index: 1 });
  await page
    .getByRole("button", { name: "Compare results", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Passed", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("1 resolved · 0 new · 1 changed nodes.", { exact: false }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.reload();
  await page
    .getByRole("button", { name: "Execution history", exact: true })
    .click();
  await expect(page.locator(".history-row")).toHaveCount(existingRuns.length + 2);
});

test("recording privacy audit, review, export, and persisted canvas edits", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", e => errors.push(e.message));
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Break your voice agent/ })).toBeVisible();
  await page.getByRole("button", { name: "Recording audits", exact: true }).click();
  await expect(page.getByLabel("Import a completed Bolna call")).toBeVisible();
  const filename = `privacy-e2e-${Date.now()}.json`;
  await page.locator('input[type="file"]').setInputFiles({
    name: filename, mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify({transcript: [
      {speaker: "caller", start: 0, end: 3, text: "Please contact me at demo@example.com"},
      {speaker: "agent", start: 12, end: 15, text: "I cannot verify the payment without checking."},
    ]})),
  });
  const artifact = page.locator(".version-row").filter({hasText: filename});
  await artifact.getByRole("button", {name: "Use in audit"}).click();
  await page.getByRole("button", {name: "Run audit", exact: true}).click();
  await page.getByRole("button", {name: "Start recording audit"}).click();
  await expect(page.locator(".verdict-actions")).toBeVisible({timeout: 15000});
  await page.locator(".console-tabs").getByRole("button", {name: /Findings/}).click();
  await expect(page.locator(".console-body")).toContainText("pii email");
  await expect(page.locator(".console-body")).not.toContainText("demo@example.com");
  await page.locator(".console-body").getByLabel("Review finding").first().selectOption("confirmed");
  await expect(page.getByRole("status")).toContainText("Review recorded");
  const exportUrl = await page.getByTitle("Export run JSON").getAttribute("href");
  const report = await page.request.get(exportUrl!);
  expect(report.ok()).toBeTruthy();
  expect(await report.text()).not.toContain("demo@example.com");
  // Move an actual graph node and verify that reloading does not auto-arrange it away.
  await page.getByRole("button", {name: /Test results/}).click();
  const node = page.locator('.react-flow__node[data-id="n0"]');
  const bounds = (await node.boundingBox())!;
  await page.mouse.move(bounds.x + 100, bounds.y + 35);
  await page.mouse.down(); await page.mouse.move(bounds.x + 150, bounds.y + 65, {steps: 10}); await page.mouse.up();
  await page.getByRole("button", {name: "More actions"}).click();
  await page.getByRole("menuitem", {name: /Save version/}).click();
  const saved = await (await page.request.get("/api/workflows/audit")).json();
  expect(saved.nodes[0].position).not.toEqual({x: 0, y: 0});
  await page.reload();
  await page.getByRole("button", {name: "Call audit Import · redact · review"}).click();
  const position = saved.nodes[0].position;
  const rendered = await page.locator('.react-flow__node[data-id="n0"]').evaluate(el => {
    const matrix = new DOMMatrix(getComputedStyle(el).transform);
    return { x: matrix.m41, y: matrix.m42 };
  });
  expect(rendered.x).toBeCloseTo(position.x, 2);
  expect(rendered.y).toBeCloseTo(position.y, 2);
  expect(errors).toEqual([]);
});

test("overview navigation, theme, and compact screen", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", {name: "Toggle theme"}).click();
  await expect(page.locator(".app")).not.toHaveClass(/dark/);
  await page.reload();
  await expect(page.locator(".app")).not.toHaveClass(/dark/);
  await page.getByRole("button", {name: "Live voice call Connect · call · inspect"}).click();
  await page.getByRole("button", {name: "Place call", exact: true}).click();
  await expect(page.getByRole("button", {name: "Place authorized call"})).toBeDisabled();
  await page.getByRole("button", {name: "Close dialog"}).click();
  await page.getByRole("button", {name: "Collapse sidebar"}).click();
  await expect(page.locator(".workbench-nav")).toHaveClass(/is-collapsed/);
  await page.getByRole("button", {name: "Canvas fullscreen", exact: true}).click();
  await expect(page.locator(".app")).toHaveClass(/canvas-only/);
  await expect(page.locator(".workbench-nav")).not.toBeVisible();
  await expect(page.locator(".workflow-toolbar")).not.toBeVisible();
  await expect(page.locator(".execution-console")).not.toBeVisible();
  await page.getByRole("button", {name: "Expand Bolna agent", exact: true}).click();
  await expect(page.getByRole("dialog", {name: "Expanded node details"})).toBeVisible();
  await page.getByRole("button", {name: "Close node details"}).click();
  await page.getByRole("button", {name: "Exit canvas fullscreen"}).click();
  await expect(page.locator(".workbench-nav")).toBeVisible();
  await page.reload();
  await expect(page.locator(".workbench-nav")).toHaveClass(/is-collapsed/);
  await page.locator("#capabilities").scrollIntoViewIfNeeded();
  await expect(page.locator(".catalog-item")).toHaveCount(17);
  await page.getByLabel("Search capabilities").fill("semantic");
  // The evaluator is discoverable by purpose as well as its title.
  await page.getByLabel("Search capabilities").fill("evaluator");
  await expect(page.locator(".catalog-item")).toHaveCount(1);
  await page.locator(".catalog-item summary").click();
  await expect(page.locator(".catalog-description")).toContainText("Groq or OpenAI");
  await page.setViewportSize({width: 390, height: 844});
  await page.locator(".workbench-nav").getByRole("button", {name: "Overview", exact: true}).click();
  await expect(page.getByRole("heading", {name: /Break your voice agent/})).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
});

test("release check executes a bilingual run and exposes recorded evidence", async ({page}) => {
  test.setTimeout(60000);
  const errors: string[]=[];page.on('pageerror', e=>errors.push(e.message));
  let releaseBootstrap!: () => void;
  const bootstrap = new Promise<void>(resolve => { releaseBootstrap = resolve; });
  let firstList = true;
  await page.route('**/api/campaigns', async route => {
    if (route.request().method() === 'GET' && firstList) { firstList = false; await bootstrap; }
    await route.continue();
  });
  await page.goto('/release-check');
  await expect(page.getByRole('button',{name:'Run release check'})).toBeDisabled();
  releaseBootstrap();
  await expect(page.getByRole('button',{name:'Run release check'})).toBeEnabled();
  await expect(page.getByRole('heading',{name:'Release check',level:1})).toBeVisible();
  await page.getByRole('button',{name:'Run release check'}).click();
  await expect(page.locator('.studio-gate strong')).toHaveText('Rehearsal passed',{timeout:30000});
  await expect(page.locator('.studio-table tbody tr')).toHaveCount(8);
  await expect(page.locator('.studio-scorecards .candidate strong')).toHaveText('8/ 8');
  await page.locator('.studio-table tbody tr').first().getByRole('button',{name:'Inspect Needs review evidence'}).click();
  const dialog=page.getByRole('dialog',{name:'Release check evidence'});
  await expect(dialog).toContainText('BLOCKED IN TEST');
  await expect(dialog.getByRole('link',{name:'Open workflow trace'})).toHaveAttribute('href',/\/?run=/);
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await page.reload();
  await expect(page.locator('.studio-gate strong')).toHaveText('Rehearsal passed');
  expect(errors).toEqual([]);
});

test("disabled policy coverage never renders a green verdict", async ({page}) => {
  const graph=await(await page.request.get('/api/workflows/adversarial')).json();
  for(const node of graph.nodes){
    if(node.type==='policy')Object.assign(node.data.config,{identity:false,escalation:false,consent:false});
    if(node.type==='bolna')Object.assign(node.data.config,{engine:'scripted',safe_agent:true});
  }
  const saved=await(await page.request.put('/api/workflows/adversarial',{data:graph})).json();
  const run=await(await page.request.post('/api/runs',{data:{workflow_id:'adversarial',version:saved.version,scenario:'normal'}})).json();
  await page.goto('/?run='+run.id);
  await expect(page.locator('.verdict h3')).toHaveText('Inconclusive — coverage is incomplete',{timeout:15000});
  await expect(page.locator('.verdict-hero')).not.toHaveClass(/tone-success/);
});
