import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { JsonRpcProvider } from 'ethers';
import { cfg, fromRepoRoot } from './config.js';
import { resolveSourceTxHash } from './evidence-files.js';
import { buildProof, jsonSafe } from './proof.js';

const creditcoin = new JsonRpcProvider(cfg.creditcoinRpc());
const source = new JsonRpcProvider(cfg.sourceRpc());
const file = fromRepoRoot(cfg.proofFile());

const txHash = await resolveSourceTxHash();
const proof = await buildProof({
  txHash,
  chainKey: cfg.sourceChainKey(),
  proofBuilderUrl: cfg.proofBuilderUrl(),
  creditcoinProvider: creditcoin,
  sourceProvider: source,
});

await mkdir(dirname(file), { recursive: true });
await writeFile(file, jsonSafe(proof));
console.log(`Proof written to ${file}`);
