#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

fail=0
need_cmd() {
  if command -v "$1" >/dev/null 2>&1; then
    echo "[ok] $1: $(command -v "$1")"
  else
    echo "[missing] $1" >&2
    fail=1
  fi
}

need_cmd node
need_cmd npm
need_cmd forge

[[ -d node_modules ]] && echo "[ok] node_modules installed" || { echo "[missing] node_modules — run npm install" >&2; fail=1; }
[[ -f .env ]] && echo "[ok] .env exists" || { echo "[missing] .env — copy .env.example" >&2; fail=1; }

if [[ -f .env ]]; then
  set -a
  source .env
  set +a
  for name in CREDITCOIN_RPC_URL CREDITCOIN_PROOF_BUILDER_URL CREDITCOIN_WALLET_PRIVATE_KEY SOURCE_WALLET_PRIVATE_KEY SOURCE_CHAIN_RPC_URL SOURCE_USDC_ADDRESS DEMO_PAYMENT_RECIPIENT; do
    if [[ -n "${!name:-}" ]]; then echo "[ok] $name"; else echo "[missing] $name" >&2; fail=1; fi
  done
fi

if [[ "$fail" -ne 0 ]]; then
  echo "Preflight failed. Fix the missing requirements above." >&2
  exit 1
fi

echo "Local prerequisites are present. Now run: npm run worker:discover"
