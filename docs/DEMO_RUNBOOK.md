# Live demo runbook

## 1. Configure

Copy `.env.example` to `.env` and set:

- Creditcoin RPC where native Attestcoin precompiles are live;
- proof-builder URL;
- fresh test-only lender private key;
- fresh test-only borrower/source private key;
- Sepolia RPC;
- designated payment recipient.

Do not paste production keys into this repository.

## 2. Discover before deploying

```bash
npm run worker:discover
```

Record the actual Creditcoin chain ID and the discovered Sepolia `chainKey`. Put that key into `SOURCE_CHAIN_KEY`.

## 3. Deploy

```bash
set -a; source .env; set +a
./scripts/deploy-contracts.sh
```

Put the printed facility address into `COVENANT_CONTRACT_ADDRESS`.

## 4. Fund test wallets

The lender needs enough test CTC to escrow the full line plus gas.

The borrower/source address needs:

- a small amount of test CTC for `draw` / `acceptCovenant` gas on Creditcoin;
- Sepolia ETH for source transaction gas;
- enough Circle test USDC for the obligation.

## 5. Run the complete causal path

```bash
./scripts/run-happy-path.sh
```

The script performs:

1. Attestcoin network discovery;
2. funded facility creation;
3. initial borrower draw;
4. lender covenant proposal;
5. borrower acceptance;
6. real Sepolia USDC payment;
7. attestation wait + fresh proof generation;
8. permissionless evidence submission;
9. final facility/covenant state inspection.

## 6. Preserve proof

Copy all explorer URLs and receipts into `evidence/`. Do not overwrite a successful proof run without archiving it.

## 7. Negative paths

At minimum preserve independently verifiable failures for:

- replayed query identity;
- wrong recipient;
- wrong token emitter;
- source transaction outside policy window;
- freeze after missed proof deadline.

## 8. Judge mode

Configure `web/.env.local` with the deployed contract, RPC and explorer roots. The judge pages must remain useful without a wallet. Wallet connection is only for reproducing writes in the operator console.
