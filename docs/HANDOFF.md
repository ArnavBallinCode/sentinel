# Handoff — demo preparation, 23 October 2026

## What changed

The app now has a dedicated `/demo` studio with a release matrix, persisted history, evidence viewer and direct workflow-trace links. A provider-free rehearsal runs eight English/Hindi cases across baseline and hardened fixtures (16 real backend executions). A separate LLM mode uses a captured prompt with synthetic tools and the exact candidate patch. Legitimate account inquiries and dispute escalations must actually invoke the appropriate authorized tools; refusing everything fails.

Verdicts come from `results.metrics`. Insufficient/invalid evaluation is inconclusive. Imported tool logs remain observations and cannot generate synthetic claims of real prevention. Controlled replay preserves baseline inputs and private prompt context, checks model settings, and allows only the guardrail treatment to change. Comparison rejects different agents, recordings and uncontrolled configuration changes.

The recording downloader never attaches the Bolna API key to external URLs. It rejects non-public/non-HTTPS destinations and redirects, bounds the download, and supports an optional exact hostname allowlist. Only signed/public recording URLs are supported. Hosted prompt changes use an expected prompt hash, a bounded managed section, a backup and guarded rollback.

## Important boundaries

This is a single-user local product. Shared production deployment still requires proper authenticated tenant isolation. No autonomous audio attacker is connected. The bilingual campaign is curated, not a held-out benchmark. Its successful fixture score demonstrates software behavior, not a provider/model safety score. Names, addresses and spoken PII are not comprehensively detected; recordings are not redacted. Audio times may be estimated. LLM judgments remain reviewable evidence, not guaranteed correctness.

Model roles default to Groq GPT-OSS 20B target, Qwen 3.8 27B attacker and GPT-OSS 120B judge. Provider/model availability was checked against the authenticated model-list endpoint on 23 October. Environment overrides are documented in `.env.example`. Keep rate limits visible; a prompt evaluation can involve many requests.

## Demo and repository

Use `docs/DEMO.md` for the 3:30 launch-film narration and shot list. `docs/PITCH_QA.md` explains product positioning and answers likely questions. `scripts/verify.sh` reproduces local verification without credentials. `scripts/capture-demo.mjs` captures synthetic-only product footage when the isolated demo server is running; see its usage header.

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
