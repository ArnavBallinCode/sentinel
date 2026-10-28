"use client";
import { appPath } from "@/lib/paths";
import { useEffect, useState, useCallback, useRef } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  useReactFlow,
  BackgroundVariant,
  MarkerType,
  type Connection,
  type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  Shield,
  ChevronRight,
  Plus,
  Search,
  Play,
  Square,
  Undo2,
  Redo2,
  Workflow,
  History,
  Settings2,
  PanelLeftClose,
  PanelLeftOpen,
  Check,
  Upload,
  Sun,
  Moon,
  LayoutGrid,
  GitCompareArrows,
  ArrowUpRight,
  X,
  LoaderCircle,
  Copy,
  Save,
  Link2,
  TriangleAlert,
  SlidersHorizontal,
  FileAudio,
  Trash2,
  BookOpen,
  CheckCheck,
  Maximize2,
  Minimize2,
  MoreHorizontal,
  Sparkles,
  Wrench,
} from "lucide-react";
import type {
  Graph,
  Spec,
  Run,
  Event,
  Finding,
  Review,
  FlowNode,
  RunSummary,
} from "@/lib/types";
import { KeyForm } from "./key-form";
import { api, post } from "@/lib/api";
import { useEditor, executionOrder } from "@/lib/editor";
import { WorkflowNode, icons } from "./workflow-node";
import { Inspector } from "./inspector";
import { ExecutionConsole } from "./execution-console";
import { Button } from "./ui/button";
import { WorkbenchNavigation } from "./workbench-navigation";
import type { Comparison, HardenInfo } from "./run-verdict";
type Attack = { id: string; name: string; category: string; severity: string; source?: string; language?: string };
import { WorkspaceOverview } from "./workspace-overview";
import { NodeDetails } from "./node-details";
const nodeTypes = { sentinel: WorkflowNode };
type Settings = {
  byok?: boolean;
  bolna_configured: boolean;
  semantic_configured: boolean;
  semantic_providers: string[];
  allowed_numbers_count: number;
  limitations: string[];
};
function Workspace() {
  const editor = useEditor();
  const { graph, selected, dirty, load, select, edit } = editor;
  const flow = useReactFlow();
  const [registry, setRegistry] = useState<Record<string, Spec>>({}),
    [workflows, setWorkflows] = useState<Graph[]>([]),
    [run, setRun] = useState<Run | null>(null),
    [runs, setRuns] = useState<RunSummary[]>([]),
    [events, setEvents] = useState<Event[]>([]),
    [reviews, setReviews] = useState<Review[]>([]);
  const [search, setSearch] = useState(""),
    [library, setLibrary] = useState(false),
    [dark, setDark] = useState(true),
    [modal, setModal] = useState<string | null>(null),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState<{ text: string; error?: boolean } | null>(
      null,
    ),
    [scenario, setScenario] = useState("injection"),
    [mode, setMode] = useState("simulation"),
    [seek, setSeek] = useState<number | null>(null),
    [settings, setSettings] = useState<Settings | null>(null),
    [versions, setVersions] = useState<Graph[]>([]);
  const [agentId, setAgentId] = useState(""),
    [agentName, setAgentName] = useState(""),
    [recipient, setRecipient] = useState(""),
    [authorized, setAuthorized] = useState(false),
    [recordingId, setRecordingId] = useState(""),
    [recordings, setRecordings] = useState<{ id: string; name: string }[]>([]),
    [compareIds, setCompareIds] = useState<string[]>([]),
    [comparison, setComparison] = useState<Comparison | null>(null);
  const clip = useRef<FlowNode | null>(null);
  const baselineRef = useRef(false);
  const [zoom, setZoom] = useState(1);
  const [home, setHome] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [canvasOnly, setCanvasOnly] = useState(false);
  const [executionId, setExecutionId] = useState("");
  const [detailedNode, setDetailedNode] = useState<string | null>(null);
  const closeNodeDetails = useCallback(() => setDetailedNode(null), []);
  const [menuOpen, setMenuOpen] = useState(false);
  const [attacks, setAttacks] = useState<Attack[]>([]);
  const [target, setTarget] = useState("");
  const [deploymentId, setDeploymentId] = useState<string | null>(null);
  const [hardenInfo, setHardenInfo] = useState<HardenInfo | null>(null);
  const [baselineRunId, setBaselineRunId] = useState<string | null>(null);
  const [fixComparison, setFixComparison] = useState<Comparison | null>(null);
  const [recentCalls, setRecentCalls] = useState<{ id: string; status: string; created_at: string; duration: number | null; has_transcript: boolean }[]>([]);
  const [connectedAgents, setConnectedAgents] = useState<{ id: string; name: string }[]>([]);
  const [availableAgents, setAvailableAgents] = useState<{id: string; name: string}[]>([]);
  const initial = useRef(false);
  const message = useCallback(
    (text: string, error = false) => setNotice({ text, error }),
    [],
  );
  const act = useCallback(
    async (fn: () => Promise<void>) => {
      setBusy(true);
      try {
        await fn();
      } catch (e) {
        message(e instanceof Error ? e.message : "Request failed", true);
      } finally {
        setBusy(false);
      }
    },
    [message],
  );
  useEffect(() => {
    if (initial.current) return;
    initial.current = true;
    setDark(localStorage.getItem("sentinel-theme") !== "light");
    setSidebarCollapsed(localStorage.getItem("sentinel-sidebar") === "collapsed");
    if (window.innerWidth < 720) setLibrary(false);
    void act(async () => {
      void api<Attack[]>("/redteam/attacks").then(setAttacks).catch(() => {});
      const [reg, gs, rs, ss, recs, agents] = await Promise.all([
        api<Record<string, Spec>>("/registry"),
        api<Graph[]>("/workflows"),
        api<RunSummary[]>("/runs"),
        api<Settings>("/settings"),
        api<{ id: string; name: string }[]>("/recordings"),
        api<{ id: string; name: string }[]>("/agents"),
      ]);
      setRegistry(reg);
      setWorkflows(gs);
      setRuns(rs);
      setSettings(ss);
      setRecordings(recs);
      setConnectedAgents(agents);
      if (agents[0]) { setAgentId(agents[0].id); setAgentName(agents[0].name); }
      if (recs[0]) setRecordingId(recs[0].id);
      const linkedRun = new URLSearchParams(window.location.search).get("run");
      if (linkedRun) {
        const full = await api<Run>(`/runs/${encodeURIComponent(linkedRun)}`);
        load(full.graph); setRun(full); setMode(full.mode); setHome(false);
        setTarget(full.request.agent_id || ""); setScenario(full.request.scenario);
      } else load(gs.find((g) => g.id === "adversarial") || gs[0]);
    });
  }, [act, load]);
  useEffect(() => {
    const exit = () => { if (!document.fullscreenElement) setCanvasOnly(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape" && !document.fullscreenElement && !detailedNode) setCanvasOnly(false); };
    document.addEventListener("fullscreenchange", exit);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("fullscreenchange", exit); document.removeEventListener("keydown", escape); };
  }, [detailedNode]);
  const toggleCanvasOnly = async () => {
    if (canvasOnly) {
      if (document.fullscreenElement) await document.exitFullscreen();
      setCanvasOnly(false);
    } else {
      setCanvasOnly(true); select(null); setLibrary(false);
      await document.querySelector<HTMLElement>(".app")?.requestFullscreen?.().catch(() => {});
    }
    setTimeout(() => void flow.fitView({ padding: 0.12, maxZoom: 1, duration: 300 }), 150);
  };
  useEffect(() => {
    if (notice) {
      const id = setTimeout(() => setNotice(null), 7000);
      return () => clearTimeout(id);
    }
  }, [notice]);
  useEffect(() => {
    if (!modal) return;
    const previous = document.activeElement as HTMLElement | null;
    const dialog = document.querySelector<HTMLElement>(".modal");
    dialog?.querySelector<HTMLElement>("button,input,select")?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setModal(null);
        return;
      }
      if (e.key !== "Tab" || !dialog) return;
      const items = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          "button:not(:disabled),input:not(:disabled),select:not(:disabled),a[href]",
        ),
      );
      const first = items[0],
        last = items.at(-1);
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("keydown", key);
      previous?.focus();
    };
  }, [modal]);
  const graphId = graph?.id;
  const runKey = run?.id;
  // Refit when a workflow opens or a run starts (the results panel shrinks the canvas). Wait until the
  // canvas is laid out and every node is measured; fitting earlier silently uses a 0px canvas.
  useEffect(() => {
    if (home || !graphId) return;
    let id: ReturnType<typeof setTimeout>;
    let tries = 0;
    const attempt = () => {
      const pane = document.querySelector<HTMLElement>(".canvas .react-flow");
      const nodes = flow.getNodes();
      const ready = pane && pane.clientWidth > 200 && pane.clientHeight > 150 && nodes.length > 0 && nodes.every((n) => n.measured?.width);
      if (!ready && tries++ < 30) {
        id = setTimeout(attempt, 100);
        return;
      }
      void flow.fitView({ padding: 0.1, maxZoom: 1, duration: 250 });
    };
    id = setTimeout(attempt, 120);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refit only when these change, not on every poll re-render
  }, [graphId, home, runKey]);
  // After "Harden agent & retest" finishes, compare the new run against the failing one.
  useEffect(() => {
    if (!baselineRunId || !run || run.id === baselineRunId || run.status !== "completed") return;
    const before = baselineRunId;
    setBaselineRunId(null);
    void api<Comparison>(`/compare?before=${before}&after=${run.id}`).then(setFixComparison).catch(() => {});
  }, [baselineRunId, run]);
  const runId = run?.id;
  // The dev proxy can buffer server-sent events; poll while running so turns and node states appear live.
  useEffect(() => {
    if (!runId || run?.status !== "running") return;
    const timer = setInterval(() => {
      void api<Run>(`/runs/${runId}`).then((r) => setRun((old) => (old?.id === r.id ? r : old))).catch(() => {});
    }, 700);
    return () => clearInterval(timer);
  }, [runId, run?.status]);
  useEffect(() => {
    if (!runId || run?.status !== "waiting") return;
    const timer = setInterval(() => {
      void post(`/runs/${runId}/refresh`).then(() => api<Run>(`/runs/${runId}`)).then(setRun).catch(() => {});
    }, 5000);
    return () => clearInterval(timer);
  }, [runId, run?.status]);
  useEffect(() => {
    if (!runId) {
      setEvents([]);
      setReviews([]);
      return;
    }
    let alive = true;
    let snapshotSequence = 0;
    setEvents([]);
    void api<Review[]>(`/runs/${runId}/reviews`).then((r) => {
      if (alive) setReviews(r);
    });
    const source = new EventSource(appPath(`/api/runs/${runId}/events`));
    source.onmessage = (e) => {
      const event = JSON.parse(e.data) as Event;
      setEvents((old) =>
        old.some((x) => x.seq === event.seq) ? old : [...old, event],
      );
      const sequence = ++snapshotSequence;
      void api<Run>(`/runs/${runId}`).then((r) => {
        if (alive && sequence === snapshotSequence) setRun(r);
      });
      if (
        [
          "run_completed",
          "run_failed",
          "run_cancelled",
          "run_interrupted",
        ].includes(event.event)
      ) {
        source.close();
        void api<RunSummary[]>("/runs").then(setRuns);
      }
    };
    source.onerror = () => {
      source.close();
      const sequence = ++snapshotSequence;
      void api<Run>(`/runs/${runId}`).then((r) => {
        if (alive && sequence === snapshotSequence) {
          setRun(r);
          if (
            !["completed", "failed", "cancelled", "interrupted"].includes(
              r.status,
            )
          )
            message(
              "Event connection interrupted. Reopen the run to reconnect.",
              true,
            );
        }
      });
    };
    return () => {
      alive = false;
      source.close();
    };
  }, [runId, message]);
  const cleanGraph = useCallback(() => {
    const current = useEditor.getState().graph!;
    return {
      ...current,
      nodes: current.nodes.map((n) => ({
        id: n.id,
        type: n.type,
        position: n.position,
        data: { label: n.data.label, config: n.data.config },
      })),
      edges: current.edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        sourceHandle: e.sourceHandle || null,
        targetHandle: e.targetHandle || null,
      })),
    };
  }, []);
  const save = useCallback(async () => {
    const current = cleanGraph();
    const saved = await api<Graph>(`/workflows/${current.id}`, {
      method: "PUT",
      body: JSON.stringify(current),
    });
    const selection = useEditor.getState().selected;
    load(saved);
    select(selection);
    setWorkflows((old) => old.map((g) => (g.id === saved.id ? saved : g)));
    message(`Saved immutable version ${saved.version}`);
    return saved;
  }, [cleanGraph, load, select, message]);
  const runTest = useCallback(async () => {
    const s = useEditor.getState();
    if (!s.graph) return;
    const g = s.dirty ? await save() : s.graph;
    const result = await post<Run>("/runs", {
      workflow_id: g.id,
      version: g.version,
      mode,
      scenario: scenario.startsWith("gen:") ? "injection" : scenario,
      attack_id: scenario.startsWith("gen:") ? scenario.slice(4) : undefined,
      seed: 42,
      // Simulations attack the selected target's prompt; live calls use the connected agent.
      agent_id: (mode === "simulation" ? target : agentId) || undefined,
      recipient: recipient || undefined,
      authorized,
      recording_id: recordingId || undefined,
    });
    setFixComparison(null);
    if (!baselineRef.current) setHardenInfo(null);
    setRun(result);
    setRuns(await api<RunSummary[]>("/runs"));
    message(
      mode === "simulation"
        ? "Simulation started · no external voice call"
        : mode === "audit"
          ? "Recording audit started"
          : "Authorized hosted call dispatched",
    );
  }, [
    save,
    mode,
    scenario,
    target,
    agentId,
    recipient,
    authorized,
    recordingId,
    message,
  ]);
  const knownAgents = [...new Map([...connectedAgents, ...availableAgents].map((a) => [a.id, a])).values()];
  const availableAgentName = (id: string) => knownAgents.find((a) => a.id === id)?.name || id;
  const agentNode = graph?.nodes.find((n) => n.type === "bolna");
  const hardened = Boolean(agentNode?.data.config.safe_agent);
  const setHardened = (value: boolean) => {
    const g = useEditor.getState().graph;
    if (!g) return;
    edit({
      nodes: g.nodes.map((n) =>
        n.type === "bolna" ? { ...n, data: { ...n.data, config: { ...n.data.config, safe_agent: value } } } : n,
      ),
    });
  };
  const fixAndRetest = () =>
    void act(async () => {
      if (!run) return;
      const baseline = run;
      const llmRun = Object.values(baseline.nodes).some(n => n.output?.engine === "llm");
      const info = llmRun ? await post<HardenInfo>("/redteam/harden", { run_id: baseline.id }) : null;
      setHardenInfo(info);
      const latest = await api<Graph>(`/workflows/${baseline.workflow_id}`);
      const candidate = {
        ...baseline.graph, version: latest.version,
        nodes: baseline.graph.nodes.map(n => n.type === "bolna"
          ? { ...n, data: { ...n.data, config: { ...n.data.config, safe_agent: true, ...(info ? { prompt_patch: info.patch } : {}) } } } : n),
      };
      const saved = await api<Graph>(`/workflows/${baseline.workflow_id}`, { method: "PUT", body: JSON.stringify(candidate) });
      load(saved);
      const replay = await post<Run>(`/runs/${baseline.id}/replay`, { version: saved.version });
      setTarget(baseline.request.agent_id || "");
      setScenario(baseline.request.attack_id ? `gen:${baseline.request.attack_id}` : baseline.request.scenario);
      setMode(baseline.mode);
      setFixComparison(null);
      setRun(replay);
      setBaselineRunId(baseline.id);
      setRuns(await api<RunSummary[]>("/runs"));
      message("Replaying the baseline inputs with the guardrail treatment changed");
    });
  const generateAttacks = () =>
    void act(async () => {
      const language = String(graph?.nodes.find((n) => n.type === "scenario")?.data.config.language || "en");
      message("Reading the agent's prompt and writing attacks…");
      const result = await post<{ source: string; attacks: Attack[] }>("/redteam/attacks", { agent_id: target || undefined, count: 6, language });
      setAttacks((old) => [...result.attacks, ...old]);
      if (result.attacks[0]) setScenario(`gen:${result.attacks[0].id}`);
      message(`${result.attacks.length} attacks generated from ${result.source}`);
    });
  const pushGuardrails = () =>
    void act(async () => {
      if (!hardenInfo?.agent_id || !hardenInfo.expected_prompt_hash) return;
      const name = availableAgentName(hardenInfo.agent_id);
      if (!window.confirm(`Append Sentinel's guardrail patch to the live Bolna agent "${name}"? Sentinel saves the previous prompt for guarded rollback.`)) return;
      const receipt = await post<{ deployment_id: string }>(`/bolna/agents/${encodeURIComponent(hardenInfo.agent_id)}/guardrails`, { patch: hardenInfo.patch, expected_prompt_hash: hardenInfo.expected_prompt_hash });
      setDeploymentId(receipt.deployment_id);
      message(`Guardrails pushed to ${name} on Bolna`);
    });
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const input = (e.target as HTMLElement).closest(
        "input,textarea,select,[contenteditable],[role=dialog]",
      );
      if (!(e.metaKey || e.ctrlKey) || input) return;
      const s = useEditor.getState();
      if (e.key === "s") {
        e.preventDefault();
        void act(async () => {
          await save();
        });
      }
      if (e.key === "Enter") {
        e.preventDefault();
        if (mode === "simulation") void act(runTest);
        else setModal("test");
      }
      if (e.key === "z") {
        e.preventDefault();
        e.shiftKey ? s.redo() : s.undo();
      }
      if (e.key === "d") {
        e.preventDefault();
        s.duplicate();
      }
      if (e.key === "c") {
        const n = s.graph?.nodes.find((n) => n.id === s.selected);
        if (n) clip.current = structuredClone(n);
      }
      if (e.key === "v" && clip.current && s.graph) {
        e.preventDefault();
        const n = structuredClone(clip.current);
        n.id = crypto.randomUUID();
        n.position = { x: n.position.x + 35, y: n.position.y + 35 };
        s.edit({ nodes: [...s.graph.nodes, n] });
        s.select(n.id);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [act, save, runTest]);
  const addNode = (kind: string, position?: { x: number; y: number }) => {
    if (!graph) return;
    const spec = registry[kind];
    const id = crypto.randomUUID();
    edit({
      nodes: [
        ...graph.nodes,
        {
          id,
          type: kind,
          position:
            position ||
            flow.screenToFlowPosition({
              x: window.innerWidth / 2,
              y: window.innerHeight / 2 - 60,
            }),
          data: {
            label: spec.label,
            config: Object.fromEntries(
              Object.entries(spec.config_schema).map(([k, v]) => [
                k,
                v.default,
              ]),
            ),
          },
        },
      ],
    });
    select(id);
  };
  const validConnection = (c: Connection | Edge) => {
    if (!graph || c.source === c.target) return false;
    const a = graph.nodes.find((n) => n.id === c.source),
      b = graph.nodes.find((n) => n.id === c.target);
    if (!a || !b || ["manual", "recording"].includes(b.type || ""))
      return false;
    const need = registry[b.type || ""]?.input_schema.type,
      have = registry[a.type || ""]?.output_schema.type;
    if (["transcript", "findings"].includes(need) && need !== have)
      return false;
    const visited = new Set<string>();
    const visit = (id: string): boolean => {
      if (id === c.source) return true;
      if (visited.has(id)) return false;
      visited.add(id);
      return graph.edges
        .filter((e) => e.source === id)
        .some((e) => visit(e.target));
    };
    return !visit(c.target);
  };
  const openModal = (name: string) =>
    void act(async () => {
      if (name === "capabilities") { setHome(true); setTimeout(() => document.getElementById("capabilities")?.scrollIntoView({ behavior: "smooth" }), 100); return; }
      if (name === "history" || name === "compare") setRuns(await api<RunSummary[]>("/runs"));
      if (name === "recordings" && agentId && settings?.bolna_configured)
        void api<typeof recentCalls>(`/bolna/agents/${encodeURIComponent(agentId)}/executions`).then(setRecentCalls).catch(() => setRecentCalls([]));
      if (name === "versions" && graph)
        setVersions(await api<Graph[]>(`/workflows/${graph.id}/versions`));
      setModal(name);
    });
  const onReview = (f: Finding, status: string) =>
    void act(async () => {
      if (!run) return;
      const r = await post<Review>(`/runs/${run.id}/reviews`, {
        finding_id: f.id,
        status,
      });
      setReviews((old) => [...old, r]);
      message("Review recorded separately from immutable evidence");
    });
  const switchWorkflow = async (id: string) => {
    if (dirty) await save();
    const g = await api<Graph>(`/workflows/${id}`);
    load(g);
    setHome(false);
    setRun(null);
    setFixComparison(null);
    setMode(id === "audit" ? "audit" : id === "voice" ? "live" : "simulation");
    setTimeout(() => flow.fitView({ padding: 0.1, maxZoom: 1 }), 150);
  };
  const categories = Array.from(
    new Set(Object.values(registry).map((s) => s.category)),
  );
  const orderedIds = graph ? executionOrder(graph) : [];
  const sideFor = (node: FlowNode, direction: "source" | "target"): "left" | "right" | "top" | "bottom" => {
    const edge = graph?.edges.find(e => direction === "source" ? e.source === node.id : e.target === node.id);
    const other = graph?.nodes.find(n => n.id === (direction === "source" ? edge?.target : edge?.source));
    if (!other) return direction === "source" ? "bottom" : "top";
    if (direction === "target" && edge?.sourceHandle === "fail" && Math.abs(other.position.y - node.position.y) < 80) return "bottom";
    if (Math.abs(other.position.y - node.position.y) < 80) return other.position.x > node.position.x ? "right" : "left";
    return other.position.y > node.position.y ? "bottom" : "top";
  };
  const nodePreview = (n: FlowNode) => {
    const record = run?.nodes[n.id];
    if (record?.error) return record.error;
    const requests = record?.output?.tool_requests as { decision?: { allowed: boolean } }[] | undefined;
    if (n.type === "tool_auth" && Array.isArray(requests) && record?.status !== "skipped") {
      const denied = requests.filter((t) => t.decision && !t.decision.allowed).length;
      if (requests.some(t => (t as {provider_trace?: boolean}).provider_trace)) return "Provider logs · observed after call";
      return requests.length ? `${denied ? `⛔ ${denied} blocked` : "✓ all allowed"} · ${requests.length} tool call${requests.length > 1 ? "s" : ""}` : "No tool calls attempted";
    }
    if (n.type === "bolna") return mode === "simulation" ? `${target ? availableAgentName(target) : "Demo agent"} · ${n.data.config.safe_agent ? "hardened prompt" : "original prompt"}` : agentName || "Choose an agent in Connections";
    if (n.type === "scenario") return mode === "simulation" ? `Attack · ${scenario.startsWith("gen:") ? attacks.find((a) => `gen:${a.id}` === scenario)?.name || "generated" : scenario.replaceAll("_", " ")}` : undefined;
    return undefined;
  };
  const displayNodes =
    graph?.nodes.map((n) => ({
      ...n,
      type: "sentinel",
      selected: Boolean(n.selected) || n.id === selected,
      data: {
        ...n.data,
        kind: n.type,
        description: registry[n.type || ""]?.description,
        category: registry[n.type || ""]?.category,
        step: orderedIds.indexOf(n.id) + 1,
        sourceSide: sideFor(n, "source"),
        targetSide: sideFor(n, "target"),
        onExpand: () => setDetailedNode(n.id),
        preview: nodePreview(n),
        status: run?.nodes[n.id]?.status,
        duration_ms: run?.nodes[n.id]?.duration_ms,
        findings: run?.nodes[n.id]?.output?.findings?.length,
      },
    })) || [];
  const edges =
    graph?.edges.map((e) => ({
      ...e,
      type: "smoothstep",
      markerEnd: { type: MarkerType.ArrowClosed, color: "#7782a0", width: 18, height: 18 },
      animated: run?.nodes[e.target]?.status === "running",
      style: {
        stroke:
          run?.nodes[e.target]?.status === "skipped"
            ? "var(--line)"
            : "var(--edge)",
        strokeWidth: 2.2,
      },
      label:
        e.sourceHandle === "pass"
          ? "PASS"
          : e.sourceHandle === "fail"
            ? "REVIEW"
            : undefined,
    })) || [];
  const running = run && ["running", "waiting"].includes(run.status);
  const focusStep = (id: string) => {
    select(id);
    const node = graph?.nodes.find(n => n.id === id);
    if (node) setTimeout(() => void flow.setCenter(node.position.x + 150, node.position.y + 80, { zoom: 1, duration: 350 }), 120);
  };
  return (
    <div className={`app ${dark ? "dark" : ""} ${canvasOnly ? "canvas-only" : ""}`}>
      <WorkbenchNavigation graph={graph} onSwitch={id => void act(() => switchWorkflow(id))} onOpen={openModal} dark={dark} onTheme={() => { setDark(!dark); localStorage.setItem("sentinel-theme", dark ? "light" : "dark"); }} connected={Boolean(settings?.byok ? settings.semantic_configured || settings.bolna_configured : settings?.bolna_configured)} byok={Boolean(settings?.byok)} home={home} onHome={() => setHome(true)} collapsed={sidebarCollapsed} onCollapse={() => { setSidebarCollapsed(!sidebarCollapsed); localStorage.setItem("sentinel-sidebar", sidebarCollapsed ? "expanded" : "collapsed"); }}/>
      {home && <WorkspaceOverview byok={Boolean(settings?.byok)} keysReady={Boolean(settings?.semantic_configured)} registry={registry} onExplore={kind => void act(async () => {
        await switchWorkflow(["recording", "normalize", "coverage", "pii", "semantic"].includes(kind) ? "audit" : kind === "bolna" ? "voice" : "adversarial");
        const node = useEditor.getState().graph?.nodes.find(n => n.type === kind);
        if (node) setDetailedNode(node.id);
        else { setLibrary(true); setSearch(registry[kind]?.label || kind); message("Add this step from the library, connect it, then validate the pipeline."); }
      })} runs={runs} recordings={recordings.length} providers={settings?.semantic_providers || []} bolna={Boolean(settings?.bolna_configured)} onWorkflow={id => void act(() => switchWorkflow(id))} onOpen={openModal} onRun={r => void act(async () => { if (dirty) await save(); const full = await api<Run>(`/runs/${r.id}`); load(full.graph); setRun(full); setMode(full.mode); setHome(false); setTimeout(() => void flow.fitView({padding: 0.1, maxZoom: 1}), 150); })}/>}
      <div className="shell" style={home ? { display: "none" } : undefined}>
        <div className="workflow-toolbar">
          <div className="workflow-title">
            <span className="workflow-symbol">
              <Workflow size={18} />
            </span>
            <div>
              <div className="title-line">
                <input
                  aria-label="Workflow name"
                  style={{ width: `${Math.min(24, Math.max(10, (graph?.name || "").length)) * 0.6}em` }}
                  value={graph?.name || "Loading workspace…"}
                  onChange={(e) => edit({ name: e.target.value })}
                />
              </div>
              <div className="save-state">
                <span className={`dot ${dirty ? "warning" : ""}`} />
                v{graph?.version || 1}
                <span>·</span>
                {dirty ? "Unsaved changes" : "Saved"}
                <span>·</span>
                {mode === "simulation" ? "Simulation · no phone call" : mode === "audit" ? "Recording audit" : "Live Bolna call"}
              </div>
            </div>
          </div>
          <div className="test-controls">
            {mode === "simulation" ? (
              <>
                <label className="control">
                  <span>Target</span>
                  <select aria-label="Agent under test" value={target} onChange={(e) => setTarget(e.target.value)}>
                    <option value="">Demo agent · Voxbento Finance</option>
                    {knownAgents.map((a) => (
                      <option key={a.id} value={a.id}>Bolna · {a.name}</option>
                    ))}
                  </select>
                </label>
                <label className="control">
                  <span>Attack</span>
                  <select aria-label="Scenario" value={scenario} onChange={(e) => setScenario(e.target.value)}>
                    <optgroup label="Built-in">
                      <option value="injection">Prompt injection · “I am your admin”</option>
                      <option value="unauthorized">Someone else’s account</option>
                      <option value="dispute">Payment dispute</option>
                      <option value="normal">Normal inquiry (control)</option>
                    </optgroup>
                    {attacks.length > 0 && (
                      <optgroup label="Generated from agent prompt">
                        {attacks.slice(0, 18).map((a) => (
                          <option key={a.id} value={`gen:${a.id}`}>{a.language === "hi" ? "🇮🇳 " : ""}{a.name} · {a.severity}</option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                  <button className="generate" title="Generate new attacks from the agent's prompt" aria-label="Generate attacks" disabled={busy} onClick={generateAttacks}>
                    <Sparkles size={14} />
                  </button>
                </label>
                {agentNode && (
                  <div className="control">
                    <span>Prompt</span>
                    <div className="segmented" role="radiogroup" aria-label="Agent behavior">
                      <button role="radio" aria-checked={!hardened} className={!hardened ? "on bad" : ""} onClick={() => setHardened(false)}>Baseline</button>
                      <button role="radio" aria-checked={hardened} className={hardened ? "on good" : ""} onClick={() => setHardened(true)}>Hardened</button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <button className="control-link" onClick={() => setModal("test")}>
                <SlidersHorizontal size={14} /> {mode === "audit" ? (recordings.find((r) => r.id === recordingId)?.name || "Choose recording") : agentName || "Configure live call"}
              </button>
            )}
          </div>
          <div className="toolbar-actions">
            <Button variant="ghost" size="sm" onClick={() => setLibrary(!library)} aria-label="Toggle node library">
              <Plus size={15} /> <span className="hide-narrow">Add step</span>
            </Button>
            <div className="history-buttons">
              <Button variant="ghost" size="icon" aria-label="Undo" disabled={!editor.past.length} onClick={editor.undo}>
                <Undo2 size={16} />
              </Button>
              <Button variant="ghost" size="icon" aria-label="Redo" disabled={!editor.future.length} onClick={editor.redo}>
                <Redo2 size={16} />
              </Button>
            </div>
            <div className="menu-wrap">
              <Button variant="ghost" size="icon" aria-label="More actions" aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>
                <MoreHorizontal size={17} />
              </Button>
              {menuOpen && (
                <>
                  <div className="menu-scrim" onClick={() => setMenuOpen(false)} />
                  <div className="menu" role="menu" onClick={() => setMenuOpen(false)}>
                    <button role="menuitem" disabled={busy || !dirty} onClick={() => void act(async () => { await save(); })}><Save size={14} /> Save version <kbd>⌘S</kbd></button>
                    <button role="menuitem" onClick={() => openModal("versions")}><History size={14} /> Version history</button>
                    <button role="menuitem" onClick={() => { editor.layout(); setTimeout(() => flow.fitView({ padding: 0.12, maxZoom: 1 }), 100); }}><LayoutGrid size={14} /> Auto layout</button>
                    <button role="menuitem" onClick={() => void act(async () => {
                      const v = await post<{ valid: boolean; errors: string[] }>("/validate", cleanGraph());
                      message(v.valid ? "Workflow is valid. All connections and node settings checked." : v.errors.join(" "), !v.valid);
                    })}><CheckCheck size={14} /> Validate graph</button>
                    <button role="menuitem" onClick={() => openModal("test")}><SlidersHorizontal size={14} /> Test settings</button>
                    <button role="menuitem" disabled={busy || !graph} onClick={() => void act(async () => {
                      if (dirty) await save();
                      await post(`/workflows/${graph!.id}/publish`);
                      message("Published locally. External triggers remain disabled.");
                      setWorkflows(await api<Graph[]>("/workflows"));
                      edit({ published: true }, false);
                      useEditor.setState({ dirty: false });
                    })}><Upload size={14} /> Publish locally</button>
                  </div>
                </>
              )}
            </div>
            <Button
              variant="primary"
              className="run-button"
              onClick={() =>
                void act(
                  running
                    ? async () => {
                        await post(`/runs/${run.id}/cancel`);
                        setRun(await api<Run>(`/runs/${run.id}`));
                      }
                    : mode === "simulation" ? runTest : async () => { setModal("test"); },
                )
              }
              disabled={busy || !graph}
            >
              {busy ? <LoaderCircle size={15} className="spin" /> : running ? <Square size={13} /> : <Play size={14} fill="currentColor" />}
              {running ? "Stop" : mode === "simulation" ? "Run test" : mode === "audit" ? "Run audit" : "Place call"}
            </Button>
          </div>
        </div>
        <div className="editor-main">
          {library && (
            <aside className="library">
              <div className="library-heading">
                <h2>Add a step</h2>
                <Button size="icon" variant="ghost" aria-label="Close node library" onClick={() => setLibrary(false)}><X size={16}/></Button>
              </div>
              <p className="library-hint">Build your trust workflow.</p>
              <div className="search-box">
                <Search size={14} />
                <input
                  aria-label="Search nodes"
                  placeholder="Search nodes…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <kbd>/</kbd>
              </div>
              <div className="library-scroll">
                {categories.map((category) => {
                    const specs = Object.values(registry).filter(
                    (s) =>
                      s.category === category && s.modes.includes(mode) &&
                      `${s.label} ${s.description}`
                        .toLowerCase()
                        .includes(search.toLowerCase()),
                  );
                  return specs.length ? (
                    <div className="node-group" key={category}>
                      <div className="section-label">
                        {category}
                        <span>{specs.length}</span>
                      </div>
                      {specs.map((s) => {
                        const Icon = icons[s.type] || Plus;
                        return (
                          <button
                            key={s.type}
                            className="library-node"
                            draggable
                            onDragStart={(e) =>
                              e.dataTransfer.setData(
                                "application/sentinel",
                                s.type,
                              )
                            }
                            onClick={() => addNode(s.type)}
                            title={s.description}
                          >
                            <span
                              className={`library-icon category-${category.split(" ")[0].toLowerCase()}`}
                            >
                              <Icon size={16} />
                            </span>
                            <span>{s.label}</span>
                            <Plus size={12} className="add-icon" />
                          </button>
                        );
                      })}
                    </div>
                  ) : null;
                })}
              </div>
              <div className="library-footer">
                <Shield size={15} />
                <div>
                  <strong>Governance by design</strong>
                  <small>Every decision leaves evidence.</small>
                </div>
              </div>
            </aside>
          )}
          <main className="canvas">
            <div className="canvas-view-actions"><button onClick={() => { select(null); setTimeout(() => void flow.fitView({ padding: 0.12, maxZoom: 1, duration: 350 }), 100); }}>Fit</button><span>{Math.round(zoom * 100)}%</span><button aria-label={canvasOnly ? "Exit canvas fullscreen" : "Canvas fullscreen"} title={canvasOnly ? "Exit fullscreen · Esc" : "Show only the workflow canvas"} onClick={() => void toggleCanvasOnly()}>{canvasOnly ? <Minimize2 size={14}/> : <Maximize2 size={14}/>}<span>{canvasOnly ? "Exit fullscreen" : "Fullscreen"}</span></button></div>
            <ReactFlow
              nodes={displayNodes}
              edges={edges}
              nodeTypes={nodeTypes}
              onNodesChange={editor.nodesChange}
              onEdgesChange={editor.edgesChange}
              onConnect={editor.connect}
              isValidConnection={validConnection}
              onNodeClick={(_, n) => canvasOnly ? setDetailedNode(n.id) : focusStep(n.id)}
              onPaneClick={() => select(null)}
              onNodeDragStart={() => {
                if (graph)
                  useEditor.setState({
                    past: [...editor.past, structuredClone(graph)],
                  });
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
              }}
              onDrop={(e) => {
                e.preventDefault();
                const kind = e.dataTransfer.getData("application/sentinel");
                if (registry[kind])
                  addNode(
                    kind,
                    flow.screenToFlowPosition({ x: e.clientX, y: e.clientY }),
                  );
              }}
              fitView
              fitViewOptions={{ padding: 0.1, maxZoom: 1 }}
              onMove={(_, viewport) => setZoom(viewport.zoom)}
              minZoom={0.25}
              maxZoom={1.8}
              deleteKeyCode={["Backspace", "Delete"]}
              colorMode={dark ? "dark" : "light"}
            >
              <Background
                variant={BackgroundVariant.Dots}
                gap={20}
                size={1}
                color={dark ? "#30343e" : "#c9cfde"}
              />
              <Controls showInteractive={false} />
              <MiniMap
                nodeColor="#757db6"
                maskColor={dark ? "#090b10b0" : "#f3f6f4b0"}
                pannable
                zoomable
              />
            </ReactFlow>
          </main>
          <Inspector
            registry={registry}
            run={run}
            events={events}
            onExpand={setDetailedNode}
            onSeek={(s) => setSeek(s)}
            onReview={onReview}
            reviews={reviews}
          />
        </div>
        {deploymentId && <div className="deployment-receipt">Guardrail deployment saved · {deploymentId.slice(0, 8)} <button onClick={() => void act(async () => {
          if (!window.confirm("Restore the prompt saved immediately before this deployment?")) return;
          await post(`/bolna/deployments/${deploymentId}/rollback`);
          setDeploymentId(null); message("Previous hosted prompt restored");
        })}>Roll back prompt</button></div>}
        <ExecutionConsole
          run={run}
          events={events}
          seek={seek}
          onReview={onReview}
          reviews={reviews}
          comparison={fixComparison}
          canFix={Boolean(agentNode) && !hardened && mode === "simulation"}
          onFix={fixAndRetest}
          hardenInfo={hardenInfo}
          onPush={hardenInfo?.agent_id ? pushGuardrails : undefined}
          onRefresh={() =>
            void act(async () => {
              await post(`/runs/${run!.id}/refresh`);
              setRun(await api<Run>(`/runs/${run!.id}`));
            })
          }
        />
      </div>
      {notice && (
        <div className={`toast ${notice.error ? "error" : ""}`} role="status">
          {notice.error ? <TriangleAlert size={18} /> : <Check size={18} />}
          <span>{notice.text}</span>
          <button
            onClick={() => setNotice(null)}
            aria-label="Dismiss notification"
          >
            <X size={14} />
          </button>
        </div>
      )}
      {detailedNode && graph && <NodeDetails nodeId={detailedNode} graph={graph} run={run} registry={registry} events={events} reviews={reviews} onSelect={setDetailedNode} onClose={closeNodeDetails} onReview={onReview} onSeek={setSeek}/>}
      {modal && (
        <div className="modal-backdrop" onClick={() => setModal(null)}>
          <section
            className={`modal modal-${modal}`}
            role="dialog"
            aria-modal="true"
            aria-label={modal}
            onClick={(e) => e.stopPropagation()}
          >
            <header>
              <div>
                <span className="eyebrow">SENTINEL WORKSPACE</span>
                <h2>
                  {
                    {
                      test: "Configure a test run",
                      settings: "Connections & settings",
                      history: "Execution history",
                      versions: "Workflow versions",
                      compare: "Compare executions",
                      recordings: "Recording evidence",
                    }[modal]
                  }
                </h2>
              </div>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Close dialog"
                onClick={() => setModal(null)}
              >
                <X size={20} />
              </Button>
            </header>
            <div className="modal-body">
              {modal === "test" && (
                <>
                  <label className="field">
                    Execution mode
                    <select
                      value={mode}
                      onChange={(e) => setMode(e.target.value)}
                    >
                      <option value="simulation">
                        Simulation — synthetic transcript
                      </option>
                      <option value="live">
                        Live — opted-in hosted phone call
                      </option>
                      <option value="audit">Audit — uploaded evidence</option>
                    </select>
                  </label>
                  <label className="field">
                    Scenario
                    <select
                      value={scenario}
                      onChange={(e) => setScenario(e.target.value)}
                    >
                      <option value="injection">
                        D · Authorization bypass
                      </option>
                      <option value="unauthorized">
                        C · Unauthorized information request
                      </option>
                      <option value="dispute">B · Payment dispute</option>
                      <option value="normal">A · Normal payment inquiry</option>
                    </select>
                  </label>
                  <div className="tip">
                    Seed: 42. LLM outputs may vary between runs. Live
                    phone calls require an opted-in participant; no autonomous
                    audio caller is connected.
                  </div>
                  {mode === "live" && (
                    <>
                      <label className="field">
                        Bolna agent ID
                        <input
                          value={agentId}
                          onChange={(e) => setAgentId(e.target.value)}
                        />
                      </label>
                      <label className="field">
                        Allowlisted recipient
                        <input
                          value={recipient}
                          onChange={(e) => setRecipient(e.target.value)}
                          placeholder="+91…"
                        />
                      </label>
                      <label className="toggle-field field">
                        <span>
                          This number belongs to an explicitly opted-in test
                          participant.
                        </span>
                        <input
                          type="checkbox"
                          checked={authorized}
                          onChange={(e) => setAuthorized(e.target.checked)}
                        />
                      </label>
                    </>
                  )}
                  {mode === "audit" && (
                    <label className="field">
                      Recording
                      <select
                        value={recordingId}
                        onChange={(e) => setRecordingId(e.target.value)}
                      >
                        <option value="">Select uploaded evidence</option>
                        {recordings.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  <Button variant="primary" disabled={busy || (mode === "live" && (!agentId || !recipient || !authorized)) || (mode === "audit" && !recordingId)} onClick={() => void act(async () => { await runTest(); setModal(null); })}>
                    <Play size={15} />
                    {mode === "live" ? "Place authorized call" : mode === "audit" ? "Start recording audit" : "Run simulation"}
                  </Button>
                </>
              )}
              {modal === "settings" && (
                <>
                  {settings?.byok && (
                    <KeyForm
                      onSaved={() => void api<Settings>("/settings").then(setSettings).catch(() => {})}
                    />
                  )}
                  <div className="connection-card">
                    <span className="node-icon">
                      <Link2 size={22} />
                    </span>
                    <div>
                      <strong>Bolna hosted</strong>
                      <p>
                        {settings?.bolna_configured
                          ? "Server credentials configured"
                          : settings?.byok ? "Add your Bolna key above" : "Add BOLNA_API_KEY to the server environment"}
                      </p>
                    </div>
                    <span
                      className={`badge ${settings?.bolna_configured ? "live" : ""}`}
                    >
                      {settings?.bolna_configured
                        ? "Configured"
                        : "Not connected"}
                    </span>
                  </div>
                  <label className="field">
                    Agent ID
                    <input
                      value={agentId}
                      onChange={(e) => setAgentId(e.target.value)}
                      placeholder="Your Bolna agent identifier"
                    />
                  </label>
                  <Button disabled={busy || !settings?.bolna_configured} onClick={() => void act(async () => {
                    const result = await api<{agents: {id: string; name: string}[]}>("/bolna/agents");
                    setAvailableAgents(result.agents);
                    if (!result.agents.length) message("No agents found in this Bolna account.");
                  })}>Browse Bolna agents</Button>
                  {availableAgents.length > 0 && <label className="field">Available agents<select value={agentId} onChange={e => { setAgentId(e.target.value); setAgentName(""); }}><option value="">Select an agent to connect</option>{availableAgents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>}
                  <Button
                    disabled={busy || !agentId}
                    onClick={() =>
                      void act(async () => {
                        const a = await api<{ name: string }>(
                          `/agents/${encodeURIComponent(agentId)}`,
                        );
                        setAgentName(a.name);
                        message(`Connected ${a.name}`);
                      })
                    }
                  >
                    <Link2 size={14} />
                    Verify & connect agent
                  </Button>
                  {agentName && (
                    <p className="success-text">Connected: {agentName}</p>
                  )}
                  <div className="connection-card">
                    <SparklesIcon />
                    <div>
                      <strong>Semantic evaluator & transcription</strong>
                      <p>
                        {settings?.semantic_configured
                          ? `${settings.semantic_providers.join(" + ")} credentials configured`
                          : "Optional · requires server-side GROQ_API_KEY or OPENAI_API_KEY"}
                      </p>
                    </div>
                  </div>
                  <div className="section-label">INTEGRATION BOUNDARIES</div>
                  {settings?.limitations.map((s) => (
                    <p className="limitation" key={s}>
                      <Check size={14} />
                      {s}
                    </p>
                  ))}
                  <div className="tip">
                    Single-user local workspace. Keep API keys on the server.
                    Shared deployment requires an authenticated reverse proxy
                    and a tenant model.
                  </div>
                </>
              )}
              {modal === "history" && (
                <>
                  {!runs.length ? (
                    <div className="empty">
                      No runs yet. Execute your first workflow.
                    </div>
                  ) : (
                    runs.map((r) => (
                      <div className="history-row" key={r.id}>
                        <button
                          onClick={() =>
                            void act(async () => {
                              const full = await api<Run>(`/runs/${r.id}`);
                              if (dirty) await save();
                              load(full.graph);
                              setRun(full);
                              setHome(false);
                              setMode(full.mode);
                              setModal(null);
                              setTimeout(
                                () => flow.fitView({ padding: 0.15 }),
                                50,
                              );
                            })
                          }
                        >
                          <span className={`dot ${r.status}`} />
                          <div>
                            <strong>
                              {r.request.scenario.replaceAll("_", " ")}{" "}
                              <span className="badge">v{r.version}</span>
                            </strong>
                            <small>
                              {new Date(r.created_at * 1000).toLocaleString()} ·{" "}
                              {r.id.slice(0, 8)}
                            </small>
                          </div>
                          <span className="badge simulation">{r.mode}</span>
                          <span>{r.status}</span>
                          <ArrowUpRight size={15} />
                        </button>
                        {[
                          "completed",
                          "failed",
                          "cancelled",
                          "interrupted",
                        ].includes(r.status) && (
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Delete run ${r.id.slice(0, 8)}`}
                            onClick={() =>
                              void act(async () => {
                                await api(`/runs/${r.id}`, {
                                  method: "DELETE",
                                });
                                setRuns(await api<RunSummary[]>("/runs"));
                                if (run?.id === r.id) setRun(null);
                                message("Run evidence deleted");
                              })
                            }
                          >
                            <Trash2 size={14} />
                          </Button>
                        )}
                      </div>
                    ))
                  )}
                </>
              )}
              {modal === "versions" && (
                <>
                  {versions.map((v) => (
                    <div className="version-row" key={v.version}>
                      <div>
                        <strong>Version {v.version}</strong>
                        <p>
                          {v.nodes.length} nodes · {v.edges.length} connections
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        onClick={() =>
                          void act(async () => {
                            const latest = await api<Graph>(
                              `/workflows/${graph!.id}`,
                            );
                            load({ ...v, version: latest.version });
                            edit({ name: v.name });
                            setRun(null);
                            setModal(null);
                            message(
                              `Version ${v.version} restored into a draft. Save to create a new version.`,
                            );
                          })
                        }
                      >
                        Restore as draft
                      </Button>
                    </div>
                  ))}
                </>
              )}
              {modal === "compare" && (
                <>
                  <p className="description">
                    Compare two recorded runs of the same scenario. Historical
                    evidence is never rewritten.
                  </p>
                  <div className="compare-pickers">
                    {["Before", "After"].map((label, i) => (
                      <label className="field" key={label}>
                        {label}
                        <select
                          aria-label={label}
                          value={compareIds[i] || ""}
                          onChange={(e) => {
                            const ids = [...compareIds];
                            ids[i] = e.target.value;
                            setCompareIds(ids);
                            setComparison(null);
                          }}
                        >
                          <option value="">Select run</option>
                          {runs.map((r) => (
                            <option key={r.id} value={r.id}>
                              v{r.version} · {r.request.scenario} ·{" "}
                              {r.id.slice(0, 8)}
                            </option>
                          ))}
                        </select>
                      </label>
                    ))}
                  </div>
                  <Button
                    variant="primary"
                    disabled={
                      compareIds.length !== 2 ||
                      !compareIds[0] ||
                      !compareIds[1]
                    }
                    onClick={() =>
                      void act(async () =>
                        setComparison(
                          await api<Comparison>(
                            `/compare?before=${compareIds[0]}&after=${compareIds[1]}`,
                          ),
                        ),
                      )
                    }
                  >
                    <GitCompareArrows size={15} />
                    Compare results
                  </Button>
                  {comparison && (
                    <>
                      <div className="comparison-grid">
                        {(["before", "after"] as const).map((k) => (
                          <div className="comparison-result" key={k}>
                            <span className="eyebrow">{k}</span>
                            <h3
                              className={
                                comparison[k].passed
                                  ? "success-text"
                                  : "warning-text"
                              }
                            >
                              {comparison[k].passed ? "Passed" : "Needs review"}
                            </h3>
                            <strong>
                              {comparison[k].findings.length} findings
                            </strong>
                            <p>
                              {comparison[k].duration_ms} ms observed latency
                            </p>
                            <p>Cost unavailable</p>
                            {comparison[k].findings.map((f) => (
                              <small key={f.id}>{f.policy_id}</small>
                            ))}
                            {comparison[k].unsupported.map((s) => (
                              <small key={s}>Not evaluated: {s}</small>
                            ))}
                          </div>
                        ))}
                      </div>
                      <div className="tip">
                        {comparison.resolved.length} resolved ·{" "}
                        {comparison.new.length} new ·{" "}
                        {comparison.changed_nodes.length} changed nodes.
                        {!comparison.comparable &&
                          " Different workflow, mode, scenario, or seed: this is not a controlled regression comparison."}
                      </div>
                    </>
                  )}
                </>
              )}
              {modal === "recordings" && (
                <>
                  {recentCalls.some((c) => c.has_transcript) && (
                    <div className="recent-calls">
                      <div className="section-label">RECENT CALLS · {agentName || "BOLNA AGENT"}</div>
                      {recentCalls.filter((c) => c.has_transcript).map((c) => (
                        <div className="version-row" key={c.id}>
                          <span>
                            <FileAudio size={15} /> {new Date(c.created_at).toLocaleString()} · {c.duration ? `${Math.round(c.duration)}s` : c.status}
                          </span>
                          <Button variant="primary" disabled={busy} onClick={() => void act(async () => {
                            const artifact = await api<{ id: string }>(`/bolna/executions/${encodeURIComponent(c.id)}/import`, { method: "POST" });
                            setRecordings(await api("/recordings"));
                            setRecordingId(artifact.id);
                            await switchWorkflow("audit");
                            const g = useEditor.getState().graph!;
                            const started = await post<Run>("/runs", { workflow_id: g.id, version: g.version, mode: "audit", scenario: "injection", seed: 42, recording_id: artifact.id });
                            setRun(started);
                            setModal(null);
                            message("Auditing the real call: transcript, recording and LLM judge");
                          })}>
                            <ShieldCheckIcon /> Audit this call
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="import-call">
                    <label htmlFor="execution-import">Import a completed Bolna call</label>
                    <div><input id="execution-import" placeholder="Paste the execution ID from Bolna Call History" value={executionId} onChange={e => setExecutionId(e.target.value)}/><Button disabled={busy || !executionId.trim()} onClick={() => void act(async () => {
                      const result = await api<{ id: string }>(`/bolna/executions/${encodeURIComponent(executionId.trim())}/import`, { method: "POST" });
                      setRecordings(await api("/recordings"));
                      setRecordingId(result.id);
                      setExecutionId("");
                      message("Call imported. Select Use in audit to inspect its evidence.");
                    })}>Import call</Button></div>
                    <p>The server fetches the actual provider transcript. Your API key stays on the server.</p>
                  </div>
                  <p className="description">
                    Upload timestamped transcript JSON for offline auditing, or
                    audio for provider transcription. Audio may contain
                    sensitive information and is sent to the configured
                    provider.
                  </p>
                  <label className="upload-area">
                    <Upload size={26} />
                    <strong>Choose an evidence file</strong>
                    <span>JSON, WAV, MP3, M4A, WebM · up to 20 MB</span>
                    <input
                      type="file"
                      accept=".json,.wav,.mp3,.m4a,.webm"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f)
                          void act(async () => {
                            const data = new FormData();
                            data.append("file", f);
                            const r = await api<{ id: string; name: string }>(
                              "/recordings",
                              { method: "POST", body: data },
                            );
                            setRecordings(await api("/recordings"));
                            setRecordingId(r.id);
                            message(`Evidence uploaded: ${r.name}`);
                          });
                      }}
                    />
                  </label>
                  {recordings.map((r) => (
                    <div className="version-row" key={r.id}>
                      <span>
                        <FileAudio size={15} /> {r.name}
                      </span>
                      <div className="inline-actions">
                        <Button
                          onClick={() =>
                            void act(async () => {
                              await switchWorkflow("audit");
                              setRecordingId(r.id);
                              setModal(null);
                            })
                          }
                        >
                          Use in audit
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Delete ${r.name}`}
                          onClick={() =>
                            void act(async () => {
                              await api(`/recordings/${r.id}`, {
                                method: "DELETE",
                              });
                              setRecordings(await api("/recordings"));
                              if (recordingId === r.id) setRecordingId("");
                              message(
                                "Recording deleted. Existing run evidence is retained until you delete those runs.",
                              );
                            })
                          }
                        >
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    </div>
                  ))}
                  <div className="tip">
                    Offline sample: examples/recording-transcript.json in the
                    project. Audio is only shown when an actual artifact exists.
                  </div>
                </>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
function ShieldCheckIcon() {
  return <Shield size={14} />;
}
function SparklesIcon() {
  return (
    <span className="node-icon">
      <SlidersHorizontal size={22} />
    </span>
  );
}
export default function WorkspaceRoot() {
  return (
    <ReactFlowProvider>
      <Workspace />
    </ReactFlowProvider>
  );
}
