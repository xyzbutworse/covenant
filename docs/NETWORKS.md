# Networks

## Verified live environment (2026 probe — see `evidence/network-probe.json`)

The current official Attestcoin examples repository is
[`gluwa/attestcoin-protocol-examples`](https://github.com/gluwa/attestcoin-protocol-examples)
(formerly `usc-testnet-bridge-examples`). Its published environment was probed read-only and is live:

- **Creditcoin CC3 Testnet** — chainId **102031**, RPC `https://rpc.cc3-testnet.creditcoin.network`
- native BlockProver `0x…0FD2` and ChainInfo `0x…0FD3` respond to calls (empty `eth_getCode` is expected for native precompiles)
- proof builder: `https://prover.cc3-testnet.creditcoin.network` (`/api/v1/attested-height/1` → 200)
- **Sepolia source chain key = 1** (discovered on-chain; Ethereum mainnet = 3)
- Sepolia attestation frontier observed advancing (heights 11,560,320 → 11,560,330 during the probe)

COVENANT's Solidity ChainInfo interface selector (`get_latest_attestation_height_and_hash(uint64)`
= `0x809112da`) was verified byte-compatible against the live precompile.

## Do not hardcode a stale Attestcoin environment

COVENANT therefore treats the execution RPC as configuration, not a compile-time truth.

Before deployment:

1. Set `CREDITCOIN_RPC_URL`.
2. Run `npm run worker:discover`.
3. Confirm the expected source chain appears through ChainInfo at `0x0FD3` and has a progressing latest attested height.
4. Confirm the native BlockProver at `0x0FD2` is available.
5. Record the exact chain ID/RPC/explorer in `evidence/deployments.json`.

## Source chain

The initial proof path uses Ethereum Sepolia and Circle test USDC:

`0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238`

The Sepolia chain key on CC3 testnet is currently `1`; still confirm via discovery at deploy time.
