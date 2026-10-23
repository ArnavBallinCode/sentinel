"use client";
import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, ShieldCheck, Download, RefreshCw, Play } from "lucide-react";
import { Button } from "./ui/button";
import { useEditor } from "@/lib/editor";
import type { Run, Event, Finding, Review } from "@/lib/types";
import { Evidence } from "./inspector";
import { RunVerdict, Conversation, summarize, type Comparison, type HardenInfo } from "./run-verdict";
const tabs = ["Verdict", "Conversation", "Findings", "Events", "Coverage"];
export function ExecutionConsole({
  run,
  events,
  seek,
  onReview,
  reviews,
  onRefresh,
  comparison,
  canFix,
  onFix,
  hardenInfo,
  onPush,
}: {
  run: Run | null;
  events: Event[];
  seek: number | null;
  onReview: (f: Finding, s: string) => void;
  reviews: Review[];
  onRefresh: () => void;
  comparison: Comparison | null;
  canFix: boolean;
  onFix: () => void;
  hardenInfo: HardenInfo | null;
  onPush?: () => void;
}) {
  const [tab, setTab] = useState("Verdict"),
    [open, setOpen] = useState(true);
  const select = useEditor((s) => s.select);
  const graph = useEditor((s) => s.graph);
  const summary = run ? summarize(run) : null;
  // Watch the conversation live while a simulated attack runs, then land on the verdict.
  const finished = run ? ["completed", "failed", "cancelled", "interrupted"].includes(run.status) : false;
  useEffect(() => {
    if (run?.id) {
      setOpen(true);
      setTab(run.mode === "simulation" && !finished ? "Conversation" : "Verdict");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run?.id]);
  useEffect(() => {
    if (finished) setTab((t) => (t === "Conversation" ? "Verdict" : t));
  }, [finished]);
  useEffect(() => {
    if (seek !== null) {
      setTab("Conversation");
      setOpen(true);
    }
  }, [seek]);
  return (
    <section className={`execution-console ${open ? "open" : "collapsed"}`}>
      <div className="console-toolbar">
        <button className="console-title" onClick={() => setOpen(!open)}>
          <ShieldCheck size={15} /> Test results {open ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
        </button>
        <div className="console-tabs">
          {tabs.map((t) => (
            <button
              key={t}
              className={tab === t ? "active" : ""}
              onClick={() => {
                setTab(t);
                setOpen(true);
              }}
            >
              {t}
              {t === "Findings" && !!summary?.findings.length && <span>{summary.findings.length}</span>}
            </button>
          ))}
        </div>
        <div className="console-right">
          {run && (
            <>
              <span className="mono">{run.id.slice(0, 8)}</span>
              {run.status === "waiting" && (
                <Button size="sm" onClick={onRefresh}>
                  <RefreshCw size={12} />
                  Refresh call
                </Button>
              )}
              <a title="Export run JSON" href={`/api/runs/${run.id}/export`} target="_blank" rel="noreferrer">
                <Download size={14} />
              </a>
            </>
          )}
        </div>
      </div>
      {open && (
        <div className="console-body">
          {!run || !summary ? (
            <div className="console-empty">
              <span className="empty-icon">
                <Play size={18} />
              </span>
              <div>
                <strong>Pick a scenario and press Run test</strong>
                <p>Sentinel attacks the agent, enforces tool permissions, and shows the verdict here.</p>
              </div>
              <kbd>⌘ ↵</kbd>
            </div>
          ) : tab === "Verdict" ? (
            <RunVerdict
              run={run}
              comparison={comparison}
              canFix={canFix}
              onFix={onFix}
              hardenInfo={hardenInfo}
              onPush={onPush}
              onShowConversation={() => setTab("Conversation")}
              onShowFindings={() => setTab("Findings")}
            />
          ) : tab === "Conversation" ? (
            <Conversation run={run} seek={seek} />
          ) : tab === "Coverage" ? (
            <div className="errors">
              <p className="description">What this execution could and could not verify.</p>
              {summary.unsupported.map((s) => (
                <p key={s}>
                  <span className="badge warning">Not evaluated</span> {s}
                </p>
              ))}
              {summary.coverage.map((s) => (
                <p key={s}>{s}</p>
              ))}
              {summary.errors.map(([id, n]) => (
                <p key={id}>
                  <span className="badge warning">Error</span> {graph?.nodes.find((x) => x.id === id)?.data.label || id}: {n.error}
                </p>
              ))}
              {!summary.unsupported.length && !summary.coverage.length && (
                <p>No coverage warnings were emitted by the executed checks. This is not proof of complete acoustic coverage.</p>
              )}
            </div>
          ) : tab === "Events" ? (
            <div className="event-table">
              <div className="table-head">
                <span>TIME</span>
                <span>NODE / EVENT</span>
                <span>STATUS</span>
                <span>DETAIL</span>
              </div>
              {events.map((e) => (
                <button key={e.seq} className="event-row" onClick={() => e.node_id && select(e.node_id)}>
                  <span className="mono">{new Date(e.timestamp * 1000).toLocaleTimeString()}</span>
                  <span>
                    <span className={`dot ${e.status}`} />
                    {graph?.nodes.find((n) => n.id === e.node_id)?.data.label || e.event.replaceAll("_", " ")}
                  </span>
                  <span className={`status-text ${e.status}`}>{e.status}</span>
                  <span>{e.error || e.reason || (e.duration_ms != null ? `${e.duration_ms} ms` : `Event #${e.seq}`)}</span>
                </button>
              ))}
            </div>
          ) : (
            <Evidence
              findings={summary.findings}
              onSeek={() => setTab("Conversation")}
              onReview={onReview}
              reviews={reviews}
            />
          )}
        </div>
      )}
    </section>
  );
}
