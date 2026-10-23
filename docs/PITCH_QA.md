# Pitch positioning and questions

## Who would use this?

An engineer or QA owner shipping a Bolna customer-support or lending agent, and an operations reviewer investigating a questionable call. The initial workflow is intentionally specific: account access, disputes and contact handling. The product can be extended to other policies and providers; those extensions should be demonstrated before being claimed.

## Why would they return?

Before a prompt or tool change: run the same scenarios and review differences. After a call complaint: import the execution, inspect its evidence, and record the review. Before publishing guardrails: inspect the patch and preserve a rollback. These are repeatable operational tasks, not just a one-time attack demonstration.

## What is different from making a few test calls?

The product links scenarios, tool decisions, policies, workflow versions, findings and replay evidence. Legitimate-task checks help expose a fix that makes the agent unhelpful. Explain this with one visible example rather than claiming no competing product exists.

## Is it really testing Bolna?

The hosted integration can dispatch authorized calls and ingest actual execution artifacts. The LLM attacker separately tests a captured prompt on the configured model with synthetic tools. These evidence levels are labeled and do not represent the same test.

## Does it prevent leaks?

Sentinel decides authorization at its controlled tool boundary. Imported call evidence is analyzed afterward. Prevention on a hosted call requires that the actual tool request reach a correctly configured Sentinel-owned endpoint with trusted session identity. A prompt patch is useful defense-in-depth, not a permission boundary.

## Is the judge always right?

No. Findings cite actual agent turns and require schema/citation validation, but the interpretation can still be wrong. Invalid or contradictory results become inconclusive; human review remains part of the workflow. Report a labeled evaluation before making precision/recall claims.

## How does this help Indian users?

The sample domain and identifiers match a concrete Indian finance-support scenario. The release check includes English and Hindi; generated prompt attacks support Hinglish. Coverage is limited to the implemented scenarios. Kannada, dialect robustness, spoken-number PII and full multilingual speech quality need separate validation.

## Is it ready for a bank's production deployment?

It is a working single-user MVP. Public multi-user deployment needs authentication, tenant isolation, stronger privacy controls, reliable provider event handling at scale and operational monitoring. The demo should show useful current behavior and name the deployment boundary plainly.

## Is the safety score statistical proof?

No. Each cell reports a recorded test outcome. Eight curated cases do not establish a general failure rate. Future evaluation should include held-out scenarios, repeated runs, real voice conditions and labeled reviewer judgments.

## Business hypothesis

Start with voice-agent agencies and support/lending teams already changing prompts and reviewing calls. Validate whether they will pay for release checks, saved evidence and review time saved. Do not claim customers, revenue, adoption or measured savings without actual evidence.
