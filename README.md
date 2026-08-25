# COVENANT

**Credit lines on Creditcoin whose next tranche unlocks only when Attestcoin cryptographically proves the borrower completed the agreed external obligation on another chain.**

---

## 30-second demo

> A lender escrows a **100,000-CTC-equivalent** facility; the borrower can draw the first tranche
> only. The lender proposes a covenant — *"pay 5,000 test USDC to this address, mined inside this
> Sepolia block window"* — and the borrower explicitly accepts it, freezing those terms forever.
> The borrower makes an ordinary Circle test-USDC transfer on Ethereum Sepolia. Attestcoin proves
> that exact transaction into Creditcoin; COVENANT verifies the proof natively at `0x…0FD2`,
> decodes the receipt bytes itself, checks every policy term, and unlocks the next tranche.
> Replay the same proof and it reverts. Miss the deadline with no proof and the undrawn capital
> freezes — but only after Attestcoin's frontier has provably advanced past the window.

Run it without a wallet:

```bash
./scripts/replay-demo.sh
```

This re-verifies evidence artifacts, the live Attestcoin environment, and (once a deployment
exists) the recorded winning proof against actual chain state — read-only, no transactions, no key.

## What Attestcoin makes possible

Attestcoin is Creditcoin's native cross-chain proving subsystem. It continuously attests source-chain blocks and exposes two precompiles inside the Creditcoin EVM:

- `0x…0FD2` — BlockProver: verifies a transaction's inclusion in an attested block via Merkle path + continuity proofs;
- `0x…0FD3` — ChainInfo: reports supported chains and the attestation frontier (`get_latest_attestation_height_and_hash`).

Because verification happens *inside* COVENANT's own execution context, a smart contract can condition capital movement on facts from other chains **without trusting any reporter, oracle token, or off-chain worker**. The worker only transports bytes; if it lies, verification reverts. COVENANT additionally derives all economic meaning (token emitter, payer, recipient, amount, success, block window) from the proof-covered receipt bytes itself, so even a truthful worker supplies nothing decision-relevant.

## Live deployment addresses

**Status: not deployed yet — and this repository does not pretend otherwise.**

`evidence/deployments.json` records `"status": "not-deployed-yet"`. Deployment requires funded
test-only keys (CC3 gas + Sepolia ETH/USDC), which are documented but not committed here for
obvious reasons. After `./scripts/deploy-contracts.sh` runs once, this section is where the decoder
and COVENANT addresses, deployment transaction hashes, deployer, and explorer links land — written
automatically by the deploy script into `evidence/deployments.json`.

What **is** verified live already: `evidence/network-probe.json` captures a read-only probe of the
current official environment — CC3 testnet, chainId **102031**, Sepolia source chainKey **1**,
advancing attestation frontier, and byte-level selector compatibility between our Solidity
ChainInfo interface and the live precompile.

## Real proof transaction

Same honesty: the full causal loop has not been executed yet. The happy-path run records, per the
FORGE kill gate, under `evidence/happy-path/`: the real Sepolia USDC payment tx, the fresh
Merkle + continuity proof artifact consumed by the submission, the Creditcoin settlement tx hash,
and post-state. `docs/JUDGE_GUIDE.md` explains exactly what a reviewer should click once those
exist. Until then, the deterministic local attack suite (44 exported prosecutions) and the live
environment probe are the real evidence; everything else is labeled as pending.

## Architecture

```text
Lender escrows full line → borrower draws unlocked tranche → lender proposes covenant →
borrower accepts (terms immutable) → real USDC transfer on Sepolia →
Attestcoin attests block → fresh Merkle + continuity proof → permissionless submit →
native verifyAndEmit at 0x…0FD2 → decode verified receipt → deterministic policy →
CovenantSatisfied → next tranche drawable.
```

Three packages:

| Package | Role | Trust |
|---|---|---|
| `contracts/` | Foundry/Solidity state machine + evidence enforcement (`CovenantFacility.sol`, ~410 lines) | trusted root; calls precompiles directly |
| `worker/` | TypeScript ops: discovery, demo setup, source payment, proof fetch, submission, adversarial campaign | **untrusted transport** — supplies zero decision-relevant fields |
| `web/` | Next.js judge/operator surfaces; reads chain server-side; console actions are wallet-signed by their user | untrusted presentation |

Full data flow, agreement model, capital model, and the frontier-aware expiry lifecycle:
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md). Integration specifics:
[`docs/ATTESTCOIN.md`](docs/ATTESTCOIN.md), [`docs/NETWORKS.md`](docs/NETWORKS.md).

## Invariant

> **No tranche protected by a covenant may become drawable unless independently verified external
> evidence satisfies that covenant's immutable evidence policy.**

