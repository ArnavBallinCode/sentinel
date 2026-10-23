# Contributing to Sentinel

Read [AGENTS.md](AGENTS.md) and [the current handoff](docs/HANDOFF.md) before editing. `CLAUDE.md` points to the same instructions. Preserve existing changes and keep fixture, model and provider evidence distinguishable.

## Local development

Use Node.js 22 (`.nvmrc`), uv and the pinned Python 3.13 environment. Both dependency lockfiles are committed.

```bash
npm ci
uv sync --directory services/api --frozen
npm run demo
```

For your configured workspace, stop the demo, create `.env` from `.env.example` if it does not already exist, and run `npm run dev`. The [deployment guide](docs/DEPLOYMENT.md) describes ports, state and troubleshooting. `npm run dev:web` starts only the frontend for developers managing the API separately.

## Verification before pushing

```bash
npx playwright install chromium
npm run verify
```

This runs backend behavioral checks, typechecking, the production build and browser acceptance tests with temporary data and no provider credentials. GitHub Actions also builds both containers and exercises their offline release check. Do not run automated tests against a working database.

Add behavioral coverage for changes to authorization, evidence, replay, verdicts, privacy or external side effects. Update [VERIFICATION.md](docs/VERIFICATION.md) when the tested scope changes. Keep provider tests separate and record exactly which external operations they perform; a successful mock is not a live integration result.

## Keep the repository reviewable

- Include only source, tests, synthetic examples and documentation. Keep keys, `.env`, databases, raw provider payloads, recordings and private prompt snapshots out of Git and logs.
- Keep dependency notices intact. Reference provenance is documented in [REPO_AUDIT.md](docs/REPO_AUDIT.md).
- Read `apps/web/AGENTS.md` and the installed Next.js documentation before frontend work.
- Explain the user-visible problem, resulting behavior, verification and any remaining limitation in a change description.
- Do not place calls or modify hosted prompts as a side effect of setup, tests or recording a UI walkthrough.
