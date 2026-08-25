# Codex cleanup brief

When the live proof loop is working, give Codex this repository and ask it to:

1. compile and test every package with the exact installed dependency versions;
2. compare the Attestcoin calls against the current official `attestcoin-protocol-examples` / `usc-testnet-bridge-examples` implementation and fix any API drift;
3. add a mock native verifier at `0x0FD2` with `vm.etch` so contract tests exercise the exact production call surface;
4. build encoded EVM v1 receipt fixtures for valid and invalid Circle-USDC Transfer evidence;
5. expand Foundry adversarial tests to all cases in `docs/THREAT_MODEL.md`;
6. add live integration scripts that produce machine-readable evidence JSON;
7. source-verify the final deployed contract and write explorer URLs into `evidence/deployments.json`;
8. make the web app consume the actual deployment/evidence JSON instead of demo placeholders;
9. add Playwright judge-flow tests for desktop and mobile;
10. preserve the existing visual direction: black field, white typography, restrained violet, dense proof/data texture, no generic Web3 gradients or glass-card spam.

Do not change the product thesis or add unrelated features.
