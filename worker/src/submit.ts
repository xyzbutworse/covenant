import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { Contract, JsonRpcProvider, Wallet } from 'ethers';
import { cfg, fromRepoRoot } from './config.js';
import { covenantAbi } from './abi.js';
import { resolveDemoIds, resolveSourceTxHash } from './evidence-files.js';
import { buildProof, jsonSafe } from './proof.js';

type SavedProof = {
  chainKey: number | string;
  headerNumber: number | string;
  txBytes: string;
  merkleProof: { root: string; siblings: Array<{ hash: string; isLeft: boolean }> };
  continuityProof: { lowerEndpointDigest: string; roots: string[] };
};

const provider = new JsonRpcProvider(cfg.creditcoinRpc());
const source = new JsonRpcProvider(cfg.sourceRpc());
const wallet = new Wallet(cfg.submitterPrivateKey(), provider);
const contract = new Contract(cfg.covenantAddress(), covenantAbi, wallet);

const proofMode = cfg.proofSource();
let proof: SavedProof;

if (proofMode === 'fresh') {
  const txHash = await resolveSourceTxHash();
  console.log(`Building fresh Attestcoin proof for ${txHash} immediately before submission...`);
  const built = await buildProof({
    txHash,
    chainKey: cfg.sourceChainKey(),
    proofBuilderUrl: cfg.proofBuilderUrl(),
    creditcoinProvider: provider,
    sourceProvider: source,
  });
  if (Number(built.chainKey) !== cfg.sourceChainKey()) {
    throw new Error(
      `Proof builder returned chainKey ${built.chainKey} but SOURCE_CHAIN_KEY is ${cfg.sourceChainKey()}.`,
    );
  }
  const file = fromRepoRoot(cfg.proofFile());
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, jsonSafe(built));
  console.log(`Fresh proof written to ${file}`);
  proof = built;
} else {
  const file = fromRepoRoot(cfg.proofFile());
  const stats = await stat(file);
  const ageMs = Date.now() - stats.mtimeMs;
  if (ageMs > cfg.proofMaxAgeMs()) {
    throw new Error(
      `Cached proof is ${Math.round(ageMs / 1000)}s old (limit ${cfg.proofMaxAgeMs() / 1000}s). ` +
        'Continuity material is time-sensitive: re-run `npm run worker:prove` or use PROOF_SOURCE=fresh.',
    );
  }
  proof = JSON.parse(await readFile(file, 'utf8')) as SavedProof;
  console.log(`Submitting cached proof from ${file} (age ${Math.round(ageMs / 1000)}s).`);
}

const { covenantId } = await resolveDemoIds();
const args = [
  covenantId,
  BigInt(proof.chainKey),
  BigInt(proof.headerNumber),
  proof.txBytes,
  proof.merkleProof.root,
  proof.merkleProof.siblings,
  proof.continuityProof.lowerEndpointDigest,
  proof.continuityProof.roots,
] as const;

const data = contract.interface.encodeFunctionData('submitEvidence', args);
const continuityLength = proof.continuityProof.roots.length || 1;
let gasLimit: bigint;
try {
  const estimated = await provider.estimateGas({ from: wallet.address, to: cfg.covenantAddress(), data });
  gasLimit = (estimated * 135n) / 100n;
} catch (error) {
  // Matches the current Creditcoin example workaround for precompile estimate failures.
  gasLimit = BigInt(21_000 + continuityLength * 5_000 + 120_000);
  console.warn(`Gas estimation failed; using continuity-sized fallback ${gasLimit}.`, error);
}

const tx = await contract.submitEvidence(...args, { gasLimit });
console.log(`Submitted evidence via ${wallet.address} (any valid proof works regardless of submitter): ${tx.hash}`);
const receipt = await tx.wait();
console.log(`Mined in Creditcoin block ${receipt.blockNumber}`);
const parsedEvents: Array<Record<string, unknown>> = [];
for (const log of receipt.logs) {
  try {
    const parsed = contract.interface.parseLog(log);
    if (parsed) {
      console.log(parsed.name, parsed.args);
      parsedEvents.push({
        name: parsed.name,
        args: Array.from(parsed.args).map((value) => typeof value === 'bigint' ? value.toString() : String(value)),
      });
    }
  } catch {
    // Other logs, including precompile logs, may not match our ABI.
  }
}

const evidenceFile = fromRepoRoot('evidence/happy-path/attestcoin-submission.json');
await mkdir(dirname(evidenceFile), { recursive: true });
await writeFile(evidenceFile, JSON.stringify({
  covenantId: covenantId.toString(),
  creditcoinTxHash: tx.hash,
  creditcoinBlock: receipt.blockNumber,
  submitter: wallet.address,
  sourceChainKey: String(proof.chainKey),
  sourceBlock: String(proof.headerNumber),
  proofFile: cfg.proofFile(),
  proofSource: proofMode,
  events: parsedEvents,
  capturedAt: new Date().toISOString(),
}, null, 2));
console.log(`Recorded Creditcoin evidence at ${evidenceFile}`);
