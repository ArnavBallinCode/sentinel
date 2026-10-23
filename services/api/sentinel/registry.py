from .models import Graph


def field(type, default, description, **kw):
    return {"type": type, "default": default, "description": description, **kw}


def spec(
    label,
    category,
    description,
    consumes="context",
    produces="context",
    fields=None,
    modes=None,
):
    return {
        "label": label,
        "category": category,
        "description": description,
        "input_schema": {"type": consumes},
        "output_schema": {"type": produces},
        "config_schema": fields or {},
        "modes": modes or ["simulation", "live", "audit"],
        "retry_safe": True,
    }


REGISTRY = {
    "manual": spec("Manual trigger", "Triggers", "Start a reproducible test", "none"),
    "recording": spec(
        "Recording uploaded",
        "Triggers",
        "Use an uploaded transcript or recording",
        "none",
        "transcript",
        modes=["audit"],
    ),
    "scenario": spec(
        "Scenario generator",
        "AI & testing",
        "Seeded, authored adversarial scenarios",
        fields={
            "language": field(
                "string", "en", "Conversation language", enum=["en", "hi"]
            )
        },
        modes=["simulation", "live"],
    ),
    "caller": spec(
        "Simulated caller",
        "AI & testing",
        "Create the synthetic caller prompt",
        modes=["simulation"],
    ),
    "bolna": spec(
        "Bolna agent",
        "Voice & speech",
        "Hosted call or explicit transcript simulation",
        produces="transcript",
        fields={
            "safe_agent": field(
                "boolean", False, "Hardened: apply the Sentinel guardrail patch (simulation only)"
            ),
            "agent_id": field("string", "", "Hosted Bolna agent ID"),
            "engine": field("string", "llm", "Simulation engine: LLM red-team or scripted fixture", enum=["llm", "scripted"]),
            "turns": field("number", 3, "Caller turns in an LLM red-team conversation", minimum=1, maximum=6),
            "agent_prompt": field("string", "", "System prompt override (empty: fetch from the Bolna agent)", multiline=True),
            "prompt_patch": field("string", "", "Sentinel guardrail patch applied when hardened", multiline=True),
        },
        modes=["simulation", "live"],
    ),
    "normalize": spec(
        "Transcript normalizer",
        "Voice & speech",
        "Normalize provider transcript segments",
        "transcript",
        "transcript",
    ),
    "coverage": spec(
        "Coverage check",
        "Auditing",
        "Identify timestamp gaps; not acoustic verification",
        "transcript",
        "transcript",
        {
            "max_gap": field(
                "number", 5, "Maximum segment gap in seconds", minimum=0, maximum=60
            )
        },
    ),
    "tool_auth": spec(
        "Tool authorization",
        "Governance",
        "Enforce identity at Sentinel-owned tools",
        "transcript",
        "transcript",
    ),
    "policy": spec(
        "Policy evaluation",
        "Governance",
        "Evidence-linked deterministic assertions",
        "transcript",
        "findings",
        {
            "identity": field("boolean", True, "Detect unauthorized account requests"),
            "escalation": field("boolean", True, "Require escalation for disputes"),
            "consent": field("boolean", True, "Detect ignored contact preferences"),
        },
    ),
    "pii": spec(
        "PII detection",
        "Governance",
        "Detect redacted PII evidence; heuristic review",
        "transcript",
        "transcript",
    ),
    "semantic": spec(
        "LLM evaluator",
        "AI & testing",
        "Groq or OpenAI evaluation with validated citations",
        "transcript",
        "findings",
        modes=["live", "audit"],
    ),
    "condition": spec(
        "Pass / needs review",
        "Logic",
        "Branch on evaluated findings",
        "findings",
        "context",
    ),
    "wait": spec(
        "Wait",
        "Logic",
        "Bounded cancellable delay",
        fields={
            "seconds": field(
                "number", 1, "Wait duration in seconds", minimum=0, maximum=30
            )
        },
    ),
    "merge": spec("Merge", "Logic", "Join active branches"),
    "review": spec(
        "Human review",
        "Auditing",
        "Flag findings for human review",
        "context",
        "context",
    ),
    "report": spec(
        "Audit report", "Auditing", "Persist an evidence-backed JSON report"
    ),
    "end": spec("End", "Logic", "Finish this branch"),
}

# Only local/idempotent handlers accept automatic retries. Provider call creation never does.
for _kind in (
    "normalize",
    "coverage",
    "policy",
    "pii",
    "wait",
    "report",
    "scenario",
    "caller",
):
    REGISTRY[_kind]["config_schema"].update(
        {
            "max_attempts": field(
                "number", 1, "Maximum execution attempts", minimum=1, maximum=3
            ),
            "timeout_seconds": field(
                "number", 60, "Per-attempt timeout in seconds", minimum=1, maximum=60
            ),
        }
    )


