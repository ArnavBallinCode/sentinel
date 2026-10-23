# Review Sentinel in five minutes

**Start:** follow the [README](../README.md) and open `/demo`. No credentials are needed for this walkthrough. All results here are authored synthetic fixtures, not measured model performance or actual phone conversations.

## 1. See the problem and the fix

Choose **Rehearsal · free / offline**, then **Run release check**. The backend executes 16 saved workflow runs: four scenarios, two languages, and baseline/candidate variants.

Expected fixture results:

| Result | Expected | Meaning |
| --- | --- | --- |
| Baseline | 2 / 8 | The authored baseline fails selected behavior checks |
| With guardrails | 8 / 8 | The authored candidate satisfies the suite |
| Helpfulness control | 4 / 4 | Legitimate inquiry/escalation tools actually completed |

These counts make the walkthrough reproducible. A real LLM evaluation can produce different results, including failures or inconclusive coverage.

## 2. Follow a finding to the action

Open the first **Needs review** result. Inspect the caller's request and **BLOCKED IN TEST** tool decision. Sentinel prevented access at its controlled test boundary; the agent's attempt still counts as a behavioral finding.

Choose **Open workflow trace**, then expand a node. Inspect its purpose, actual inputs and outputs, execution trace, and evidence. Move through the other nodes to see how the outcome was produced. The graph executes on the backend; its colors reflect persisted run state.

The workspace supports editing, saving versions, arranging nodes, collapsing navigation and showing only the canvas. Reopening a historical run retains that run's graph and evidence.

## 3. Check usefulness, language and persistence

Return to `/demo`. Open a Hindi candidate result, then a legitimate inquiry or dispute result. Verify the useful action rather than relying only on a passing verdict. A refusal-only candidate fails the usefulness control.

Export the release check, reload the page and reopen the saved result. Each matrix cell links to a separately stored run and its export.

## 4. Inspect a separate transcript audit

In the workflow workspace, open **Recording audits** and upload [recording-transcript.json](../examples/recording-transcript.json). It is a fictional, timestamped conversation in which an agent claims a payment is verified without supporting evidence.

Use it in an audit and inspect findings and coverage. Add a human review and export the result. Unsupported checks remain visible. The JSON sample has no original recording audio, and it is not a Bolna call.

## 5. Explore optional integrations

Stop the offline demo and start the configured workspace with `npm run dev` before using providers. See [configuration](DEPLOYMENT.md).

| Capability | Where to inspect it | Prerequisite / evidence boundary |
| --- | --- | --- |
| Visual execution, conditional branches, saved versions | Workspace; expand nodes and inspect trace | Available offline; backend validates and executes the graph |
| English/Hindi release checks | Demo Studio | Fixtures offline; model usage in prompt-evaluation mode |
| Generated attacks and multi-turn prompt testing | Workspace attack generation and test settings | Groq or OpenAI; synthetic identity and tools |
| Guardrail suggestions and controlled replay | Completed LLM run → harden and retest | Model provider; replay pins baseline prompt and controls |
| Deterministic policies and evidence-citing semantic judge | Policy/evaluator nodes and findings | Semantic checks require a model; invalid coverage is inconclusive |
| PII text redaction and human review | Recording audits, findings and evidence exports | Pattern-based text controls; not comprehensive anonymization or audio redaction |
| Actual Bolna connection, call dispatch and import | Connect Bolna, live call settings, Recordings | Bolna key; calls additionally require an authorized allowlisted recipient |
| Original recording playback | Imported call evidence | Available public/signed HTTPS audio; never substitute TTS for the recording |
| Guardrail deployment and rollback | Reviewed patch and deployment controls | Explicit provider write; stale prompts are rejected; not part of offline tests |
| Audit history and JSON export | Saved runs, reviews and export actions | Records persist locally; imports are retrospective observations |

The four reference applications informed a native implementation. They are not four bundled engines. [Reference audit](REPO_AUDIT.md) explains the relationship; [verification](VERIFICATION.md) distinguishes automated tests from actual external requests.

## Submission materials

- **Repository:** [ArnavBallinCode/sentinel](https://github.com/ArnavBallinCode/sentinel), private. Reviewers need explicit access through the organizer's process.
- **Product film:** [3½-minute shot list](DEMO.md) and [narration](PITCH_NARRATION.txt). The final YouTube recording is submitted separately; no placeholder video is presented as a finished demo.
- **Technical evaluation:** [architecture](ARCHITECTURE.md), [verification record](VERIFICATION.md), and reproducible `npm run verify`.
- **Product discussion:** [who it helps, differentiation and limitations](PITCH_QA.md).

Sentinel is a working single-user local MVP. Hosted multi-tenant production operation, general safety scores and regulatory certification are outside this submission's verified scope.
