/** Mutates only an explicitly supplied, credential-free demo instance. No external requests. */
import assert from 'node:assert/strict';

const base = process.env.SMOKE_BASE_URL;
if (!base || !['127.0.0.1', 'localhost'].includes(new URL(base).hostname)) {
  throw new Error('Set SMOKE_BASE_URL to an isolated local demo instance. This check creates synthetic runs.');
}
async function json(path, options) {
  const response = await fetch(`${base}/api${path}`, {
    ...options, signal: AbortSignal.timeout(10000),
  });
  assert.ok(response.ok, `${path}: HTTP ${response.status}`);
  return response.json();
}
const settings = await json('/settings');
assert.equal(settings.bolna_configured, false, 'Use a credential-free instance.');
assert.equal(settings.semantic_configured, false, 'Use a credential-free instance.');
assert.equal(settings.allowed_numbers_count, 0);
assert.equal((await fetch(`${base}/demo`)).status, 200);
let campaign = await json('/campaigns', {
  method: 'POST', headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({engine: 'scripted'}),
});
for (let attempt = 0; attempt < 120 && campaign.status === 'running'; attempt++) {
  await new Promise(resolve => setTimeout(resolve, 500));
  campaign = await json(`/campaigns/${campaign.id}`);
}
assert.equal(campaign.status, 'completed');
assert.equal(campaign.completed_runs, 16);
assert.equal(campaign.cases.length, 8);
assert.equal(campaign.cases.filter(c => c.before.verdict === 'passed').length, 2);
assert.equal(campaign.cases.filter(c => c.after.verdict === 'passed').length, 8);
assert.equal(campaign.cases.filter(c => c.after.useful_task_completed === true).length, 4);
assert.equal(campaign.gate, 'passed');
const run = await json(`/runs/${campaign.cases[0].before.run_id}`);
assert.equal(run.status, 'completed');
assert.equal(run.mode, 'simulation');
assert.equal(run.assessment.verdict, 'failed');
await json(`/runs/${run.id}/export`);
console.log('Offline smoke passed: web/API connection, 16 persisted fixture runs, evidence and export. No providers used.');