def validate(graph: Graph, mode=None):
    errors = []
    nodes = {n.id: n for n in graph.nodes}
    if len(nodes) != len(graph.nodes):
        errors.append("Node IDs must be unique.")
    incoming = {id: [] for id in nodes}
    outgoing = {id: [] for id in nodes}
    pairs = set()
    for n in graph.nodes:
        if n.type not in REGISTRY:
            errors.append(f"{n.id}: unsupported node type.")
            continue
        s = REGISTRY[n.type]
        if mode and mode not in s["modes"]:
            errors.append(f"{s['label']} does not support {mode} mode.")
        cfg = n.data.get("config", {})
        if not isinstance(cfg, dict):
            errors.append(f"{n.id}: config must be an object.")
            continue
        for key, val in cfg.items():
            f = s["config_schema"].get(key)
            if not f:
                errors.append(f"{n.id}: unknown setting {key}.")
                continue
            valid = (
                isinstance(val, bool)
                if f["type"] == "boolean"
                else (isinstance(val, (int, float)) and not isinstance(val, bool))
                if f["type"] == "number"
                else isinstance(val, str)
            )
            if not valid:
                errors.append(f"{n.id}: invalid {key}.")
                continue
            if "enum" in f and val not in f["enum"]:
                errors.append(f"{n.id}: invalid {key} option.")
            if key == "max_attempts" and val != int(val):
                errors.append(f"{n.id}: attempts must be an integer.")
            if f["type"] == "number" and not f.get("minimum", 0) <= val <= f.get(
                "maximum", 1000
            ):
                errors.append(f"{n.id}: {key} out of bounds.")
    for e in graph.edges:
        if e.source not in nodes or e.target not in nodes:
            errors.append("Dangling edge reference.")
            continue
        if (e.source, e.target, e.sourceHandle) in pairs:
            errors.append("Duplicate edge.")
        pairs.add((e.source, e.target, e.sourceHandle))
        incoming[e.target].append(e)
        outgoing[e.source].append(e)
        src = nodes[e.source]
        dst = nodes[e.target]
        if src.type == "condition" and e.sourceHandle not in ("pass", "fail"):
            errors.append("Condition edges require pass or fail handles.")
        if src.type != "condition" and e.sourceHandle not in (None, "out"):
            errors.append("Invalid source handle.")
        if e.targetHandle not in (None, "in"):
            errors.append("Invalid target handle.")
        if dst.type in ("manual", "recording"):
            errors.append("Triggers cannot have incoming edges.")
        need = REGISTRY.get(dst.type, {}).get("input_schema", {}).get("type")
        have = REGISTRY.get(src.type, {}).get("output_schema", {}).get("type")
        if need == "transcript" and have != "transcript":
            errors.append(f"{dst.id} requires a transcript-producing predecessor.")
        if need == "findings" and have != "findings":
            errors.append(f"{dst.id} requires evaluation results.")
    roots = [id for id in nodes if not incoming[id]]
    if len(roots) != 1 or (
        roots and nodes[roots[0]].type not in ("manual", "recording")
    ):
        errors.append("Use exactly one connected trigger.")
    counts = {id: len(v) for id, v in incoming.items()}
    queue = roots[:]
    order = []
    while queue:
        id = queue.pop(0)
        order.append(id)
        for e in outgoing[id]:
            counts[e.target] -= 1
            if counts[e.target] == 0:
                queue.append(e.target)
    if len(order) != len(nodes):
        errors.append("Cycles are not supported. Use bounded retry policies.")
    if len({e.id for e in graph.edges}) != len(graph.edges):
        errors.append("Edge IDs must be unique.")
    return {"valid": not errors, "errors": errors, "order": order}


def template(kind):
    kinds = {
        "adversarial": [
            "manual",
            "scenario",
            "caller",
            "bolna",
            "tool_auth",
            "policy",
            "condition",
            "report",
            "review",
        ],
        "voice": ["manual", "bolna", "tool_auth", "policy", "report"],
        "audit": ["recording", "normalize", "coverage", "pii", "policy", "review", "report"],
    }
    types = kinds[kind]
    nodes = []
    edges = []
    for i, t in enumerate(types):
        cfg = {k: v["default"] for k, v in REGISTRY[t]["config_schema"].items()}
        nodes.append(
            {
                "id": f"n{i}",
                "type": t,
                "position": {"x": (2 - i % 3 if (i // 3) % 2 else i % 3) * 370, "y": (i // 3) * 250},
                "data": {"label": REGISTRY[t]["label"], "config": cfg},
            }
        )
        if i:
            edges.append({"id": f"e{i}", "source": f"n{i - 1}", "target": f"n{i}"})
    if kind == "adversarial":
        edges = edges[:6] + [
            {"id": "pass", "source": "n6", "target": "n7", "sourceHandle": "pass"},
            {"id": "fail", "source": "n6", "target": "n8", "sourceHandle": "fail"},
        ]
    return {
        "id": kind,
        "name": {
            "adversarial": "Bolna Agent Security Test",
            "voice": "Voice Agent Governance",
            "audit": "Recording Compliance Audit",
        }[kind],
        "version": 1,
        "published": False,
        "nodes": nodes,
        "edges": edges,
    }
