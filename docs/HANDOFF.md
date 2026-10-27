# Handoff — Render preparation, 27 October 2026

## Deployment status

The user authorized a small paid Render setup using $50 in credits. `render.yaml` defines a public Node web service, a private Python API and a 1 GB evidence disk in Singapore (about $14.25/month base cost). The web proxy adds shared HTTP Basic authentication and injects the private API token only after authentication. Missing credentials fail closed. This is a trusted shared workspace, not user/tenant isolation. Local offline mode remains credential-free.

The account is authenticated, but Render Blueprint validation returned `need_payment_info`; no services have been created. The user has been asked to resolve the workspace billing requirement. Once resolved, validate again, provision exactly these resources, set exact allowed origins, verify synthetic runs and persistence, then configure providers privately. Read `docs/RENDER.md`. Do not copy local call evidence into the hosted database. Automatic deploys start disabled for recording stability.

The user also asked about `voxbento.com/sentinel`. Voxbento was inspected read-only: a temporary Caddy redirect is a minimal change, while fully mounting Sentinel under that path needs base-path integration. Recommendation: independent Sentinel hosting with an optional temporary redirect. No Voxbento change or domain/DNS mutation has been made.

## What changed

The app now has a dedicated `/demo` studio with a release matrix, persisted history, evidence viewer and direct workflow-trace links. A provider-free rehearsal runs eight English/Hindi cases across baseline and hardened fixtures (16 real backend executions). A separate LLM mode uses a captured prompt with synthetic tools and the exact candidate patch. Legitimate account inquiries and dispute escalations must actually invoke the appropriate authorized tools; refusing everything fails.

Verdicts come from `results.metrics`. Insufficient/invalid evaluation is inconclusive. Imported tool logs remain observations and cannot generate synthetic claims of real prevention. Controlled replay preserves baseline inputs and private prompt context, checks model settings, and allows only the guardrail treatment to change. Comparison rejects different agents, recordings and uncontrolled configuration changes.

The recording downloader never attaches the Bolna API key to external URLs. It rejects non-public/non-HTTPS destinations and redirects, bounds the download, and supports an optional exact hostname allowlist. Only signed/public recording URLs are supported. Hosted prompt changes use an expected prompt hash, a bounded managed section, a backup and guarded rollback.

## Important boundaries

This is a single-user local product. Shared production deployment still requires proper authenticated tenant isolation. No autonomous audio attacker is connected. The bilingual campaign is curated, not a held-out benchmark. Its successful fixture score demonstrates software behavior, not a provider/model safety score. Names, addresses and spoken PII are not comprehensively detected; recordings are not redacted. Audio times may be estimated. LLM judgments remain reviewable evidence, not guaranteed correctness.

Model roles default to Groq GPT-OSS 20B target, Qwen 3.8 27B attacker and GPT-OSS 120B judge. Provider/model availability was checked against the authenticated model-list endpoint on 23 October. Environment overrides are documented in `.env.example`. Keep rate limits visible; a prompt evaluation can involve many requests.

## Demo and repository

Use `docs/REVIEWER_GUIDE.md` for the submission walkthrough, `docs/DEMO.md` for the 3:30 launch-film narration and shot list, and `docs/PITCH_QA.md` for product positioning. `npm run demo` starts both services without provider access and uses `artifacts/reviewer-data/`; `npm run dev` starts the configured workspace. `npm run verify` tests an isolated production build. CI also builds and smoke-tests the containers. Node 22 and Python 3.13 are pinned for reproducibility. `scripts/capture-demo.mjs` captures synthetic-only product footage when the isolated demo server is running; see its usage header.

No supplied key, user phone number, customer recording, local database or private prompt snapshot belongs in the repository. Screenshots/footage committed for submission must use isolated synthetic state. New work by Claude or another tool should start from this committed baseline and preserve the mode/coverage labels.

## Highest-value work after this pass

1. Demonstrate a completed opted-in hosted call and capture an actual Sentinel-owned tool receipt if the hosted agent is configured to use that endpoint.
2. Record original audio only when available and appropriate; otherwise show the provider transcript without pretending it has original audio.
3. Add held-out attacks and repeated model runs before claiming statistical improvement.
4. Add true speech alignment/coverage recovery before claiming precise audio evidence or speech-quality scores.
5. Improve contextual and spoken PII detection with labeled examples; audio redaction is separate work.

Keep this document and verification notes updated when these boundaries change.

## Local filming assets

The ignored `artifacts/demo/sentinel-product-broll.mp4` is a 1920×1080 silent capture of the synthetic-only rehearsal, evidence viewer and workflow trace. It is editable B-roll, not a finished narrated submission. Regenerate it with the capture script against an isolated server. `artifacts/model-smoke/` retains the synthetic-input real-Groq smoke-test database and summary locally for a separate evidence shot; these artifacts are intentionally not pushed.
