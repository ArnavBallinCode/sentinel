#!/usr/bin/env bash
# Upload the committed tree to the Hugging Face Space. Secrets are set separately in the Space settings.
set -euo pipefail
cd "$(dirname "$0")/.."
SPACE=${HF_SPACE:-blackmamba2408/sentinel}
STAGE=$(mktemp -d)
trap 'rm -rf "$STAGE"' EXIT
git archive HEAD | tar -x -C "$STAGE"
cp deploy/hf/Dockerfile deploy/hf/README.md "$STAGE/"
hf upload "$SPACE" "$STAGE" . --repo-type space --commit-message "Deploy $(git rev-parse --short HEAD)"
