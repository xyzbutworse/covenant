# Submission checklist — BUIDL CTC 2026 Fall

Paste-ready content for the submission portal. Keep this file in sync with reality.

## Ready now (verified in-repo)

- **Name:** COVENANT
- **One-liner:** Credit lines on Creditcoin that unlock only when Attestcoin cryptographically proves the borrower's agreed external payment.
- **Track:** Creditcoin / Attestcoin native query-verifier integration (CC3 testnet, `0x…0FD2` + `0x…0FD3`).
- **Repo:** public GitHub URL of this repository (create the repo and push the existing clean commit; secret scan already passed on the tracked tree).
- **Judge path:** `./scripts/replay-demo.sh` — wallet-free evidence/environment verification.
- **Docs:** README (reviewer-ordered), docs/* incl. THREAT_MODEL, LIMITATIONS, ADVERSARIAL_EVIDENCE, JUDGE_GUIDE.

## Blocked on funded test keys (documented, not faked)

The following portal fields must be filled after one funded session of
`deploy-contracts.sh` → fund wallets → `run-happy-path.sh`:

- [ ] Live deployment addresses + explorer links (`evidence/deployments.json` auto-updates)
- [ ] Real Sepolia USDC payment tx hash (`evidence/happy-path/source-payment.json`)
- [ ] Real Attestcoin proof artifact + settlement tx (`evidence/happy-path/proof.json`, `attestcoin-submission.json`)
- [ ] Re-run `npm run worker:attacks` to convert L01–L12 SKIPPED records into real rejection hashes
- [ ] Demo video / GIF (suggested 60s script = docs/JUDGE_GUIDE.md sections 0–60s, screen-capture replay-demo.sh → /judge → /facility → /attacks)

## Public URL

Host `web/` (any Node host): set server env `CREDITCOIN_RPC_URL`,
`COVENANT_CONTRACT_ADDRESS`, and the NEXT_PUBLIC_* values from `web/.env.example`, then
`npm run build && npm --workspace web start`. The app explains itself with demo fixtures labeled
when the contract env is absent, and shows an explicit "LIVE READ UNAVAILABLE" reason when the
RPC is configured but unreachable.
