#!/bin/bash
set -euo pipefail
# This wrapper is the only command allowed by the Actions SSH key.
if [[ "${SSH_ORIGINAL_COMMAND:-}" =~ ^deploy\ ([0-9a-f]{40})$ ]]; then
  exec sudo -n /usr/local/sbin/ulianaa-deploy-root "${BASH_REMATCH[1]}"
fi
echo 'Only deploy <full-commit-sha> is allowed' >&2
exit 64
