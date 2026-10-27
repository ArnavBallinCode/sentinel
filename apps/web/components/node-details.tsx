"use client";
import { appPath } from "@/lib/paths";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Clock, Download, X } from "lucide-react";
import { nodeGuides, describeExecution } from "@/lib/node-guide";
import { executionOrder } from "@/lib/editor";
import type { Graph, Run, Spec, Event, Output, Finding, Review } from "@/lib/types";
import { Evidence } from "./inspector";

function Payload({ value }: { value?: Output }) {
  if (!value) return <div className="detail-empty">No payload was recorded for this step. Skipped and waiting steps may not have an output.</div>;
  const fields = Object.entries(value).filter(([key]) => key !== "transcript" && key !== "findings");
  return <div className="payload-view">
    {value.transcript && <section><h3>Conversation segments <span>{value.transcript.length}</span></h3>{value.transcript.map(s => <article className="detail-segment" key={s.id}><div><strong>{s.speaker}</strong><span>{s.start == null ? "Timestamp unavailable" : `${s.start.toFixed(1)}s – ${s.end?.toFixed(1) ?? "?"}s`} · {s.timestamp_quality}</span></div><p>{s.text}</p><small>Segment {s.id}</small></article>)}</section>}
    {value.findings && <section><h3>Findings in this payload <span>{value.findings.length}</span></h3><Evidence findings={value.findings} onSeek={() => {}}/></section>}
    <section className="payload-fields">{fields.map(([key, val]) => <details key={key} open={typeof val !== "object"}><summary>{key.replaceAll("_", " ")}<span>{Array.isArray(val) ? `${val.length} items` : val !== null && typeof val === "object" ? `${Object.keys(val).length} fields` : "value"}</span></summary><pre>{typeof val === "string" ? val : JSON.stringify(val, null, 2)}</pre></details>)}</section>
    {!Object.keys(value).length && <p className="detail-empty">Empty starting context. This trigger creates the initial output.</p>}
    <details className="raw-payload"><summary>Complete payload · JSON</summary><pre>{JSON.stringify(value, null, 2)}</pre></details>
  </div>;
}

