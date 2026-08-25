#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT/contracts"

: "${CREDITCOIN_RPC_URL:?Set CREDITCOIN_RPC_URL}"
: "${CREDITCOIN_WALLET_PRIVATE_KEY:?Set CREDITCOIN_WALLET_PRIVATE_KEY}"

DECODER_SOURCE="../node_modules/@gluwa/usc-contracts/contracts/decoding/EvmV1Decoder.sol"

if ! command -v forge >/dev/null 2>&1; then
  echo "forge is required. Pin Foundry to v1.2.3 before deploying." >&2
  exit 1
fi

if [[ ! -f "$DECODER_SOURCE" ]]; then
  echo "Missing @gluwa/usc-contracts. Run npm install from the repository root first." >&2
  exit 1
fi

echo "[1/2] Deploying EvmV1Decoder library..."
DECODER_OUTPUT="$(forge create \
  --broadcast \
  --rpc-url "$CREDITCOIN_RPC_URL" \
  --private-key "$CREDITCOIN_WALLET_PRIVATE_KEY" \
  "$DECODER_SOURCE:EvmV1Decoder")"
echo "$DECODER_OUTPUT"
DECODER_ADDRESS="$(printf '%s\n' "$DECODER_OUTPUT" | awk '/Deployed to:/ {print $3}' | tail -1)"
if [[ ! "$DECODER_ADDRESS" =~ ^0x[0-9a-fA-F]{40}$ ]]; then
  echo "Could not parse decoder deployment address." >&2
  exit 1
fi

echo "[2/2] Deploying CovenantFacility linked to $DECODER_ADDRESS..."
# Foundry resolves the library link reference through the remapping name, while
# forge create needs the filesystem path above to deploy the library itself.
LIB_SPEC="@gluwa/usc-contracts/contracts/decoding/EvmV1Decoder.sol:EvmV1Decoder:$DECODER_ADDRESS"
FACILITY_OUTPUT="$(forge create \
  --broadcast \
  --rpc-url "$CREDITCOIN_RPC_URL" \
  --private-key "$CREDITCOIN_WALLET_PRIVATE_KEY" \
  --libraries "$LIB_SPEC" \
  src/CovenantFacility.sol:CovenantFacility)"
echo "$FACILITY_OUTPUT"
FACILITY_ADDRESS="$(printf '%s\n' "$FACILITY_OUTPUT" | awk '/Deployed to:/ {print $3}' | tail -1)"
if [[ ! "$FACILITY_ADDRESS" =~ ^0x[0-9a-fA-F]{40}$ ]]; then
  echo "Could not parse COVENANT deployment address." >&2
  exit 1
fi

cat > "$ROOT/evidence/deployments.json" <<JSON
{
  "creditcoinRpc": "$CREDITCOIN_RPC_URL",
  "decoder": "$DECODER_ADDRESS",
  "covenantFacility": "$FACILITY_ADDRESS",
  "verifierPrecompile": "0x0000000000000000000000000000000000000FD2",
  "chainInfoPrecompile": "0x0000000000000000000000000000000000000FD3",
  "deployedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
JSON

echo
echo "COVENANT_CONTRACT_ADDRESS=$FACILITY_ADDRESS"
echo "EVM_V1_DECODER_ADDRESS=$DECODER_ADDRESS"
echo "Deployment metadata written to evidence/deployments.json"
