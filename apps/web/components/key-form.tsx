"use client";
import { useState } from "react";
import { KeyRound } from "lucide-react";
import { getKeys, saveKeys, type KeyName } from "@/lib/api";

const fields: { name: KeyName; label: string; hint: string }[] = [
  { name: "groq", label: "Groq API key", hint: "Free at console.groq.com. Runs the attacker, agent and judge models." },
  { name: "openai", label: "OpenAI API key (optional)", hint: "Used instead of Groq if you prefer." },
  { name: "bolna", label: "Bolna API key (optional)", hint: "Lets you browse your agents, test their prompts and audit completed calls." },
];

export function KeyForm({ onSaved }: { onSaved: () => void }) {
  const [values, setValues] = useState<Partial<Record<KeyName, string>>>(() => getKeys());
  const [saved, setSaved] = useState(false);
  return (
    <form
      className="key-form"
      onSubmit={(e) => {
        e.preventDefault();
        saveKeys(values);
        setSaved(true);
        onSaved();
      }}
    >
      <div className="key-form-title"><KeyRound size={16} /> Bring your own keys</div>
      <p>
        Keys stay in this browser tab and are sent over HTTPS with each request. The server never stores or logs them, and
        your runs are visible only to you. Phone calls and changes to a hosted agent are disabled in this public demo.
      </p>
      {fields.map((f) => (
        <label key={f.name} className="field">
          {f.label}
          <input
            type="password"
            autoComplete="off"
            spellCheck={false}
            value={values[f.name] || ""}
            placeholder={f.hint}
            onChange={(e) => { setSaved(false); setValues({ ...values, [f.name]: e.target.value }); }}
          />
        </label>
      ))}
      <button type="submit" className="button button-primary studio-primary">{saved ? "Saved for this tab" : "Use these keys"}</button>
    </form>
  );
}
