# Implementation status and remaining scope

## Delivered locally

1. Original Next.js editor, schema registry, graph validation and immutable version persistence.
2. FastAPI/SQLAlchemy graph execution, durable SSE replay, node inspection, branch skipping, bounded safe retries, timeouts and local cancellation.
3. Four deterministic transcript simulations, controlled synthetic tool authorization, grounded findings, human review and regression comparison.
4. Three starter templates. The voice template uses manual launch, not an incoming-call trigger. The recording template uses imported or separately transcribed artifacts.
5. Hosted Bolna adapter and waiting/polling/gateway callback lifecycle. OpenAI transcription and cited semantic evaluator paths.
6. Unit/integration/API end-to-end tests, browser walkthrough, production frontend build, setup scripts, Dockerfiles and documentation.

## Required live verification (blocked by credentials / opted-in endpoint)

- Bolna agent retrieval with a real account; actual allowlisted call creation; provider completion, transcript shape and cost field validation.
- End-to-end signed callback gateway deployment. No native Bolna signature is assumed.
- OpenAI semantic evaluation and transcription on authorized recordings. Audio quality, Hindi accuracy and timestamps need human review.
- Hosted recorded audio ingestion and playback with actual artifacts. Current playback is implemented for uploaded/transcribed audio only.

## Not implemented

- Autonomous real audio-in/audio-out adversarial caller, interruption testing or self-hosted Bolna transport.
- Live response interception, incoming-call triggers, scheduler, generic webhooks as workflow triggers, external HTTP/database/notification nodes, STT/TTS canvas nodes and scenario-generation LLM.
- Pause/resume of local work, arbitrary node retry UI, distributed worker leasing and automatic uncertain-call recovery. Local runs can be cancelled and rerun; safe retries are a bounded node policy.
- Acoustic coverage verification, retranscription of missing speech, speaker diarization, Hindi agent responses, Kannada/Hinglish validation, full PII coverage or compliance certification.
- Multiple projects, user identity, multi-tenant authorization, encrypted secret/recording storage and automatic retention scheduler.
- Production deployment. Docker image builds and isolated container startup were verified.

Unsupported nodes are omitted from the library. The current app is a functioning offline MVP plus unverified provider paths, not fulfillment of every final live-integration acceptance criterion.

## Next milestones

Verify one opted-in hosted call, store exact provider artifacts, add a supported audio participant transport, bind trusted call identities to tool endpoints, then implement shared-deployment identity and worker coordination. Broaden policies only with labeled evaluation cases and explicit unsupported outcomes.
