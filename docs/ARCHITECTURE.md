# Architecture

## Causal path

```text
Lender                         Borrower
  |                               |
  | escrow full credit line       | draw currently unlocked tranche
  v                               v
CovenantFacility.sol on Creditcoin
  |
  | lender proposes evidence policy
  | borrower explicitly accepts immutable terms
  v
Pending covenant
  |
  | real ERC-20 payment
  v
Ethereum Sepolia / Circle test USDC
  |
  | finalized transaction + receipt
  v
Attestcoin proof builder / permissionless submitter
  |
  | encoded tx + Merkle proof + continuity proof
  v
CovenantFacility.sol
  |
  | native verification at 0x0FD2
  | verify receipt success
  | exact token / payer / recipient / amount / source window
  | consume unique query identity
  v
Covenant satisfied
  |
  | expand facility.unlocked by trancheSize
  v
Borrower can draw next tranche
```

## Repository map

| Package | Contents |
|---|---|
| `contracts/` | `CovenantFacility.sol` (state machine, policy, freeze gating), lean precompile interfaces, Foundry suites (state, evidence, adversarial, lifecycle, invariants) |
| `worker/` | discovery, demo setup, source payment, proof build/submit (freshness-enforced), inspection, adversarial campaign runner |
| `web/` | landing, live facility read, proof causal chain, adversarial-evidence browser, no-wallet `/judge`, wallet operator console |
| `evidence/` | deployment record, live network probe, adversarial campaign records (`live-chain` vs `local-foundry-adversarial`) |
| `scripts/` | deploy, happy-path driver, fixture generation, local-evidence export, wallet-free judge replay (`replay-demo.sh` → `verify-state.mjs`) |

## Trust boundary

The worker is an untrusted transport. It cannot provide authoritative decoded payer, recipient, amount or success fields. COVENANT derives economically relevant values from Attestcoin-covered transaction/receipt bytes after native proof verification.

Evidence submission is permissionless: borrower, lender, project worker or any keeper may submit a valid proof.

## Agreement model

The lender may propose the next evidence policy, but the borrower must accept it before it becomes active. Once accepted, no mutation path exists for that covenant. A proposal may be cancelled before acceptance by either facility party.

## Capital model

The prototype escrows the full facility limit in native test CTC at creation. Only the first tranche is initially unlocked. Each satisfied covenant unlocks at most one additional tranche, capped at the total credit limit.

A lender cannot close an active committed facility simply because capital is still undrawn. Closure is allowed after facility maturity, after the facility has been fully used, or after a facility is frozen.

## Covenant lifecycle (frontier-aware)

A covenant's lifecycle is anchored to **observable Attestcoin state**, not wall-clock time:

```text
PENDING
  -> source obligation window active   [startSourceBlock .. endSourceBlock on Sepolia]
  -> source block range closes         (time passes on Creditcoin; nothing is punishable yet)
  -> Attestcoin frontier advances      ChainInfo 0x...0FD3 reports
       get_latest_attestation_height_and_hash(chainKey).height
         >= endSourceBlock + freezeFrontierMarginSourceBlocks
  -> proof / cure window               evidence may still be submitted until
                                       proofDeadlineCreditcoinBlock
  -> SATISFIED   (valid proof accepted any time before the deadline)
     or FREEZABLE (deadline passed AND frontier requirement met -- both deterministic)
```

Committed, immutable parameters (fixed at proposal, binding only after borrower acceptance):

- source chain key and approved token contract;
- payer (= facility borrower) and required recipient;
- required amount with partial-payment accumulation;
- `startSourceBlock` / `endSourceBlock` eligibility window;
- `freezeFrontierMarginSourceBlocks` -- how far past the window the attestation frontier must advance before expiry has any consequence;
- `proofDeadlineCreditcoinBlock` -- Creditcoin-side cure deadline, never beyond facility maturity;
- consequence: satisfaction expands drawable credit by one tranche; expiry freezes.

### Freeze eligibility is deterministic

`freezeExpiredCovenant` succeeds **only if all three hold**:

1. covenant status is `Pending` (borrower accepted);
2. `block.number > proofDeadlineCreditcoinBlock`;
3. ChainInfo at `0x...0FD3` observes an attestation frontier at or beyond `endSourceBlock + freezeFrontierMarginSourceBlocks`.

Condition 3 makes it structurally impossible to punish a borrower merely because Attestcoin has not yet attested a valid source transaction. `isFreezable(covenantId)` exposes the same check as a view for workers and UIs. With no attestation data for the chain, freeze reverts with `NoAttestationData`; behind the requirement it reverts with `FrontierNotAdvanced(required, latest)`.
