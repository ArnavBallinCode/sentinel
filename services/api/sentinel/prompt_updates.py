START = '<!-- SENTINEL GUARDRAILS START -->'
END = '<!-- SENTINEL GUARDRAILS END -->'


def replace_guardrails(prompt, patch):
    if START in patch or END in patch:
        raise ValueError('Patch contains reserved section delimiters.')
    section = f'{START}\n{patch.strip()}\n{END}'
    if START not in prompt and END not in prompt:
        # Legacy unbounded sections remain untouched, including any following user edits.
        return f'{prompt.rstrip()}\n\n{section}'
    if prompt.count(START) != 1 or prompt.count(END) != 1 or prompt.index(START) > prompt.index(END):
        raise ValueError('Managed guardrail section is malformed. Review it in Bolna first.')
    before, rest = prompt.split(START, 1)
    _, after = rest.split(END, 1)
    return before + section + after
