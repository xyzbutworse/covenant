#!/usr/bin/env bash
# COVENANT judge replay — verify the recorded proof and resulting on-chain state
# WITHOUT any wallet or new transactions. Read-only by construction.
#
#   ./scripts/replay-demo.sh
#
# Verifies:
#   1. evidence artifact integrity (JSON parses, required records present);
#   2. live Attestcoin environment (CC3 RPC chainId + advancing Sepolia attestation frontier);
#   3. when a deployment exists: covenant Satisfied, consumed query identity recomputed from
#      the recorded proof, unlocked capital actually expanded.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [[ ! -d node_modules ]]; then
  echo "Dependencies missing. Run: npm install" >&2
  exit 1
fi

# Optional: source .env for CREDITCOIN_RPC_URL / COVENANT_CONTRACT_ADDRESS overrides.
# Absent .env is fine — the verifier falls back to evidence/deployments.json + probe defaults.
if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

node scripts/verify-state.mjs

echo
echo "For the full interactive walkthrough see docs/JUDGE_GUIDE.md."
