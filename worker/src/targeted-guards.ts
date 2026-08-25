import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { Contract, Interface, JsonRpcProvider, Wallet } from 'ethers';
import { covenantAbi } from './abi.js';
import { cfg, fromRepoRoot } from './config.js';

const provider = new JsonRpcProvider(cfg.creditcoinRpc());
const lender = new Wallet(cfg.privateKey(), provider);
const borrower = new Wallet(cfg.sourcePrivateKey(), provider);
const extendedAbi = [
  ...covenantAbi,
  'function nextFacilityId() view returns (uint256)',
  'function nextCovenantId() view returns (uint256)',
] as const;
const lenderContract = new Contract(cfg.covenantAddress(), extendedAbi, lender);
const borrowerContract = new Contract(cfg.covenantAddress(), extendedAbi, borrower);
const errorInterface = new Interface([
  'error ProofDeadlineNotReached()',
  'error QueryAlreadyProcessed()',
]);

type Proof = {
  chainKey: number | string;
  headerNumber: number | string;
  txBytes: string;
  merkleProof: { root: string; siblings: Array<{ hash: string; isLeft: boolean }> };
  continuityProof: { lowerEndpointDigest: string; roots: string[] };
};

function decodeReason(error: unknown): string {
  const value = error as {
    data?: unknown;
    info?: { error?: { data?: unknown } };
    shortMessage?: string;
    message?: string;
  };
  const raw = value.data ?? value.info?.error?.data;
  if (typeof raw === 'string') {
    try {
      const parsed = errorInterface.parseError(raw);
      return `${parsed?.name}()`;
    } catch {
      return `raw revert data ${raw}`;
    }
  }
  return value.shortMessage ?? value.message ?? String(error);
}

async function rejectedCall(functionName: string, args: readonly unknown[], gasLimit: bigint) {
  const data = lenderContract.interface.encodeFunctionData(functionName, args as never[]);
  let reason = 'NO REVERT';
  try {
    await provider.call({ to: cfg.covenantAddress(), from: lender.address, data });
  } catch (error) {
    reason = decodeReason(error);
  }
  if (reason === 'NO REVERT') throw new Error(`${functionName} simulation did not revert`);

  const tx = await lender.sendTransaction({ to: cfg.covenantAddress(), data, gasLimit });
  const receipt = await provider.waitForTransaction(tx.hash);
  if (!receipt || receipt.status !== 0) throw new Error(`${functionName} was not rejected on-chain: ${tx.hash}`);
  return { transactionHash: tx.hash, blockNumber: receipt.blockNumber, reason };
}

const proof = JSON.parse(
  await readFile(fromRepoRoot('evidence/happy-path/proof.json'), 'utf8'),
) as Proof;
const setup = JSON.parse(
  await readFile(fromRepoRoot('evidence/happy-path/demo-setup.json'), 'utf8'),
) as Record<string, string>;
const submission = JSON.parse(
  await readFile(fromRepoRoot('evidence/happy-path/attestcoin-submission.json'), 'utf8'),
) as { events: Array<{ name: string; args: string[] }> };
const sourcePayment = JSON.parse(
  await readFile(fromRepoRoot('evidence/happy-path/source-payment.json'), 'utf8'),
) as { txHash: string };

const facilityId = await lenderContract.nextFacilityId() as bigint;
const covenantId = await lenderContract.nextCovenantId() as bigint;
const creditHead = BigInt(await provider.getBlockNumber());
const proofBlock = BigInt(proof.headerNumber);

const facilityTx = await lenderContract.createFacility(
  borrower.address,
  BigInt(setup.trancheWei),
  creditHead + 10_000n,
  { value: BigInt(setup.creditLimitWei), gasLimit: 500_000n },
);
await facilityTx.wait();

const covenantTx = await lenderContract.createCovenant(
  facilityId,
  BigInt(proof.chainKey),
  cfg.sourceUsdc(),
  setup.recipient,
  BigInt(setup.requiredUsdcRaw),
  proofBlock - 1n,
  proofBlock + 1n,
  creditHead + 1_000n,
  50n,
  { gasLimit: 400_000n },
);
await covenantTx.wait();

const acceptTx = await borrowerContract.acceptCovenant(covenantId, { gasLimit: 200_000n });
await acceptTx.wait();

const earlyFreeze = await rejectedCall('freezeExpiredCovenant', [covenantId], 300_000n);
const replayArgs = [
  covenantId,
  BigInt(proof.chainKey),
  proofBlock,
  proof.txBytes,
  proof.merkleProof.root,
  proof.merkleProof.siblings,
  proof.continuityProof.lowerEndpointDigest,
  proof.continuityProof.roots,
] as const;
const replay = await rejectedCall('submitEvidence', replayArgs, 800_000n);

const satisfied = submission.events.find((event) => event.name === 'EvidenceAccepted');
const queryId = satisfied?.args[1] ?? null;
const explorer = 'https://creditcoin-testnet.blockscout.com';
const common = {
  kind: 'live-chain',
  network: 'Creditcoin CC3 Testnet (102031) / Ethereum Sepolia (11155111)',
  contract: cfg.covenantAddress(),
  facilityId: facilityId.toString(),
  covenantId: covenantId.toString(),
  setupTransactions: {
    facility: facilityTx.hash,
    covenant: covenantTx.hash,
    acceptance: acceptTx.hash,
  },
  stateAfter: {
    covenantStatus: Number((await lenderContract.covenants(covenantId)).status),
    availableToDrawWei: (await lenderContract.availableToDraw(facilityId)).toString(),
  },
};

const freezeRecord = {
  id: 'L09-early-freeze',
  ...common,
  title: 'Freeze before the Creditcoin proof deadline',
  invariantDefended: 'A pending covenant cannot freeze before its committed CC3 proof deadline',
  recordedAtUTC: new Date().toISOString(),
  inputTransaction: null,
  proofOrCallIdentifier: `freezeExpiredCovenant(${covenantId})`,
  rejectionTxHash: earlyFreeze.transactionHash,
  transactionExplorer: `${explorer}/tx/${earlyFreeze.transactionHash}`,
  creditcoinBlock: earlyFreeze.blockNumber,
  revertedOnChain: true,
  revertReason: earlyFreeze.reason,
  outcome: 'rejected',
  notes: 'Dedicated pending covenant with a future proof deadline. State remained pending after rejection.',
};

const replayRecord = {
  id: 'L01-replay-consumed-proof',
  ...common,
  title: 'Consumed Attestcoin query reused against a fresh pending covenant',
  invariantDefended: 'processedQueries is global across facilities and covenants',
  recordedAtUTC: new Date().toISOString(),
  inputTransaction: sourcePayment.txHash,
  proofOrCallIdentifier: queryId,
  rejectionTxHash: replay.transactionHash,
  transactionExplorer: `${explorer}/tx/${replay.transactionHash}`,
  creditcoinBlock: replay.blockNumber,
  revertedOnChain: true,
  revertReason: replay.reason,
  outcome: 'rejected',
  notes: 'The fresh covenant window includes the original source block, isolating the global consumed-query guard.',
};

for (const record of [freezeRecord, replayRecord]) {
  const file = fromRepoRoot(`evidence/attacks/${record.id}.json`);
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(record, null, 2));
  console.log(`${record.id}: ${record.rejectionTxHash} ${record.revertReason}`);
}
