"""Explicit local retention maintenance. Dry-run by default; never removes running/waiting runs."""

import argparse, time, sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "services/api"))
from sentinel import store
from sqlalchemy import text

p = argparse.ArgumentParser()
p.add_argument("--days", type=int, required=True)
p.add_argument("--apply", action="store_true")
args = p.parse_args()
if args.days < 1:
    p.error("--days must be positive")
store.init_db()
cutoff = time.time() - args.days * 86400
runs = [
    r
    for r in store.all_docs("run")
    if r["created_at"] < cutoff
    and r["status"] in ("completed", "failed", "cancelled", "interrupted")
]
recordings = [r for r in store.all_docs("recording") if r["created_at"] < cutoff]
print(
    f"{len(runs)} terminal runs and {len(recordings)} recordings older than {args.days} days. Apply: {args.apply}"
)
if args.apply:
    for r in runs:
        store.delete("run", r["id"])
        store.delete("dispatch", r["id"])
        with store.engine.begin() as c:
            c.execute(text("DELETE FROM events WHERE run_id=:r"), {"r": r["id"]})
        for review in store.all_docs("review"):
            if review["run_id"] == r["id"]:
                store.delete("review", review["id"])
    for r in recordings:
        if r.get("audio_file"):
            Path(r["audio_file"]).unlink(missing_ok=True)
        store.delete("recording", r["id"])
