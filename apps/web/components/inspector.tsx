"use client";
import * as Tabs from "@radix-ui/react-tabs";
import { Settings2, X, ExternalLink, ShieldCheck, Copy } from "lucide-react";
import { useEditor } from "@/lib/editor";
import { Button } from "./ui/button";
import { icons } from "./workflow-node";
import type { Spec, Run, Finding, Review, Event } from "@/lib/types";
import { describeExecution, nodeGuides } from "@/lib/node-guide";
export function Evidence({
  findings,
  onSeek,
  onReview,
  reviews = [],
}: {
  findings: Finding[];
  onSeek: (s: number) => void;
  onReview?: (f: Finding, status: string) => void;
  reviews?: Review[];
}) {
  return (
    <div className="evidence-list">
      {!findings.length && (
        <div className="empty">
          <ShieldCheck size={25} />
          <p>No findings in this output.</p>
          <small>Only executed assertions contribute results.</small>
        </div>
      )}
      {findings.map((f) => (
        <article className="finding" key={f.id}>
          <div className="finding-top">
            <span className="badge warning">
              {f.outcome.replaceAll("_", " ")}
            </span>
            <span>{f.severity}</span>
          </div>
          <h4>{f.policy_id.replaceAll("_", " ")}</h4>
          <blockquote>{f.quote}</blockquote>
          <p>{f.explanation}</p>
          <div className="finding-actions">
            {f.start != null && (
              <button onClick={() => onSeek(f.start!)}>
                <ExternalLink size={12} />
                {f.start.toFixed(1)}s · evidence
              </button>
            )}
            {onReview && (
              <select
                aria-label="Review finding"
                value={
                  reviews.filter((r) => r.finding_id === f.id).at(-1)?.status ||
                  "unreviewed"
                }
                onChange={(e) => onReview(f, e.target.value)}
              >
                <option value="unreviewed" disabled>
                  Unreviewed
                </option>
                <option value="confirmed">Confirm</option>
                <option value="dismissed">Dismiss</option>
                <option value="needs_review">Needs review</option>
              </select>
            )}
          </div>
        </article>
      ))}
    </div>
  );
}
export function Inspector({
  registry,
  run,
  onSeek,
  onReview,
  reviews,
  events,
  onExpand,
}: {
  registry: Record<string, Spec>;
  run: Run | null;
  onSeek: (s: number) => void;
  onReview: (f: Finding, status: string) => void;
  reviews: Review[];
  events: Event[];
  onExpand: (id: string) => void;
}) {
  const { graph, selected, select, edit } = useEditor();
  const node = graph?.nodes.find((n) => n.id === selected);
  const spec = node ? registry[node.type || ""] : null;
  const record = selected ? run?.nodes[selected] : null;
  const Icon = icons[node?.type || ""] || Settings2;
  if (!node || !spec) return null;
  const cfg = node.data.config || {};
  const update = (key: string, value: unknown) =>
    edit({
      nodes: graph!.nodes.map((n) =>
        n.id === node.id
          ? { ...n, data: { ...n.data, config: { ...cfg, [key]: value } } }
          : n,
      ),
    });
  return (
    <aside className="inspector">
      <div className="panel-title">
        <span>
          <Settings2 size={15} /> Node inspector
        </span>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Close inspector"
          onClick={() => select(null)}
        >
          <X size={15} />
        </Button>
      </div>
      <div className="inspector-heading">
        <span className="node-icon">
          <Icon size={22} />
        </span>
        <div>
          <span className="eyebrow">{spec.category}</span>
          <h3>{spec.label}</h3>
        </div>
      </div>
      <div className="inspector-explainer"><p>{describeExecution(node.type || "", record)}</p><button onClick={() => onExpand(node.id)}>Expand step, data & trace <ExternalLink size={13}/></button></div>
      <Tabs.Root defaultValue="configure" key={node.id}>
        <Tabs.List className="inspector-tabs">
          {["Configure", "Input", "Output", "Logs", "Evidence"].map((t) => (
            <Tabs.Trigger value={t.toLowerCase()} key={t}>
              {t}
            </Tabs.Trigger>
          ))}
        </Tabs.List>
        <Tabs.Content value="configure" className="inspector-content">
          <label className="field">
            Node name
            <input
              value={node.data.label}
              onChange={(e) =>
                edit({
                  nodes: graph!.nodes.map((n) =>
                    n.id === node.id
                      ? { ...n, data: { ...n.data, label: e.target.value } }
                      : n,
                  ),
                })
              }
            />
          </label>
          <p className="description">{spec.description}</p>
          <details className="node-how"><summary>How this step works</summary><ol>{nodeGuides[node.type || ""]?.process.map(s => <li key={s}>{s}</li>)}</ol></details>
          {Object.entries(spec.config_schema).map(([key, f]) => (
            <label
              className={`field ${f.type === "boolean" ? "toggle-field" : ""}`}
              key={key}
            >
              <span>{f.description}</span>
              {f.type === "boolean" ? (
                <input
                  type="checkbox"
                  role="switch"
                  checked={Boolean(cfg[key] ?? f.default)}
                  onChange={(e) => update(key, e.target.checked)}
                />
              ) : f.multiline ? (
                <textarea
                  rows={5}
                  value={String(cfg[key] ?? f.default)}
                  placeholder={key === "agent_prompt" ? "Empty: use the selected Bolna agent's prompt (or the demo agent)" : "Generated by Harden agent & retest"}
                  onChange={(e) => update(key, e.target.value)}
                />
              ) : f.enum ? (
                <select
                  value={String(cfg[key] ?? f.default)}
                  onChange={(e) => update(key, e.target.value)}
                >
                  {f.enum.map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              ) : (
                <input
                  type={f.type === "number" ? "number" : "text"}
                  min={f.minimum}
                  max={f.maximum}
                  value={String(cfg[key] ?? f.default)}
                  onChange={(e) =>
                    update(
                      key,
                      f.type === "number"
                        ? Number(e.target.value)
                        : e.target.value,
                    )
                  }
                />
              )}
            </label>
          ))}
          {!Object.keys(spec.config_schema).length && (
            <div className="tip">
              This node uses the incoming execution context. No additional
              configuration is required.
            </div>
          )}
          <div className="section-label">EXECUTION MODES</div>
          <div className="mode-list">
            {spec.modes.map((m) => (
              <span className="badge" key={m}>
                {m}
              </span>
            ))}
          </div>
          {node.type === "tool_auth" && (
            <div className="tip">
              <ShieldCheck size={16} />
              <p>
                Preventive enforcement only applies to requests sent through
                Sentinel-owned tool endpoints. Hosted utterances are not
                intercepted.
              </p>
            </div>
          )}
          {node.type === "policy" && (
            <div className="tip">
              Post-call detection. Disabled assertions are marked not evaluated,
              never passed.
            </div>
          )}
          <div className="section-label">DATA CONTRACT</div>
          <div className="contract">
            {spec.input_schema.type}
            <span>→</span>
            {spec.output_schema.type}
          </div>
        </Tabs.Content>
        {["input", "output", "logs"].map((tab) => (
          <Tabs.Content value={tab} key={tab} className="inspector-content">
            <div className="data-title">
              {run
                ? `Run ${run.id.slice(0, 8)} · v${run.version}`
                : "No run selected"}
            </div>
            {record ? (
              <pre>
                {JSON.stringify(
                  tab === "logs"
                    ? {
                        status: record.status,
                        duration_ms: record.duration_ms,
                        attempts: record.attempts,
                        error: record.error,
                        reason: record.reason,
                        provider_execution_id: record.provider_execution_id,
                        events: events.filter(e => e.node_id === node.id),
                      }
                    : record[tab as "input" | "output"] || {},
                  null,
                  2,
                )}
              </pre>
            ) : (
              <div className="empty">
                Run this workflow to inspect real execution data.
              </div>
            )}
          </Tabs.Content>
        ))}
        <Tabs.Content value="evidence" className="inspector-content">
          <Evidence
            findings={record?.output?.findings || []}
            onSeek={onSeek}
            onReview={onReview}
            reviews={reviews}
          />
        </Tabs.Content>
      </Tabs.Root>
      <div className="inspector-footer">
        {record ? (
          <>
            <span className={`dot ${record.status}`} />
            {record.status} · {record.duration_ms ?? "—"} ms
          </>
        ) : (
          <>
            Node ID <code>{node.id.slice(0, 12)}</code>
          </>
        )}
      </div>
    </aside>
  );
}
