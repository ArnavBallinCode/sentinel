"use client";
import { appPath } from "@/lib/paths";
import { Shield, Workflow, AudioLines, FileAudio, History, GitCompareArrows, Sun, Moon, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import type { Graph } from "@/lib/types";

const templates = [
  { id: "adversarial", label: "Agent stress test", detail: "Challenge · detect · retest", Icon: Shield },
  { id: "voice", label: "Live voice call", detail: "Connect · call · inspect", Icon: AudioLines },
  { id: "audit", label: "Call audit", detail: "Import · redact · review", Icon: FileAudio },
];
export function WorkbenchNavigation({ graph, onSwitch, onOpen, dark, onTheme, connected, home, onHome, collapsed, onCollapse }: {
  graph: Graph | null; onSwitch: (id: string) => void; onOpen: (name: string) => void;
  dark: boolean; onTheme: () => void; connected: boolean;
  home: boolean; onHome: () => void;
  collapsed: boolean; onCollapse: () => void;
}) {
  return <nav className={`workbench-nav ${collapsed ? "is-collapsed" : ""}`} aria-label="Workspace navigation">
    <button className="sidebar-toggle" aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} title={collapsed ? "Expand sidebar" : "Collapse sidebar"} onClick={onCollapse}>{collapsed ? <PanelLeftOpen size={16}/> : <PanelLeftClose size={16}/>}</button>
    <a href={appPath("/")} className="workspace-brand"><span><Shield size={23}/></span><strong>sentinel<span className="brand-dot">.</span></strong></a>
    <div className="workspace-caption">VOICE AGENT RED-TEAM</div>
    <button aria-label="Overview" className={`workspace-link ${home ? "active" : ""}`} onClick={onHome}><Workflow size={19}/><span>Overview</span></button>
    <a className="workspace-link" href={appPath("/demo")} aria-label="Demo studio"><Shield size={19}/><span><strong>Demo studio</strong><small>Release checks · evidence</small></span></a>
    <div className="nav-section-label">BUILD & TEST</div>
    {templates.map(({id, label, detail, Icon}) => <button key={id} title={label} aria-label={`${label} ${detail}`} onClick={() => onSwitch(id)} className={`workspace-link ${!home && graph?.id === id ? "active" : ""}`} aria-current={!home && graph?.id === id ? "page" : undefined}>
      <Icon size={19}/><span><strong>{label}</strong><small>{detail}</small></span>
    </button>)}
    <div className="nav-section-label">OBSERVE & IMPROVE</div>
    <button className="workspace-link" onClick={() => onOpen("history")} aria-label="Execution history"><History size={18}/><span>Run history</span></button>
    <button className="workspace-link" onClick={() => onOpen("compare")} aria-label="Regression comparison"><GitCompareArrows size={18}/><span>Compare runs</span></button>
    <button className="workspace-link" onClick={() => onOpen("recordings")} aria-label="Recording audits"><FileAudio size={18}/><span>Recordings</span></button>
    <div className="nav-bottom">
      <button className="workspace-link" onClick={() => onOpen("settings")} aria-label="Connections"><span className={`dot ${connected ? "completed" : "warning"}`}/><span>{connected ? "Bolna configured" : "Connect Bolna"}</span></button>
      <button className="workspace-link" onClick={onTheme} aria-label="Toggle theme">{dark ? <Sun size={18}/> : <Moon size={18}/>}<span>{dark ? "Light mode" : "Dark mode"}</span></button>
    </div>
  </nav>;
}
