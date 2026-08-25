import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { Contract, JsonRpcProvider, Wallet } from 'ethers';
import { covenantAbi } from './abi.js';
import { cfg, fromRepoRoot } from './config.js';
import { resolveDemoIds } from './evidence-files.js';

const provider = new JsonRpcProvider(cfg.creditcoinRpc());
const borrower = new Wallet(cfg.sourcePrivateKey(), provider);
const contract = new Contract(cfg.covenantAddress(), covenantAbi, borrower);
const { facilityId, covenantId } = await resolveDemoIds();

const [facilityBefore, covenantBefore, availableBefore] = await Promise.all([
  contract.facilities(facilityId),
  contract.covenants(covenantId),
  contract.availableToDraw(facilityId),
]);

if (Number(covenantBefore.status) !== 3) {
  throw new Error(`Covenant ${covenantId} is not Satisfied. Status=${covenantBefore.status}`);
}

const tranche = facilityBefore.trancheSize as bigint;
if ((availableBefore as bigint) < tranche) {
  throw new Error(`Next tranche is not fully available. available=${availableBefore} tranche=${tranche}`);
}

const tx = await contract.draw(facilityId, tranche);
console.log(`Drawing proof-unlocked tranche: ${tx.hash}`);
const receipt = await tx.wait();
if (!receipt || receipt.status !== 1) throw new Error(`Next-tranche draw failed: ${tx.hash}`);

const [facilityAfter, availableAfter] = await Promise.all([
  contract.facilities(facilityId),
  contract.availableToDraw(facilityId),
]);

const record = {
  facilityId: facilityId.toString(),
  covenantId: covenantId.toString(),
  borrower: borrower.address,
  drawAmountWei: tranche.toString(),
  transactionHash: tx.hash,
  creditcoinBlock: receipt.blockNumber,
  receiptStatus: receipt.status,
  before: {
    unlockedWei: (facilityBefore.unlocked as bigint).toString(),
    drawnWei: (facilityBefore.drawn as bigint).toString(),
    availableToDrawWei: (availableBefore as bigint).toString(),
  },
  after: {
    unlockedWei: (facilityAfter.unlocked as bigint).toString(),
    drawnWei: (facilityAfter.drawn as bigint).toString(),
    availableToDrawWei: (availableAfter as bigint).toString(),
  },
  capturedAt: new Date().toISOString(),
};

const file = fromRepoRoot('evidence/happy-path/next-tranche-draw.json');
await mkdir(dirname(file), { recursive: true });
await writeFile(file, JSON.stringify(record, null, 2));
console.log(`Recorded next-tranche draw evidence at ${file}`);
