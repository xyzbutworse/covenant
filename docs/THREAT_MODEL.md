# Threat model

## Protected invariant

No covenant-protected tranche may become drawable unless a valid Attestcoin-covered source
transaction satisfies the covenant's immutable, borrower-accepted evidence policy.

## Attacks and controls

### Proof layer

| Attack | Control |
|---|---|
| Fabricated Merkle proof | Native `0x…0FD2` `verifyAndEmit` must succeed; reverts otherwise. |
| Corrupted transaction bytes | Identity binds exact bytes: one flipped bit breaks leaf inclusion. |
| Verifier returns false | Explicit `ProofVerificationFailed`; no state change. |
| Reverted source transaction presented as success | Decoded `receiptStatus` must equal 1 (`SourceTransactionFailed`). Inclusion alone is insufficient. |
| Malformed/foreign event logs | Only well-formed `Transfer(address,address,uint256)` logs from the approved emitter are considered; malformed logs are skipped. |
| Wrong decoder input shape | Transaction type validated (0–4) before any decode; garbage reverts before semantic checks. |

### Policy layer

| Attack | Control |
|---|---|
| Wrong source chain | Submitted chainKey must equal the accepted policy. |
| Outside eligible window | `blockHeight ∈ [startSourceBlock, endSourceBlock]` enforced; stale "prior period" evidence cannot satisfy a later covenant. |
| Fake token emitter | Matching log's `address` must equal the immutable approved token. |
| Wrong payer / recipient | Indexed topics compared against committed payer (= on-chain borrower) and recipient. |
| Dust payment | Accumulated verified amount must reach the requirement; below-threshold evidence is accepted but unlocks nothing. |
| Worker lies about any economic field | Worker supplies none. All decision-relevant fields derive from proof-covered receipt bytes. |

### Replay layer

| Attack | Control |
|---|---|
| Replay of consumed proof | Query identity `(chainKey, height, txIndex)` consumed once globally — across covenants AND facilities. |
| Wrong-policy griefing pre-consumption | Identity is marked consumed only after all semantic checks pass; failed submissions cannot censor or burn a valid proof. |

### Expiry / freeze

| Attack | Control |
|---|---|
| Lender freezes while Attestcoin simply hasn't caught up | Freeze requires the observable ChainInfo frontier ≥ window end + committed margin (`FrontierNotAdvanced` / `NoAttestationData` otherwise). |
| Freeze before cure deadline | Deadline gate independent of frontier state. |
| Double freeze / freeze after satisfaction | Status machine: only `Pending` covenants freeze; satisfied/expired are terminal. |

### Governance & roles

| Attack | Control |
|---|---|
| Lender invents terms after funding | Proposals bind nobody until explicit borrower acceptance. |
| Either party mutates accepted policy | No mutation entry point exists; fields verified immutable under adversarial fuzz sequences. |
| Unauthorized draw / early lender withdrawal | Role checks + closure gates (`FacilityNotClosable`, `ActiveCovenantExists`). |
| Nonsense configuration | Zero addresses/values/chains, inverted windows, past deadlines, deadline > maturity all revert at creation. |
| Reentrancy around native transfers | `draw`/`closeFacility` are `nonReentrant`; effects precede interactions. |

## What we explicitly do NOT defend against

- A **meaningless approved protocol**: if the configured emitter contract has no real-world
  significance, proofs are faithful but economically empty.
- **Attestcoin liveness failure**: consequences stall (covenants stay unfreezable); nothing
  fabricates a punishment or a satisfaction.
- **Economically foolish accepted terms**: COVENANT enforces evidence policy, not underwriting
  quality.
- **Key compromise** of lender/borrower wallets, or a malicious borrower deliberately accepting
  hostile covenants.

## Residual risks

- Source-token semantics are assumed from its deployed contract; the prototype does not audit USDC itself.
- Historical events say nothing about current solvency or asset state.
- Native test CTC escrow is a hackathon capital primitive, not a production vault.
- Unaudited hackathon software. See [`SECURITY.md`](../SECURITY.md).
