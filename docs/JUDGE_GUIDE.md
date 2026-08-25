# Judge guide

**You need no wallet to review COVENANT.** All inspection is read-only.

## Step 0 — one command (≈10 seconds)

```bash
./scripts/replay-demo.sh
```

This verifies, without signing anything:

1. evidence artifacts parse (`deployments.json`, `network-probe.json`, adversarial index);
2. the live Attestcoin environment is real and advancing — CC3 RPC chainId 102031 and the Sepolia
   attestation frontier read straight from the `0x…0FD3` precompile;
3. once a deployment exists: covenant status `Satisfied` on-chain, the consumed query identity
   recomputed from the recorded proof artifact, and unlocked capital actually expanded.

Today it prints an honest *"no deployment yet"* for step 3 — that is the true state of this
repository until funded keys run `deploy-contracts.sh` + `run-happy-path.sh`.

## The project in 60 seconds

### 0–10s · What is it?

A revolving Creditcoin credit line whose next tranche unlocks **only** when Attestcoin proves the
borrower completed an agreed external payment. No oracle token, no trusted reporter.

### 10–20s · The scenario

$100,000 facility escrowed on Creditcoin. $20,000 initially drawable. The covenant demands a
$5,000 Circle test-USDC transfer inside a fixed Sepolia block window. Borrower explicitly accepts;
terms become immutable. Open `/judge` in the web app for exactly this narrative with a visible
negative case.

### 20–40s · Follow the money, then the proof

Open the real Sepolia USDC transaction (link in `evidence/happy-path/source-payment.json`), then
the Creditcoin settlement transaction (`attestcoin-submission.json`). The latter carries Merkle +
continuity proof material into the native verifier at `0x…0FD2`; COVENANT decodes the verified
receipt itself and checks emitter, payer, recipient, amount, window, success, and replay identity.
Walk each hop on `/proof` — every step links out.

### 40–50s · See the state move

`EvidenceAccepted` + `CovenantSatisfied` in the settlement receipt; facility `unlocked` grows by
exactly one tranche only at that moment. Re-verify independently with `./scripts/replay-demo.sh`
— no wallet needed.

### 50–60s · Watch attacks fail

`evidence/attacks/`: live-chain records for real rejected transactions (replay →
`QueryAlreadyProcessed`, wrong recipient/payer/emitter → `NoMatchingPayment`, early freeze →
`ProofDeadlineNotReached`/`FrontierNotAdvanced`) plus 44 deterministic Foundry prosecutions for
cases not safely manufacturable live (invalid Merkle proofs, corrupted bytes, decoder abuse).
Every record is labeled by `kind`. Browse `/attacks` in the web app for the same split.

## Verify these claims yourself

- source payment tx exists on Sepolia explorer;
- COVENANT contract address + deployment tx are recorded in `evidence/deployments.json`;
- settlement tx emits `EvidenceAccepted` then `CovenantSatisfied`;
- `unlocked` changed only after proof submission;
- replaying the proof reverts;
- `git grep -iE "private[_ ]?key.*0x[0-9a-f]{64}"` finds nothing committed.
