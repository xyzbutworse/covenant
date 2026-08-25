# COVENANT submission, BUIDL CTC 2026 Fall

## Headline

COVENANT, Credit lines that unlock only when external obligations are cryptographically proven.

## Links

- Live judge page: https://covenant-delta.vercel.app/judge
- Public repository: https://github.com/xyzbutworse/covenant
- Clean-browser demo: [59-second MP4](./evidence/site/covenant-demo-60s.mp4)
- Deployment manifest: [evidence/deployments.json](./evidence/deployments.json)
- Reproducible judge path: `./scripts/replay-demo.sh`

## What COVENANT does

COVENANT is a Creditcoin credit facility whose later tranches become drawable only after Attestcoin proves an agreed external payment. The live run used Circle test USDC on Ethereum Sepolia. Creditcoin verified the source receipt through the native Attestcoin verifier, COVENANT decoded and checked the payment fields, emitted `CovenantSatisfied`, and expanded the borrower draw allowance by one tranche.

## Six-link causal evidence

1. [Sepolia payment transaction](https://sepolia.etherscan.io/tx/0x6e5310a09814b6ffa301405c8046279623afa5e9f910d00c8102b40772cea545)
2. [Attestcoin proof metadata](https://github.com/xyzbutworse/covenant/blob/main/evidence/happy-path/proof.json)
3. [Creditcoin verification transaction](https://creditcoin-testnet.blockscout.com/tx/0xc7a0099ddf65af11e91b687f4f3bebe4179c9d4982b6ded8a63c76e8b00f6d20)
4. [CovenantSatisfied event log](https://creditcoin-testnet.blockscout.com/tx/0xc7a0099ddf65af11e91b687f4f3bebe4179c9d4982b6ded8a63c76e8b00f6d20?tab=logs)
5. [Proof-conditioned tranche draw](https://creditcoin-testnet.blockscout.com/tx/0xff132b95ec49c27a7e43529ec4f30ebd5b773b9359a87aecfba9d86b4319f0c2)
6. [Replay rejection, QueryAlreadyProcessed](https://creditcoin-testnet.blockscout.com/tx/0xbc692c2ef0c871462587ca02748f85fe1adaa6fee6a8a4b6f7111c2ee16dbacd)

All six links returned HTTP 200 during the final clean-browser verification.

## Deployments

- Network: Creditcoin CC3 testnet, chain ID 102031
- COVENANT facility: [0xEa07D0995993C86e32923c16e1eBA92c21a2Fbc9](https://creditcoin-testnet.blockscout.com/address/0xEa07D0995993C86e32923c16e1eBA92c21a2Fbc9)
- EvmV1Decoder: [0x5580BAceCD2e81dC75bD0aE30A6D21e3170a12b7](https://creditcoin-testnet.blockscout.com/address/0x5580BAceCD2e81dC75bD0aE30A6D21e3170a12b7)
- Source verification: complete for both deployed contracts on Creditcoin Blockscout

The first deployment attempt and its library-linking failure remain preserved under `evidence/failed-attempts/`.

## Live security evidence

The public attack campaign includes on-chain evidence for:

- replay rejection
- insufficient payment with no tranche expansion
- wrong recipient rejection
- wrong payer rejection
- early freeze rejection
- unauthorized draw rejection
- premature lender withdrawal rejection

Each record stores public transaction hashes, expected revert reasons, and before and after state under `evidence/attacks/`. Proof-layer cases that require malformed proof construction remain labeled as local Foundry evidence.

## Verification status

- 58 Foundry tests passed
- 0 failed
- 0 skipped
- 7 stateful invariants passed
- worker and web TypeScript checks passed
- web lint passed
- production Next.js build passed
- tracked files and full Git history passed gitleaks scans
- `/judge` passed clean desktop and 390 px mobile checks
- `/facility` showed live CC3 facility 1, covenant 1 SATISFIED, and 4 CTC drawn
- `/attacks` loaded real live-chain records with no fixture fallback

## Honest limits

COVENANT proves completion of the specified historical obligation inside the accepted block window. Missing evidence does not prove a borrower never paid elsewhere. The public site separates live-chain records from local malformed-proof tests and skipped cases.
