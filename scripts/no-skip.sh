#!/bin/bash
# Quality gate: Ensure no skipped tests exist in the codebase
# Fails CI if any .skip patterns are found

set -e

echo "Checking for skipped tests..."

# Search for skip patterns in test files
SKIP_PATTERNS="it\.skip\(|describe\.skip\(|test\.skip\("

# Find matches in packages (excluding node_modules)
MATCHES=$(grep -rE "$SKIP_PATTERNS" packages/ --include="*.ts" --include="*.tsx" 2>/dev/null || true)

if [ -n "$MATCHES" ]; then
  echo "ERROR: Found skipped tests. Remove .skip before merging:"
  echo ""
  echo "$MATCHES"
  echo ""
  exit 1
fi

echo "No skipped tests found."
exit 0
