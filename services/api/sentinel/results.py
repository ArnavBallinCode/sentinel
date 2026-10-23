"""A conservative, shared verdict for the UI, exports and release checks."""
import hashlib
import json


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, ensure_ascii=False).encode()).hexdigest()


def metrics(run):
    outputs = [n.get('output') or {} for n in run.get('nodes', {}).values()]
    findings = {f['id']: f for o in outputs for f in o.get('findings', [])}
    evaluated = sorted({p for o in outputs for p in o.get('evaluated', [])})
    unsupported = sorted({p for o in outputs for p in o.get('unsupported', [])})
    for o in outputs:
        judge = o.get('judge') or {}
        if judge.get('status') == 'inconclusive':
            unsupported.append('Judge output could not be validated.')
    status = run['status']
    if status in ('running', 'waiting'):
        verdict = 'pending'
    elif status != 'completed':
        verdict = 'error'
    elif findings:
        verdict = 'failed'
    elif not evaluated or unsupported:
        verdict = 'inconclusive'
    else:
        verdict = 'passed'
    return {
        'verdict': verdict, 'passed': verdict == 'passed', 'findings': list(findings.values()),
        'evaluated': bool(evaluated), 'evaluated_policies': evaluated, 'unsupported': sorted(set(unsupported)),
        'duration_ms': round((run.get('ended_at', run['created_at']) - run['created_at']) * 1000),
        'cost': None,
    }


def provenance(run):
    return next((n['output']['provenance'] for n in run.get('nodes', {}).values()
                 if (n.get('output') or {}).get('provenance')), None)


def comparison_reasons(a, b):
    reasons = []
    for field in ('workflow_id', 'mode'):
        if a.get(field) != b.get(field):
            reasons.append(f'Different {field}.')
    for field in ('scenario', 'seed', 'attack_id', 'agent_id', 'recording_id'):
        if a['request'].get(field) != b['request'].get(field):
            reasons.append(f'Different {field}.')
    # Changing only the guardrail treatment is the supported controlled comparison.
    def controls(run):
        nodes = []
        for n in run['graph']['nodes']:
            cfg = dict(n['data'].get('config', {}))
            if n['type'] == 'bolna':
                for k in ('safe_agent', 'prompt_patch'):
                    cfg.pop(k, None)
            nodes.append({'id': n['id'], 'type': n['type'], 'config': cfg})
        return {'nodes': nodes, 'edges': [{k:e.get(k) for k in ('source','target','sourceHandle','targetHandle')} for e in run['graph']['edges']]}
    if controls(a) != controls(b):
        reasons.append('Workflow controls changed beyond the guardrail treatment.')
    pa, pb = provenance(a), provenance(b)
    if not pa or not pb:
        reasons.append('Exact execution provenance unavailable for a run.')
    elif {k:v for k,v in pa.items() if k not in ('effective_prompt_hash', 'patch_hash')} != {k:v for k,v in pb.items() if k not in ('effective_prompt_hash', 'patch_hash')}:
        reasons.append('Model, prompt source, tools or input evidence changed.')
    return reasons
