#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [[ ! -f .env ]]; then
  echo "Copy .env.example to .env and configure RPCs, proof builder, wallets, chain key, contract, and recipient first." >&2
  exit 1
fi

set -a
source .env
set +a

echo "== 0. Verify current Attestcoin source configuration =="
npm run worker:discover

echo "== 1. Create funded facility, draw initial tranche, propose + accept covenant =="
npm run worker:setup

echo "== 2. Execute the real Sepolia test-USDC obligation =="
npm run worker:pay

echo "== 3. Wait for attestation and generate fresh Merkle + continuity proofs =="
npm run worker:prove

echo "== 4. Submit permissionless evidence and unlock the next tranche =="
npm run worker:submit

echo "== 5. Draw the tranche unlocked by satisfied covenant =="
npm run worker:draw-next

echo "== 6. Read final on-chain state =="
npm run worker:inspect

echo
echo "Happy path complete. Preserve all explorer URLs and evidence/*.json before running attacks."
