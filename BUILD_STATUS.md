# Build status

## Implemented

- COVENANT facility/tranche/covenant state machine.
- Borrower acceptance of immutable covenant proposals.
- Facility maturity so a lender cannot claw back committed undrawn capital prematurely.
- Permissionless Attestcoin evidence submission.
- Native `0x0FD2` verifier call surface.
- Verified receipt success + exact ERC-20 Transfer semantic checks.
- Source-chain/window binding, partial-payment accumulation and replay identity.
- Facility freeze after the separate proof deadline.
- Worker scripts for network discovery, demo setup, source payment, proof generation, submission and inspection.
- Linked `EvmV1Decoder` deployment script.
- Judge-facing web UI, live read mode and wallet operator console.
- Threat model, limitations, network guide, evidence folders and demo runbook.

## Build verification (pinned toolchain)

With dependencies installed (`npm install`), forge-std v1.9.7 and Foundry 1.2.3 pinned, the full static suite passes:

- `forge fmt --check`, `forge build` (via-IR enabled for the precompile call surface), `forge test -vvv`;
- worker `tsc --noEmit` (strict, skipLibCheck off);
- web `eslint`, `tsc --noEmit`, `next build`.

The worker's proof flow was aligned with the official `@gluwa/usc-sdk@0.18.0` example: `ProofBuilder.getProof()` returns `{ success, data?, error? }` and the unwrapped `.data` payload is what gets persisted and submitted.

## Live proof gate still required

Before submission, capture:

- exact Creditcoin execution network + chain ID;
- discovered Attestcoin source chain key;
- decoder + COVENANT deployment addresses;
- source-verified explorer links;
- real Sepolia payment tx;
- real proof builder output;
- real Creditcoin evidence/settlement tx;
- real replay and wrong-policy failures.

Until those exist, the repo is a complete implementation candidate, not a completed hackathon proof.