export function NodeDetails({ nodeId, graph, run, registry, events, reviews, onSelect, onClose, onReview, onSeek }: {
  nodeId: string; graph: Graph; run: Run | null; registry: Record<string, Spec>; events: Event[]; reviews: Review[];
  onSelect: (id: string) => void; onClose: () => void; onReview: (f: Finding, status: string) => void; onSeek: (time: number) => void;
}) {
  const [tab, setTab] = useState("Overview");
  const dialog = useRef<HTMLElement>(null);
  // Always use the immutable run snapshot when explaining an execution.
  const evidenceGraph = run?.graph || graph;
  const node = evidenceGraph.nodes.find(n => n.id === nodeId) || graph.nodes.find(n => n.id === nodeId)!;
  const spec = registry[node.type || ""];
  const guide = nodeGuides[node.type || ""];
  const record = run?.nodes[nodeId];
  const trace = events.filter(e => e.node_id === nodeId);
  const order = executionOrder(evidenceGraph), index = order.indexOf(nodeId);
  const incoming = evidenceGraph.edges.filter(e => e.target === nodeId), outgoing = evidenceGraph.edges.filter(e => e.source === nodeId);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.stopPropagation(); onClose(); }
      if (e.key === "Tab") {
        const controls = Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],select,input,summary') || []);
        const first = controls[0], last = controls.at(-1);
        if (e.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) { e.preventDefault(); last?.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("keydown", key); previous?.focus(); };
  }, [onClose]);
  return <div className="node-detail-backdrop" onClick={onClose}><section ref={dialog} tabIndex={-1} className="node-detail-dialog" role="dialog" aria-modal="true" aria-label="Expanded node details" onClick={e => e.stopPropagation()}>
    <header><div><span className="intro-tag">STEP {String(index + 1).padStart(2, "0")} / {spec?.category}</span><h2>{node.data.label}</h2><p>{run ? `Recorded run ${run.id.slice(0,8)} · workflow v${run.version} · ${run.mode}` : "Workflow explanation · run this pipeline to see actual execution data"}</p></div><div className="detail-header-actions"><button aria-label="Previous step" disabled={index <= 0} onClick={() => onSelect(order[index-1])}><ArrowLeft size={17}/></button><span>{index+1} / {order.length}</span><button aria-label="Next step" disabled={index >= order.length-1} onClick={() => onSelect(order[index+1])}><ArrowRight size={17}/></button><button aria-label="Close node details" onClick={onClose}><X size={21}/></button></div></header>
    <nav className="detail-tabs" aria-label="Node detail sections">{["Overview", "Input", "Output", "Trace", "Evidence", "Configuration"].map(t => <button key={t} aria-current={t === tab ? "page" : undefined} className={tab===t ? "active" : ""} onClick={() => setTab(t)}>{t}{t==="Trace" && <span>{trace.length}</span>}{t==="Evidence" && <span>{record?.output?.findings?.length || 0}</span>}</button>)}</nav>
    <div className="node-detail-body">
      {tab === "Overview" && <div className="detail-overview"><div><section className="detail-section"><span className="intro-tag">WHAT THIS STEP DOES</span><h3>{guide?.purpose || spec?.description}</h3><ol>{guide?.process.map(s => <li key={s}>{s}</li>)}</ol></section><section className="detail-section"><span className="intro-tag">WHAT ACTUALLY HAPPENED</span><h3>{describeExecution(node.type || "", record)}</h3>{record?.error && <p className="detail-error">{record.error}</p>}<div className="detail-quicklinks"><button onClick={() => setTab("Input")}>Inspect input <ArrowRight size={14}/></button><button onClick={() => setTab("Output")}>Inspect output <ArrowRight size={14}/></button><button onClick={() => setTab("Trace")}>Follow the trace <ArrowRight size={14}/></button></div></section><section className="detail-section"><span className="intro-tag">WHERE THIS FITS</span><div className="detail-connections"><div><h4>Receives from</h4>{incoming.length ? incoming.map(e => <button key={e.id} onClick={() => onSelect(e.source)}>{evidenceGraph.nodes.find(n => n.id===e.source)?.data.label}<ArrowRight size={14}/></button>) : <p>Starts this workflow</p>}</div><div><h4>Continues to</h4>{outgoing.length ? outgoing.map(e => <button key={e.id} onClick={() => onSelect(e.target)}>{evidenceGraph.nodes.find(n => n.id===e.target)?.data.label}<small>{e.sourceHandle === "fail" ? "Review" : e.sourceHandle === "pass" ? "Pass" : ""}</small><ArrowRight size={14}/></button>) : <p>End of this branch</p>}</div></div></section></div><aside className="detail-facts"><span className={`badge ${record?.status || ""}`}>{record?.status || "Not executed"}</span><dl><dt>Duration</dt><dd>{record?.duration_ms == null ? "Not recorded" : `${record.duration_ms} ms`}</dd><dt>Attempts</dt><dd>{record?.attempts ?? "Not recorded"}</dd><dt>Started</dt><dd>{record?.started_at ? new Date(record.started_at*1000).toLocaleTimeString() : "Not recorded"}</dd><dt>Node identifier</dt><dd>{nodeId}</dd>{record?.provider_execution_id && <><dt>Provider execution</dt><dd>{record.provider_execution_id}</dd></>}</dl><h4>Know the boundary</h4><p>{guide?.boundary}</p>{run && <a href={appPath(`/api/runs/${run.id}/export`)} target="_blank" rel="noreferrer"><Download size={16}/> Export this run’s evidence</a>}{run && graph.version !== run.version && <p className="tip">You are inspecting the recorded version. Editor changes do not alter this evidence.</p>}</aside></div>}
      {(tab === "Input" || tab === "Output") && <><p className="detail-description">{tab === "Input" ? "The context this step actually received from active upstream nodes." : "The exact data this step returned. Expand fields to inspect decisions and metadata."}</p><Payload value={record?.[tab === "Input" ? "input" : "output"]}/></>}
      {tab === "Trace" && <><p className="detail-description">Persisted backend events for this node, in recorded sequence. This is the execution trace, not a generated explanation.</p><div className="node-trace">{trace.length ? trace.map(e => <article key={e.seq}><span className={`dot ${e.status}`}/><div><header><strong>{e.event.replaceAll("_", " ")}</strong><span><Clock size={12}/>{new Date(e.timestamp*1000).toLocaleTimeString()} · #{e.seq}</span></header><p>{e.error || e.reason || `${e.status}${e.attempts ? ` · attempt ${e.attempts}` : ""}${e.duration_ms != null ? ` · ${e.duration_ms} ms` : ""}`}</p><details><summary>Full event data</summary><pre>{JSON.stringify(e,null,2)}</pre></details></div></article>) : <p className="detail-empty">No events recorded for this step in the selected run.</p>}</div></>}
      {tab === "Evidence" && <><p className="detail-description">Findings present in this node’s output, including findings carried from upstream. Reviews are recorded separately.</p><Evidence findings={record?.output?.findings || []} reviews={reviews} onReview={onReview} onSeek={time => { onSeek(time); onClose(); }}/></>}
      {tab === "Configuration" && <><p className="detail-description">{run ? "The configuration captured in this immutable run. Edit the canvas inspector and rerun to test a change." : "Current node settings. Edit them in the canvas inspector."}</p><div className="config-facts">{Object.entries(spec?.config_schema || {}).map(([key, field]) => <article key={key}><div><strong>{field.description}</strong><small>{key}</small></div><code>{String(node.data.config[key] ?? field.default)}</code></article>)}</div>{!Object.keys(spec?.config_schema || {}).length && <p className="detail-empty">This step uses its incoming context and has no additional settings.</p>}<div className="detail-section"><h4>Supported execution modes</h4><div className="mode-list">{spec?.modes.map(m => <span className="badge" key={m}>{m}</span>)}</div><h4>Data contract</h4><p>{spec?.input_schema.type} → {spec?.output_schema.type}</p></div></>}
    </div>
    <footer><span>Traceable to the saved workflow and recorded execution.</span><button onClick={onClose}>Back to pipeline <ArrowRight size={14}/></button></footer>
  </section></div>;
}
