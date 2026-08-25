# Evidence directory

Do not populate this folder with screenshots pretending to be chain evidence.

## happy-path/

Store:

- `source-payment.json` — source chain tx/receipt metadata
- `proof.json` — proof builder output used for the live submission
- `creditcoin-evidence.json` — evidence submission tx/receipt
- `post-state.json` — facility/covenant state after settlement

## attacks/

Machine-readable records, one per negative path. `kind` distinguishes the two evidence classes:

- `L*.json` — `kind:"live-chain"` — real rejected transactions on CC3/Sepolia (hash + revert reason + before/after state). Populated by `npm run worker:attacks`; currently honest SKIPPED records until funded keys exist.
- `local/*.json` — `kind:"local-foundry-adversarial"` — deterministic Foundry attacks against etched precompile doubles. NOT chain activity.
- `_proofs/` — proof payloads captured for each live attack input.

See docs/ADVERSARIAL_EVIDENCE.md for the full map.
