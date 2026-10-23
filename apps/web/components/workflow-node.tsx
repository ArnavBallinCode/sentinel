"use client";
import { Handle, Position, useUpdateNodeInternals, type NodeProps } from "@xyflow/react";
import { useEffect } from "react";
import {
  Play,
  AudioLines,
  Sparkles,
  ShieldCheck,
  GitBranch,
  FileText,
  Clock,
  UserRound,
  ScanText,
  Check,
  LoaderCircle,
  TriangleAlert,
  OctagonX,
  Minus,
  Webhook,
  Maximize2,
} from "lucide-react";
import type { FlowNode } from "@/lib/types";
export const icons: Record<string, typeof Play> = {
  manual: Play,
  recording: AudioLines,
  scenario: Sparkles,
  caller: UserRound,
  bolna: AudioLines,
  normalize: ScanText,
  coverage: ScanText,
  tool_auth: ShieldCheck,
  policy: ShieldCheck,
  pii: ShieldCheck,
  semantic: Sparkles,
  condition: GitBranch,
  wait: Clock,
  merge: GitBranch,
  review: UserRound,
  report: FileText,
  end: Check,
};
export function WorkflowNode({ id, data, selected }: NodeProps<FlowNode>) {
  const updateInternals = useUpdateNodeInternals();
  useEffect(() => { updateInternals(id); }, [id, data.sourceSide, data.targetSide, updateInternals]);
  const Icon = icons[data.kind || ""] || Webhook;
  const state = data.status || "idle";
  const StateIcon =
    state === "running"
      ? LoaderCircle
      : state === "completed"
        ? Check
        : state === "warning"
          ? TriangleAlert
          : state === "failed"
            ? OctagonX
            : Minus;
  return (
    <div
      className={`workflow-node ${selected ? "selected" : ""} state-${state}`}
    >
      {!["manual", "recording"].includes(data.kind || "") && (
        <Handle type="target" position={(data.targetSide || "top") as Position} id="in" />
      )}
      <div className="node-heading">
        <span
          className={`node-icon category-${(data.category || "").split(" ")[0].toLowerCase()}`}
        >
          <Icon size={20} />
        </span>
        <div>
          <span className="node-category">{data.category}</span>
          <strong>{data.label}</strong>
        </div>
        <button className="node-expand nodrag nopan" aria-label={`Expand ${data.label}`} title="Open step details & trace" onClick={e => { e.stopPropagation(); data.onExpand?.(); }}><Maximize2 size={12}/></button>
      </div>
      {data.preview && <div className="node-preview">{data.preview}</div>}
      <div className={`node-status ${state}`}>
        <span>
          <StateIcon size={12} className={state === "running" ? "spin" : ""} />
          {state === "idle" ? "Ready" : state}
        </span>
        <span>
          {data.findings
            ? `${data.findings} findings`
            : data.duration_ms !== undefined
              ? `${data.duration_ms} ms`
              : ""}
        </span>
      </div>
      {data.kind === "condition" ? (
        <>
          <Handle
            type="source"
            position={(data.sourceSide || "right") as Position}
            id="pass"
          />
          <Handle
            type="source"
            position={Position.Bottom}
            id="fail"
          />
        </>
      ) : (
        data.kind !== "end" && (
          <Handle type="source" position={(data.sourceSide || "bottom") as Position} id="out" />
        )
      )}
    </div>
  );
}
