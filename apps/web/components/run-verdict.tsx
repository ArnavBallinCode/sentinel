"use client";
import { appPath } from "@/lib/paths";
import { useEffect, useRef, useState } from "react";
import {
  ShieldAlert,
  ShieldCheck,
  ShieldX,
  LoaderCircle,
  Play,
  Square,
  Wrench,
  Download,
  ArrowRight,
  Volume2,
  Wrench as ToolIcon,
  Upload,
} from "lucide-react";
import type { Run, Output, Finding, Segment } from "@/lib/types";

export type Comparison = {
  before: { passed: boolean; findings: Finding[]; duration_ms: number; unsupported: string[] };
  after: { passed: boolean; findings: Finding[]; duration_ms: number; unsupported: string[] };
  resolved: string[];
  new: string[];
  changed_nodes: string[];
  same_scenario: boolean;
  comparable: boolean;
  comparison_reasons?: string[];
};

export type HardenInfo = { patch: string; changes: string[]; agent_id?: string; expected_prompt_hash?: string; run_id?: string };

type ToolRequest = {
  tool: string;
  account_id?: string;
  provider_trace?: boolean;
  segment_id?: string;
  decision?: { allowed: boolean; outcome: string; reason: string };
};

/** Everything the results views need, derived once from the immutable run record. */
export function summarize(run: Run) {
  const outputs = Object.values(run.nodes)
    .map((n) => n.output)
    .filter(Boolean) as Output[];
  const transcript: Segment[] = outputs.findLast((o) => o.transcript)?.transcript || [];
  const findings = Array.from(
    new Map(outputs.flatMap((o) => o.findings || []).map((f) => [f.id, f])).values(),
  );
  const tools =
    (outputs.findLast((o) => Array.isArray(o.tool_requests) && (o.tool_requests as ToolRequest[]).some((t) => t.decision))
      ?.tool_requests as ToolRequest[] | undefined) ||
    (outputs.findLast((o) => Array.isArray(o.tool_requests))?.tool_requests as ToolRequest[] | undefined) ||
    [];
  const blocked = tools.filter((t) => !t.provider_trace && t.decision && !t.decision.allowed);
  const evaluated = (outputs.findLast((o) => Array.isArray(o.evaluated))?.evaluated as string[] | undefined) || [];
  const unsupported = [...new Set(outputs.flatMap((o) => o.unsupported || []))];
  const coverage = [...new Set(outputs.flatMap((o) => o.coverage || []))];
  const audio = outputs.findLast((o) => o.audio)?.audio;
  const scenario = outputs.find((o) => o.scenario_definition)?.scenario_definition as
    | { name: string; goal: string }
    | undefined;
  const language = (outputs.find((o) => o.language)?.language as string | undefined) || "en";
  const behavior = outputs.find((o) => o.agent_behavior)?.agent_behavior as string | undefined;
  const judge = outputs.findLast((o) => o.judge)?.judge as { attack_succeeded: boolean; summary: string; status?: string } | undefined;
  const engine = outputs.findLast((o) => o.engine)?.engine as string | undefined;
  const agentSource = outputs.findLast((o) => o.agent_source)?.agent_source as string | undefined;
  const records = Object.values(run.nodes);
  const done = records.filter((n) => !["running", "waiting", "pending"].includes(n.status)).length;
  const total = run.graph.nodes.length;
  const duration = records.reduce((sum, n) => sum + (n.duration_ms || 0), 0);
  const errors = Object.entries(run.nodes).filter(([, n]) => n.error);
  return { transcript, findings, tools, blocked, evaluated, unsupported, coverage, audio, scenario, language, behavior, judge, engine, agentSource, done, total, duration, errors };
}

const terminal = ["completed", "failed", "cancelled", "interrupted"];

