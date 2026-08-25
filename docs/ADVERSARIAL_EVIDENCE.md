# Adversarial evidence

COVENANT's negative-path evidence lives in two strictly separated categories. Every record
carries a `kind` field so nothing can masquerade across the line:

| Category | `kind` value | Location | What it proves |
|---|---|---|---|
| **Live chain activity** | `"live-chain"` | `evidence/attacks/L*.json` | Real rejected transactions broadcast to Creditcoin CC3 testnet / real Sepolia payments, with on-chain tx hashes |
| **Deterministic local tests** | `"local-foundry-adversarial"` | `evidence/attacks/local/P*.json`, `E*.json`, `C*.json`, `G*.json` | Foundry prosecutions against behavior-faithful precompile doubles (`vm.etch`) using official SDK-generated fixtures |

**Nothing in this repository pretends a local test is chain evidence, or vice versa.**

---

## 1. Live-chain evidence

### Current status: campaign armed, awaiting funded keys

The deployment blocker documented at the end of the build pass still stands: this environment has
**no funded test-only private key**, therefore no COVENANT contracts exist on CC3 testnet yet, and
no live negative transaction can be honestly manufactured. Rather than fabricate anything, each of
the twelve live attack cases has been recorded as an explicit, machine-readable **SKIPPED** entry
stating its exact prerequisite:

| ID | Attack | Invariant defended | Status |
|---|---|---|---|
| L01 | Replay the already-consumed valid proof | Query identity consumed once globally | SKIPPED — needs happy path first |
| L02 | Evidence intended for covenant A submitted into covenant B | Per-covenant policy binding | SKIPPED — needs happy path first |
| L03 | Below-threshold payment leaves covenant unsatisfied | Accumulation gate; unlock only ≥ requirement | SKIPPED — needs happy path first |
| L04 | Source transaction outside eligible block window | Immutable source window | SKIPPED — needs happy path first |
| L05 | Payment to wrong recipient | Recipient binding on verified bytes | SKIPPED — needs happy path first |
| L06 | Payment from wrong payer | Payer bound to facility.borrower | SKIPPED — also needs `SOURCE_ALT_PRIVATE_KEY` |
| L07 | Wrong token emitter | Approved-emitter binding | SKIPPED — also needs `SOURCE_WRONG_TOKEN_ADDRESS` |
| L08 | Used transaction against another facility | Global replay identity across facilities | SKIPPED — needs happy path first |
| L09 | Early freeze before attestation/proof conditions | Freeze = deadline AND frontier gates | SKIPPED — needs deployed contract |
| L10a/b | Unauthorized term mutation (cancel-after-accept; re-propose over active) | Accepted terms immutable | SKIPPED — needs deployed contract |
| L11 | Unauthorized draw by non-borrower | Role enforcement | SKIPPED — needs deployed contract |
| L12 | Lender withdrawal before permitted maturity | Committed escrow untouchable early | SKIPPED — needs deployed contract |

Each record already carries the full schema required for live evidence
(`inputTransaction`, `proofOrCallIdentifier`, `rejectionTxHash`, `revertedOnChain`,
`revertReason`, `stateBefore`, `stateAfter`, `invariantDefended`) with nulls where a case did not
execute. When the campaign is re-run after funding, those fields are populated by real
broadcast transactions — including gas-costly reverting sends, whose hashes are captured.

Supporting live evidence that IS already real: `evidence/network-probe.json` records read-only
discovery against the live CC3 testnet (chainId 102031, Sepolia chainKey 1, advancing Attestcoin
frontier, byte-compatible selector check against our Solidity ChainInfo interface).

### Executing the live campaign

```bash
cp .env.example .env          # fill funded lender/borrower (+optional alt/wrong-token) keys
./scripts/deploy-contracts.sh
# ... fund wallets, run happy path once (creates consumed proof) ...
npm run worker:attacks
```

The runner broadcasts every rejection for real (reverting sends included) via
`worker/src/attacks.ts`; sub-threshold payments are accepted as evidence by design and are
recorded as `outcome:"accepted-as-partial"` with state snapshots proving zero capital movement.

---

## 2. Deterministic local evidence (Foundry)

Generated from actual `forge test` runs by `scripts/export-local-adversarial.cjs`; each record
embeds the observed PASS result and gas/fuzz-run counters, so exports can never claim a defense
that did not execute. Environment is stated in every record: local EVM,
`MockNativeQueryVerifier` etched at `0x…0FD2`, `MockChainInfo` etched at `0x…0FD3`, fixtures from
the official `@gluwa/usc-sdk` encoder.

| Layer | Records (examples) |
|---|---|
| Proof verification (not safely manufacturable live) | P01 invalid Merkle proof · P02 verifier returns false · P03 corrupted receipt bytes · P04 unsupported decoder type |
| Policy semantics | P05 wrong chain · P06 wrong emitter · P07 wrong event signature · P08 malformed log · P09 reverted source tx · P10 wrong payer · P11 wrong recipient · P12 window boundary |
| Economic transitions | P13 $X < $requirement never unlocks · P14 multi-tx accumulation · P15 cross-covenant/facility replay · P16 stale-period evidence · P17/P18 replay & resubmission states |
| Expiry / frontier | E01 frontier-behind never freezes · E02 no attestation data · E03 last eligible block counts · E04 late proof within cure window · E05 early-freeze prosecution · E06 deterministic FREEZABLE · E07 margin immutability |
| Capital & roles | C01 draw beyond commitment · C02 tranche single-use · C03 cross-facility isolation · C04 lender early withdrawal · C05 closure reconciliation · C06 freeze preserves history · C07 access-control matrix · C08 nonsense configurations · C09 term-immutability under attacker hammering |
| Fuzz (256 runs each) | C10 draw allowance · C11 deadline ≤ maturity · C12 window enforcement |
| Global invariants (40 runs × 64 calls each) | G01 balance == escrow · G02 allowance bounds · G03 unlock exactness · G04 dead facilities not drawable · G05 linkage integrity · G06 accepted-term immutability · G07 deadline ≤ maturity |

Index with the full forge-run summary: `evidence/attacks/local/index.json`.

---

## Reading order for judges

0. `./scripts/replay-demo.sh` — wallet-free verification that re-reads this evidence and checks the live environment (and deployed state once it exists).
1. `evidence/network-probe.json` — live Attestcoin environment validation.
2. `evidence/attacks/local/index.json` → any `local/*.json` — deterministic prosecution results.
3. `evidence/attacks/L*.json` — live campaign status (SKIPPED today with precise blockers;
   repopulated with real rejection hashes by `npm run worker:attacks` once funded).
