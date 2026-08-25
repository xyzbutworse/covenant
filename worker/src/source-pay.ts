import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { Contract, JsonRpcProvider, Wallet, formatUnits } from 'ethers';
import { cfg, fromRepoRoot } from './config.js';
import { erc20Abi } from './abi.js';

const provider = new JsonRpcProvider(cfg.sourceRpc());
const wallet = new Wallet(cfg.sourcePrivateKey(), provider);
const token = new Contract(cfg.sourceUsdc(), erc20Abi, wallet);
const recipient = cfg.recipient();
const amount = cfg.requiredUsdcRaw();

const balance = await token.balanceOf(wallet.address) as bigint;
if (balance < amount) {
  throw new Error(`Insufficient source USDC. Wallet ${wallet.address} has ${formatUnits(balance, 6)} but obligation requires ${formatUnits(amount, 6)}.`);
}

console.log(`Paying covenant source obligation from ${wallet.address}`);
console.log(`Token: ${cfg.sourceUsdc()}`);
console.log(`Recipient: ${recipient}`);
console.log(`Amount: ${formatUnits(amount, 6)} test USDC`);

const tx = await token.transfer(recipient, amount);
console.log(`Source transaction submitted: ${tx.hash}`);
const receipt = await tx.wait();
if (!receipt) throw new Error('Source transaction receipt was not returned.');
if (receipt.status !== 1) throw new Error(`Source payment reverted: ${tx.hash}`);

const record = {
  chain: 'Ethereum Sepolia',
  token: cfg.sourceUsdc(),
  payer: wallet.address,
  recipient,
  rawAmount: amount.toString(),
  humanAmount: formatUnits(amount, 6),
  txHash: tx.hash,
  blockNumber: receipt.blockNumber,
  status: receipt.status,
  capturedAt: new Date().toISOString(),
};

const file = fromRepoRoot('evidence/happy-path/source-payment.json');
await mkdir(dirname(file), { recursive: true });
await writeFile(file, JSON.stringify(record, null, 2));
console.log(`Recorded source evidence at ${file}`);
console.log(`Next: set SOURCE_TX_HASH=${tx.hash} and run npm run worker:prove`);
