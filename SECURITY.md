# Security Policy

COVENANT is hackathon software and is **not** production-audited.

## Security properties

The implementation is designed to enforce:

- Attestcoin proof verification before any evidence interpretation (native `0x…0FD2` call; `false` return treated as failure).
- Source-chain binding and immutable source block-window binding.
- Receipt success validation — inclusion alone is never sufficient.
- Exact token-emitter, payer (= on-chain borrower), and recipient validation on verified bytes only.
- Minimum / cumulative amount enforcement with partial accumulation.
- Per-transaction replay protection via a global one-time query identity derived from proof-covered data.
- Immutable covenant terms after borrower acceptance; proposals bind nobody before it.
- Permissionless proof submission — the submitter's identity grants no authority.
- Frontier-gated expiry: freeze requires the cure deadline AND the observable Attestcoin frontier past the committed margin.
- Reentrancy protection around native-value draws/refunds (`nonReentrant`, checks-effects-interactions).
- Exact role enforcement and rejection of zero/nonsense configurations.

## Key hygiene

No private keys are committed. `.env` / `.env.local` are gitignored; all documented keys are
fresh test-only keys the operator provisions locally. Run
`git grep -iE "private[_ ]?key.*0x[0-9a-fA-F]{64}"` as a quick audit.

## Known limitations

Full discussion in [`docs/LIMITATIONS.md`](docs/LIMITATIONS.md); headline items:

- Historical-event proof is not current-state proof.
- No universal non-payment claims.
- Evidence policies are only as meaningful as their configured source protocol/contracts.
- The demo proves a narrow testnet vertical slice (Sepolia USDC → CC3, native CTC escrow).
- Source finality / Attestcoin availability gate evidence timing and freeze eligibility.

Additional operational notes:

- The prototype escrows native test CTC rather than a production stablecoin vault.
- Proof deadlines must be configured with margin for source finality + Attestcoin availability;
  the frontier requirement enforces the configured rule but cannot compensate for a badly sized one.
- No deployment should occur without an independent audit.

## Reporting

For issues discovered during the hackathon review window, open a GitHub issue on this repository
with minimal reproduction details. Do not include secrets in reports.