export function RunVerdict({
  run,
  comparison,
  canFix,
  onFix,
  hardenInfo,
  onPush,
  onShowConversation,
  onShowFindings,
}: {
  run: Run;
  comparison: Comparison | null;
  canFix: boolean;
  onFix: () => void;
  hardenInfo: HardenInfo | null;
  onPush?: () => void;
  onShowConversation: () => void;
  onShowFindings: () => void;
}) {
  const s = summarize(run);
  const finished = terminal.includes(run.status);
  let tone: "running" | "danger" | "warning" | "success" | "neutral" = "neutral";
  let Icon = ShieldCheck;
  let title = "";
  let detail = "";
  if (!finished) {
    tone = "running";
    Icon = LoaderCircle;
    title = run.status === "waiting" ? "Waiting for the Bolna call to finish…" : run.mode !== "simulation" ? "Auditing the call…" : s.transcript.length ? `Attacker and agent are talking · turn ${Math.ceil(s.transcript.length / 2)}` : "Running the attack…";
    detail = `Step ${Math.min(s.done + 1, s.total)} of ${s.total}${s.scenario ? ` · ${s.scenario.name}` : ""}`;
  } else if (run.status !== "completed") {
    tone = "warning";
    Icon = ShieldAlert;
    title = `Run ${run.status}`;
    detail = s.errors[0]?.[1].error || "The engine stopped before every step finished.";
  } else if (s.judge?.attack_succeeded && s.findings.some((f) => f.evaluator?.includes("llm-judge"))) {
    tone = "danger";
    Icon = ShieldX;
    const f = s.findings.find((x) => x.evaluator?.includes("llm-judge"))!;
    title = `Attack succeeded — ${f.policy_id.replaceAll("_", " ")}`;
    detail = s.judge.summary || f.explanation;
  } else if (s.blocked.length) {
    tone = "danger";
    Icon = ShieldX;
    const target = s.blocked[0];
    title = "Unauthorized tool request blocked in test";
    detail = `The agent requested ${target.tool}(${target.account_id || ""}). The synthetic tool boundary denied access: “${target.decision?.reason}” No real customer account was accessed.`;
  } else if (s.findings.length) {
    tone = "warning";
    Icon = ShieldAlert;
    title = `${s.findings.length} issue${s.findings.length > 1 ? "s" : ""} need review`;
    detail = s.findings[0].explanation;
  } else if (run.assessment?.verdict === "inconclusive" || !s.evaluated.length || s.unsupported.length || s.judge?.status === "inconclusive") {
    tone = "warning";
    Icon = ShieldAlert;
    title = "Inconclusive — coverage is incomplete";
    detail = s.unsupported[0] || "No validated policy result is available. Inspect coverage before making a release decision.";
  } else {
    tone = "success";
    Icon = ShieldCheck;
    title = s.scenario && (s.behavior === "refusal" || s.engine === "llm") ? "Agent held the line" : "No issues in evaluated checks";
    detail = s.judge?.summary || (s.scenario
      ? `${s.scenario.name}: the agent ${s.tools.length ? "made only authorized tool calls" : "refused without calling a protected tool"}.`
      : "Every executed check passed. Review coverage notes before drawing conclusions.");
  }
  return (
    <div className="verdict">
      <div className={`verdict-hero tone-${tone}`}>
        <span className="verdict-icon">
          <Icon size={26} className={tone === "running" ? "spin" : ""} />
        </span>
        <div className="verdict-copy">
          <span className="verdict-eyebrow">
            {run.mode === "simulation" ? (s.engine === "llm" ? "LLM prompt test · no phone call" : "Scripted attack") : run.mode === "audit" ? "Call audit" : "Live Bolna call"}
            {s.agentSource ? ` · ${s.agentSource}` : ""}
            {s.scenario ? ` · ${s.scenario.name}` : ""} · v{run.version}
          </span>
          <h3>{title}</h3>
          <p>{detail}</p>
          {!finished && (
            <div className="verdict-progress">
              <span style={{ width: `${Math.round((s.done / Math.max(1, s.total)) * 100)}%` }} />
            </div>
          )}
          {finished && (
            <div className="verdict-actions">
              {canFix && tone === "danger" && (
                <button className="verdict-primary" onClick={onFix}>
                  <Wrench size={15} /> Harden agent & retest
                </button>
              )}
              {s.transcript.length > 0 && (
                <button onClick={onShowConversation}>
                  <Volume2 size={15} /> {s.audio ? "Play original recording" : "Inspect conversation"}
                </button>
              )}
              <a href={appPath(`/api/runs/${run.id}/export`)} target="_blank" rel="noreferrer">
                <Download size={15} /> Evidence JSON
              </a>
            </div>
          )}
        </div>
      </div>
      <div className="verdict-side">
        {comparison ? (
          <BeforeAfter comparison={comparison} hardenInfo={hardenInfo} onPush={onPush} />
        ) : (
          <div className="verdict-stats">
            <button onClick={onShowFindings}>
              <strong className={s.findings.length ? "bad" : "good"}>{s.findings.length}</strong>
              <span>Findings</span>
            </button>
            <div>
              <strong className={s.blocked.length ? "bad" : ""}>{s.blocked.length}</strong>
              <span>Tool calls blocked</span>
            </div>
            <div>
              <strong>{s.evaluated.length}</strong>
              <span>Policies checked</span>
            </div>
            <div>
              <strong>{s.duration}<small>ms</small></strong>
              <span>Engine time</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function BeforeAfter({ comparison, hardenInfo, onPush }: { comparison: Comparison; hardenInfo: HardenInfo | null; onPush?: () => void }) {
  const b = comparison.before.findings.length,
    a = comparison.after.findings.length;
  return (
    <div className="before-after">
      <span className="verdict-eyebrow">{comparison.comparable ? "Controlled replay · guardrail treatment changed" : "Comparison · controls differ"}</span>
      <div className="ba-row">
        <div className="ba-card bad">
          <small>Before</small>
          <strong>{b}</strong>
          <span>finding{b === 1 ? "" : "s"}</span>
        </div>
        <ArrowRight size={20} />
        <div className={`ba-card ${comparison.after.passed ? "good" : "bad"}`}>
          <small>After fix</small>
          <strong>{a}</strong>
          <span>finding{a === 1 ? "" : "s"}</span>
        </div>
      </div>
      <p>
        {comparison.resolved.length ? (
          <>
            <ShieldCheck size={13} /> Resolved: {comparison.resolved.map((r) => r.replace(/-s\d+$/, "").replaceAll("_", " ")).join(", ")}
          </>
        ) : (
          "No findings resolved"
        )}
        {comparison.new.length ? ` · ${comparison.new.length} new` : ""}
        {!comparison.comparable && " · not a controlled comparison"}
        {!comparison.after.passed && !a && " · insufficient coverage or execution error"}
      </p>
      {!!comparison.comparison_reasons?.length && <p>{comparison.comparison_reasons.join(" ")}</p>}
      {hardenInfo && hardenInfo.changes.length > 0 && (
        <details className="patch-changes">
          <summary>What Sentinel added to the prompt ({hardenInfo.changes.length} rules)</summary>
          <ul>{hardenInfo.changes.map((c) => <li key={c}>{c}</li>)}</ul>
          <pre>{hardenInfo.patch}</pre>
        </details>
      )}
      {onPush && comparison.comparable && comparison.after.passed && (
        <button className="push-bolna" onClick={onPush}>
          <Upload size={13} /> Push guardrails to Bolna agent
        </button>
      )}
    </div>
  );
}

/** Chat-style transcript with findings and tool decisions pinned to the segment that caused them. */
export function Conversation({ run, seek }: { run: Run; seek: number | null }) {
  const s = summarize(run);
  const [speaking, setSpeaking] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const audio = useRef<HTMLAudioElement>(null);
  const cancelled = useRef(false);
  useEffect(() => () => { cancelled.current = true; window.speechSynthesis?.cancel(); }, []);
  useEffect(() => { window.speechSynthesis?.cancel(); setPlaying(false); setSpeaking(null); }, [run.id]);
  useEffect(() => {
    if (seek !== null && audio.current) {
      audio.current.currentTime = seek;
      void audio.current.play().catch(() => {});
    }
  }, [seek]);
  const stop = () => {
    cancelled.current = true;
    window.speechSynthesis?.cancel();
    audio.current?.pause();
    setPlaying(false);
    setSpeaking(null);
  };
  const play = () => {
    if (s.audio && audio.current) {
      void audio.current.play();
      return;
    }
    const synth = window.speechSynthesis;
    if (!synth) return;
    stop();
    cancelled.current = false;
    setPlaying(true);
    const lang = s.language === "hi" ? "hi" : "en";
    const voices = synth.getVoices().filter((v) => v.lang.toLowerCase().startsWith(lang));
    const pick = (i: number) => voices.find((v) => /in/i.test(v.lang) && voices.indexOf(v) % 2 === i) || voices[i % Math.max(1, voices.length)];
    const queue = [...s.transcript];
    const next = () => {
      const seg = queue.shift();
      if (!seg || cancelled.current) { setPlaying(false); setSpeaking(null); return; }
      const u = new SpeechSynthesisUtterance(seg.text);
      const caller = seg.speaker === "caller" || seg.speaker === "user";
      const voice = pick(caller ? 0 : 1);
      if (voice) u.voice = voice;
      u.lang = voice?.lang || (lang === "hi" ? "hi-IN" : "en-IN");
      u.pitch = caller ? 0.85 : 1.1;
      u.rate = 1.02;
      u.onstart = () => setSpeaking(seg.id);
      u.onend = () => setTimeout(next, 280);
      u.onerror = () => { setPlaying(false); setSpeaking(null); };
      synth.speak(u);
    };
    next();
  };
  const active = (seg: Segment) =>
    speaking === seg.id || (seek !== null && seg.start !== null && seg.start <= seek && (seg.end || 0) >= seek);
  return (
    <div className="conversation">
      <div className="conversation-bar">
        <button className={`play-call ${playing ? "is-playing" : ""}`} onClick={playing ? stop : play} disabled={!s.transcript.length}>
          {playing ? <Square size={13} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
          {playing ? (s.audio ? "Pause" : "Stop") : s.audio ? "Play original recording" : "Read transcript aloud"}
        </button>
        <span className="conversation-meta">
          {s.audio
            ? `Original recording · ${s.transcript.some(t => t.timestamp_quality === "estimated") ? "estimated timing" : "inspect timestamp quality"} · audio is not redacted`
            : run.mode === "simulation"
              ? "Synthesized voices read the simulated transcript"
              : "Text-to-speech replay of the provider transcript"}
          {" · "}
          {s.transcript.length} turns
        </span>
        {playing && <span className="eq" aria-hidden><i /><i /><i /><i /></span>}
      </div>
      {s.audio && (
        <audio
          ref={audio}
          controls
          src={appPath(s.audio)}
          className="console-audio"
          onPlay={() => setPlaying(true)}
          onPause={() => { setPlaying(false); setSpeaking(null); }}
          onTimeUpdate={(e) => {
            const t = e.currentTarget.currentTime;
            setSpeaking(s.transcript.find((x) => x.start !== null && x.end !== null && x.start <= t && t < x.end)?.id || null);
          }}
        />
      )}
      {!s.transcript.length ? (
        <div className="empty">No transcript available for this execution.</div>
      ) : (
        <div className="chat">
          {s.transcript.map((seg) => {
            const caller = seg.speaker === "caller" || seg.speaker === "user";
            const flagged = s.findings.filter((f) => f.segment_id === seg.id);
            // Tool requests are recorded against the triggering caller turn; show them on the agent reply that made them.
            const owner = (id?: string) => {
              const at = s.transcript.findIndex((x) => x.id === id);
              const src = s.transcript[at];
              const isCaller = src && (src.speaker === "caller" || src.speaker === "user");
              return isCaller && s.transcript[at + 1] ? s.transcript[at + 1].id : id;
            };
            const calls = s.tools.filter((t) => owner(t.segment_id) === seg.id);
            return (
              <div key={seg.id} className={`chat-turn ${caller ? "from-caller" : "from-agent"}`}>
                <div className={`bubble ${flagged.length ? "flagged" : ""} ${active(seg) ? "speaking" : ""}`}>
                  <span className="bubble-who">
                    {caller ? "Caller" : "Agent"}
                    {seg.start !== null && <em>{seg.timestamp_quality === "estimated" ? "≈ " : ""}{seg.start.toFixed(1)}s · {seg.timestamp_quality}</em>}
                  </span>
                  <p>{seg.text}</p>
                </div>
                {calls.map((t, i) => (
                  <div key={i} className={`tool-call ${t.decision ? (t.decision.allowed ? "allowed" : "denied") : ""}`}>
                    <ToolIcon size={12} />
                    <code>
                      {t.tool}({t.account_id || ""})
                    </code>
                    <b>{t.provider_trace ? "PROVIDER LOG" : t.decision ? (t.decision.allowed ? "ALLOWED IN TEST" : "BLOCKED IN TEST") : "REQUESTED"}</b>
                    {t.decision && !t.decision.allowed && <span>{t.decision.reason}</span>}
                  </div>
                ))}
                {flagged.map((f) => (
                  <div key={f.id} className="flag-note">
                    <ShieldAlert size={12} /> <strong>{f.policy_id.replaceAll("_", " ")}</strong> · {f.severity} — {f.explanation}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
