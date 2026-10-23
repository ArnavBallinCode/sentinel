import { create } from "zustand";
import type { Graph, FlowNode } from "./types";
import {
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  type NodeChange,
  type EdgeChange,
  type Connection,
} from "@xyflow/react";
type State = {
  graph: Graph | null;
  selected: string | null;
  dirty: boolean;
  past: Graph[];
  future: Graph[];
  load: (g: Graph) => void;
  select: (id: string | null) => void;
  edit: (patch: Partial<Graph>, history?: boolean) => void;
  nodesChange: (c: NodeChange<FlowNode>[]) => void;
  edgesChange: (c: EdgeChange[]) => void;
  connect: (c: Connection) => void;
  undo: () => void;
  redo: () => void;
  layout: () => void;
  duplicate: () => void;
};
const clone = (g: Graph) => structuredClone(g);
// Fold the topological path into rows so an overview remains readable at normal zoom.
export function executionOrder(graph: Graph): string[] {
  const remaining = new Set(graph.nodes.map((n) => n.id));
  const ordered: string[] = [];
  while (remaining.size) {
    const ready = [...remaining].filter((id) => !graph.edges.some((e) => e.target === id && remaining.has(e.source)));
    if (!ready.length) { ordered.push(...remaining); break; }
    for (const id of ready) { ordered.push(id); remaining.delete(id); }
  }
  return ordered;
}
export function arrangeGraph(graph: Graph): Graph {
  const ordered = executionOrder(graph);
  return { ...graph, nodes: graph.nodes.map((node) => {
    const index = ordered.indexOf(node.id), row = Math.floor(index / 3);
    const column = row % 2 ? 2 - index % 3 : index % 3;
    return { ...node, position: { x: column * 370, y: row * 250 } };
  }) };
}
export const useEditor = create<State>((set, get) => ({
  graph: null,
  selected: null,
  dirty: false,
  past: [],
  future: [],
  load: (g) =>
    set((s) => ({
      // Keep React Flow's measurements for nodes that stay mounted; without them the nodes stay
      // hidden until their DOM size changes, because the ResizeObserver does not fire again.
      graph: {
        ...g,
        nodes: g.nodes.map((n) => {
          const prev = s.graph?.nodes.find((p) => p.id === n.id);
          return prev?.measured && !n.measured ? { ...n, measured: prev.measured } : n;
        }),
      },
      dirty: false,
      past: [],
      future: [],
      selected: null,
    })),
  select: (selected) => set({ selected }),
  edit: (patch, history = true) =>
    set((s) =>
      s.graph
        ? {
            graph: { ...s.graph, ...patch },
            dirty: true,
            past: history ? [...s.past.slice(-39), clone(s.graph)] : s.past,
            future: history ? [] : s.future,
          }
        : s,
    ),
  nodesChange: (c) => {
    const s = get();
    if (!s.graph) return;
    const meaningful = c.some(
      (x) => x.type !== "select" && x.type !== "dimensions",
    );
    if (!meaningful) {
      set({ graph: { ...s.graph, nodes: applyNodeChanges(c, s.graph.nodes) } });
      return;
    }
    s.edit(
      {
        nodes: applyNodeChanges(c, s.graph.nodes),
        edges: s.graph.edges.filter(
          (e) =>
            !c.some(
              (x) =>
                x.type === "remove" && (x.id === e.source || x.id === e.target),
            ),
        ),
      },
      !c.every((x) => x.type === "position" && x.dragging),
    );
  },
  edgesChange: (c) => {
    const s = get();
    if (s.graph)
      s.edit(
        { edges: applyEdgeChanges(c, s.graph.edges) },
        c.some((x) => x.type !== "select"),
      );
  },
  connect: (c) => {
    const s = get();
    if (s.graph)
      s.edit({
        edges: addEdge({ ...c, id: crypto.randomUUID() }, s.graph.edges),
      });
  },
  undo: () =>
    set((s) =>
      !s.graph || !s.past.length
        ? s
        : {
            graph: s.past.at(-1)!,
            past: s.past.slice(0, -1),
            future: [clone(s.graph), ...s.future],
            dirty: true,
          },
    ),
  redo: () =>
    set((s) =>
      !s.graph || !s.future.length
        ? s
        : {
            graph: s.future[0],
            future: s.future.slice(1),
            past: [...s.past, clone(s.graph)],
            dirty: true,
          },
    ),
  layout: () => {
    const s = get();
    if (!s.graph) return;
    s.edit({ nodes: arrangeGraph(s.graph).nodes });
  },
  duplicate: () => {
    const s = get();
    if (!s.graph) return;
    const n = s.graph.nodes.find((n) => n.id === s.selected);
    if (n)
      s.edit({
        nodes: [
          ...s.graph.nodes,
          {
            ...clone(s.graph).nodes.find((x) => x.id === n.id)!,
            id: crypto.randomUUID(),
            position: { x: n.position.x + 40, y: n.position.y + 40 },
          },
        ],
      });
  },
}));
