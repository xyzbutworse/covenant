#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

node -e "for (const f of ['package.json','contracts/package.json','worker/package.json','web/package.json','evidence/deployments.json']) JSON.parse(require('fs').readFileSync(f,'utf8')); console.log('JSON: OK')"

grep -q '0x0000000000000000000000000000000000000FD2' contracts/src/VerifierInterface.sol
grep -q 'receiptStatus != 1' contracts/src/CovenantFacility.sol
grep -q 'processedQueries' contracts/src/CovenantFacility.sol
grep -q 'acceptCovenant' contracts/src/CovenantFacility.sol

echo "Static invariants: OK"

if command -v forge >/dev/null 2>&1 && [[ -d node_modules ]]; then
  (cd contracts && forge build && forge test -vvv)
else
  echo "Foundry/dependencies unavailable: Solidity compile/test skipped."
fi

if [[ -d node_modules ]]; then
  npm run typecheck
  npm run web:build
else
  echo "node_modules unavailable: TypeScript/Next build skipped."
fi
