import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { Contract, JsonRpcProvider, Wallet, parseEther } from 'ethers';
import { cfg, fromRepoRoot, optional } from './config.js';
import { covenantAbi } from './abi.js';

const creditProvider = new JsonRpcProvider(cfg.creditcoinRpc());
const sourceProvider = new JsonRpcProvider(cfg.sourceRpc());
const lender = new Wallet(cfg.privateKey(), creditProvider);
const borrower = new Wallet(cfg.sourcePrivateKey()).address;
const contract = new Contract(cfg.covenantAddress(), covenantAbi, lender);

const limit = parseEther(optional('DEMO_CREDIT_LIMIT_CTC', '10'));
const tranche = parseEther(optional('DEMO_TRANCHE_CTC', '2'));
const sourceWindowBlocks = BigInt(optional('DEMO_SOURCE_WINDOW_BLOCKS', '100'));
const proofWindowBlocks = BigInt(optional('DEMO_PROOF_DEADLINE_BLOCKS', '300'));
const facilityMaturityBlocks = BigInt(optional('DEMO_FACILITY_MATURITY_BLOCKS', '1200'));
// How far past the eligible source window the Attestcoin frontier must advance before a
// missed-deadline freeze is allowed. Protects the borrower from premature punishment.
const freezeFrontierMargin = BigInt(optional('DEMO_FREEZE_FRONTIER_MARGIN_BLOCKS', '50'));

const creditHeadBefore = await creditProvider.getBlockNumber();
const facilityMaturity = BigInt(creditHeadBefore) + facilityMaturityBlocks;
console.log(`Creating demo facility. Lender=${lender.address} Borrower=${borrower}`);
const facilityTx = await contract.createFacility(borrower, tranche, facilityMaturity, { value: limit });
console.log(`Facility transaction: ${facilityTx.hash}`);
const facilityReceipt = await facilityTx.wait();
if (!facilityReceipt) throw new Error('Missing facility receipt.');

let facilityId: bigint | null = null;
for (const log of facilityReceipt.logs) {
  try {
    const parsed = contract.interface.parseLog(log);
    if (parsed?.name === 'FacilityCreated') facilityId = parsed.args.facilityId as bigint;
  } catch {}
}
if (facilityId == null) throw new Error('FacilityCreated event not found.');

// Draw the initial tranche from the borrower account so the demo begins with real business activity.
// This borrower therefore needs a small amount of test CTC for gas before setup.
const borrowerOnCreditcoin = new Wallet(cfg.sourcePrivateKey(), creditProvider);
const borrowerContract = new Contract(cfg.covenantAddress(), covenantAbi, borrowerOnCreditcoin);
const drawTx = await borrowerContract.draw(facilityId, tranche);
console.log(`Initial tranche draw transaction: ${drawTx.hash}`);
await drawTx.wait();

const [sourceHead, creditHead] = await Promise.all([
  sourceProvider.getBlockNumber(),
  creditProvider.getBlockNumber(),
]);
const startSourceBlock = BigInt(sourceHead);
const endSourceBlock = startSourceBlock + sourceWindowBlocks;
const proofDeadline = BigInt(creditHead) + proofWindowBlocks;

console.log(`Creating covenant for Sepolia blocks ${startSourceBlock}..${endSourceBlock}`);
const covenantTx = await contract.createCovenant(
  facilityId,
  BigInt(cfg.sourceChainKey()),
  cfg.sourceUsdc(),
  cfg.recipient(),
  cfg.requiredUsdcRaw(),
  startSourceBlock,
  endSourceBlock,
  proofDeadline,
  freezeFrontierMargin,
);
console.log(`Covenant transaction: ${covenantTx.hash}`);
const covenantReceipt = await covenantTx.wait();
if (!covenantReceipt) throw new Error('Missing covenant receipt.');

let covenantId: bigint | null = null;
for (const log of covenantReceipt.logs) {
  try {
    const parsed = contract.interface.parseLog(log);
    if (parsed?.name === 'CovenantCreated') covenantId = parsed.args.covenantId as bigint;
  } catch {}
}
if (covenantId == null) throw new Error('CovenantCreated event not found.');

// The borrower must accept the proposed evidence policy. This signer is the same EVM account used on Sepolia.
const acceptTx = await borrowerContract.acceptCovenant(covenantId);
console.log(`Borrower acceptance transaction: ${acceptTx.hash}`);
await acceptTx.wait();

const record = {
  lender: lender.address,
  borrower,
  contract: cfg.covenantAddress(),
  facilityId: facilityId.toString(),
  covenantId: covenantId.toString(),
  creditLimitWei: limit.toString(),
  trancheWei: tranche.toString(),
  sourceChainKey: cfg.sourceChainKey(),
  sourceToken: cfg.sourceUsdc(),
  recipient: cfg.recipient(),
  requiredUsdcRaw: cfg.requiredUsdcRaw().toString(),
  startSourceBlock: startSourceBlock.toString(),
  endSourceBlock: endSourceBlock.toString(),
  proofDeadlineCreditcoinBlock: proofDeadline.toString(),
  freezeFrontierMarginSourceBlocks: freezeFrontierMargin.toString(),
  facilityMaturityCreditcoinBlock: facilityMaturity.toString(),
  facilityTxHash: facilityTx.hash,
  initialDrawTxHash: drawTx.hash,
  covenantTxHash: covenantTx.hash,
  covenantAcceptTxHash: acceptTx.hash,
  capturedAt: new Date().toISOString(),
};
const file = fromRepoRoot('evidence/happy-path/demo-setup.json');
await mkdir(dirname(file), { recursive: true });
await writeFile(file, JSON.stringify(record, null, 2));

console.log(`Facility #${facilityId} / Covenant #${covenantId} ready.`);
console.log(`Evidence record: ${file}`);
console.log(`Next: ensure SOURCE_WALLET_PRIVATE_KEY has test USDC and run npm run worker:pay`);
