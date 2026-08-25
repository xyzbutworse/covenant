# Limitations

COVENANT makes deliberately narrow claims. It proves that a **specified historical on-chain
transaction** satisfied a **deterministic, borrower-accepted event policy**. Everything below
follows from that scope.

## The five limitations that matter most

1. **Historical-event proof is not current-state proof.**
   A proven payment is a fact about one past transaction. It says nothing about the borrower's
   current balances, solvency, positions, or behavior after the proven block.

2. **COVENANT does not prove universal non-payment.**
   "Covenant not satisfied / facility frozen" means exactly: no evidence cryptographically
   satisfied the accepted policy before the deadline, under the observable Attestcoin frontier.
   It never means the borrower did not pay anywhere, on any rail, at any time.

3. **Accepted evidence policies are only as meaningful as their configured source protocol and
   contracts.** COVENANT faithfully verifies whatever emitter/token/payer/recipient/window the
   covenant commits. If those point at worthless or meaningless contracts, the proofs are correct
   and economically empty. Policy quality is an underwriting decision, not a protocol property.

4. **The current demo proves a narrow testnet vertical slice.**
   One source chain (Ethereum Sepolia), one token family (Circle test USDC), one obligation shape
   (ERC-20 `Transfer`), native-test-CTC escrow instead of a production stablecoin vault, single
   testnet environment (CC3). It is a proof-of-concept for the mechanism, not a lending product.

5. **Source-chain finality and Attestcoin availability gate evidence timing.**
   A payment can only be proven once its block is attested and ingested by the proof builder;
   freeze eligibility additionally requires the attestation frontier to advance past the committed
   window margin. Liveness degradation delays consequences — it can neither fabricate a
   satisfaction nor punish a borrower whose valid transaction simply has not been attested yet.

## Also true

- It does not prove solvency now, invoice legitimacy, absence of payments on unrelated rails,
  health of external positions after the event, uniqueness of real-world asset representation, or
  legal enforceability of any agreement.
- Freeze timing inherits ChainInfo/precompile operational assumptions; margins must be configured
  against realistic attestation cadence (`FrontierNotAdvanced` enforces the rule it is given).
- Smart-contract code is unaudited hackathon software; production use requires independent audit,
  production vault design, legal/identity/risk/servicing layers, and operational monitoring of the
  Attestcoin environment.