Enforced structurally: `draw()` pays out strictly within `unlocked − drawn`; `unlocked` increases
only inside covenant satisfaction, which is reachable only through `submitEvidence()`, which
reverts unless native verification succeeds AND the decoded receipt matches the accepted policy
AND the query identity was never consumed before. Seven fuzz-tested global invariants plus 44
exported adversarial prosecutions back this claim — see
[`docs/ADVERSARIAL_EVIDENCE.md`](docs/ADVERSARIAL_EVIDENCE.md).

## Quick reproduction

```bash
git clone <this repo> && cd covenant-dorahacks
npm install                         # pinned workspace deps (exact versions)
foundryup --install v1.2.3 && foundryup --use v1.2.3
cd contracts && forge install foundry-rs/forge-std@v1.9.7 --no-git && cd ..
node scripts/generate-fixtures.cjs  # rebuild SDK-encoded test fixtures
./scripts/static-check.sh           # fmt + forge build + forge test + typecheck + web build
./scripts/replay-demo.sh            # wallet-free judge verification of evidence + live env
```

Expected: **57/57 Foundry tests**, clean lint/typecheck/build, and the replay verifier reporting
the live CC3 frontier. No `.env` required for any of the above.

## Adversarial evidence

Two strictly separated classes, each record self-labeled via its `kind` field:

- **`live-chain`** — real rejected transactions on CC3/Sepolia with input tx, proof identifier,
  rejection hash, decoded revert reason, and before/after state. Currently armed-but-skipped with
  precise prerequisites (no funded key yet); `npm run worker:attacks` populates them after funding.
- **`local-foundry-adversarial`** — 44 deterministic prosecutions from actual `forge test` runs:
  invalid Merkle proofs, corrupted bytes, verifier rejection, wrong chain/emitter/payer/recipient,
  reverted source txs, replay across covenants/facilities, sub-threshold accumulation, frontier-
  aware freeze gating, access control, plus fuzz and global-invariant suites.

Full map and reading order: [`docs/ADVERSARIAL_EVIDENCE.md`](docs/ADVERSARIAL_EVIDENCE.md).
Threat-by-threat controls: [`docs/THREAT_MODEL.md`](docs/THREAT_MODEL.md).

## Limitations

COVENANT proves that a **specified historical event** satisfied a **deterministic policy**. It does
not prove anything else. In particular:

1. **Historical-event proof is not current-state proof.** A proven payment says nothing about the
   borrower's balances, solvency, or positions now.
2. **No universal non-payment claims.** Missing/frozen means "not cryptographically satisfied by
   the agreed rules", never "the borrower did not pay anywhere".
3. **Policies are only as meaningful as their configured protocol.** If you approve a worthless
   token or a meaningless contract as the obligation emitter, COVENANT will faithfully prove
   worthless things. Garbage policy in, garbage proof out.
4. **Narrow vertical slice.** The current demo proves one flow: Circle test USDC transfers on
   Ethereum Sepolia, native-test-CTC escrow, single testnet environment. Not a lending product.
5. **Timing depends on source finality and Attestcoin availability.** Evidence can only exist
   after the source block is attested; freeze eligibility additionally requires the observable
   frontier to advance past the committed margin. Liveness failures delay consequences rather
   than fabricating them.

Extended discussion: [`docs/LIMITATIONS.md`](docs/LIMITATIONS.md).

## Local development

```bash
npm install                # workspaces: contracts / worker / web
cp .env.example .env       # only needed for live operations, not for tests/builds
npm run contracts:test     # forge test -vvv
npm run typecheck          # worker + web tsc
npm run lint               # web eslint
npm run web:build          # next production build
npm run worker:discover    # live ChainInfo discovery (read-only)
```

Toolchain pins: Node ≥ 22, Foundry **v1.2.3**, forge-std **v1.9.7**, solc **0.8.23**
(via-IR enabled), `@gluwa/usc-sdk` **0.18.0**, `@gluwa/usc-contracts` **0.1.2**, ethers **6.17.0**,
TypeScript **6.0.2**, Next **16.3.2** (bumped from 16.0.0 for published security advisories; `npm audit` now reports 0 vulnerabilities). All versions are exact-pinned in their package.json files.

## Hackathon track / integration

Built for **BUIDL CTC 2026 Fall** on the Creditcoin × Attestcoin track: the project integrates the
current native query-verifier architecture (`0x…0FD2` BlockProver + `0x…0FD3` ChainInfo) exactly as
published in [`gluwa/attestcoin-protocol-examples`](https://github.com/gluwa/attestcoin-protocol-examples)
(formerly `usc-testnet-bridge-examples`), pinned to the same Foundry version the official examples
use, and validated against the live CC3 testnet precompiles during development (see
`evidence/network-probe.json`). The initial vertical slice targets Circle test USDC on Ethereum
Sepolia as the source obligation.
