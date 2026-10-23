"use client";
import { useState } from "react";
import { ArrowRight, Search } from "lucide-react";
import type { Spec } from "@/lib/types";
import { nodeGuides } from "@/lib/node-guide";
import { icons } from "./workflow-node";

export function CapabilityExplorer({registry, onExplore}: {registry: Record<string, Spec>; onExplore: (kind: string) => void}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const categories = ["All", ...new Set(Object.values(registry).map(s => s.category))];
  const nodes = Object.entries(registry).filter(([kind, spec]) => (category === "All" || spec.category === category) && `${spec.label} ${spec.description} ${nodeGuides[kind]?.purpose}`.toLowerCase().includes(query.toLowerCase()));
  return <section className="capability-explorer" id="capabilities"><div className="section-heading"><div><span className="intro-tag">EVERY BUILDING BLOCK, EXPLAINED</span><h2>Explore all {Object.keys(registry).length} pipeline capabilities.</h2></div><label className="capability-search"><Search size={15}/><input aria-label="Search capabilities" placeholder="Find a feature…" value={query} onChange={e => setQuery(e.target.value)}/></label></div><p className="description">Open a capability to see its purpose, the exact steps it performs, its limits, and where to use it. This catalog comes from the running backend’s node registry.</p><div className="capability-filters">{categories.map(c => <button className={category === c ? "active" : ""} key={c} onClick={() => setCategory(c)}>{c}</button>)}</div><div className="capability-catalog">{nodes.map(([kind, spec]) => {
    const Icon = icons[kind], guide = nodeGuides[kind];
    return <details key={kind} className="catalog-item"><summary><span className={`node-icon category-${spec.category.split(" ")[0].toLowerCase()}`}>{Icon && <Icon size={19}/>}</span><div><strong>{spec.label}</strong><small>{spec.category}</small></div><span className="catalog-plus">+</span></summary><div className="catalog-description"><p>{guide?.purpose || spec.description}</p><ol>{guide?.process.map(step => <li key={step}>{step}</li>)}</ol><div className="mode-list">{spec.modes.map(mode => <span className="badge" key={mode}>{mode}</span>)}</div><p className="catalog-boundary">{guide?.boundary}</p><button onClick={() => onExplore(kind)}>Explore in pipeline <ArrowRight size={14}/></button></div></details>;
  })}</div>{!nodes.length && <p className="detail-empty">No matching capabilities. Try another search or category.</p>}</section>;
}
