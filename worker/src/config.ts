import dotenv from 'dotenv';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../..');
const envCandidates = [
  process.env.COVENANT_ENV_FILE,
  resolve(process.env.INIT_CWD || '', '.env'),
  resolve(repoRoot, '.env'),
  resolve(here, '../.env'),
].filter(Boolean) as string[];

for (const path of envCandidates) {
  if (existsSync(path)) {
    dotenv.config({ path });
    break;
  }
}

export function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export function optional(name: string, fallback = ''): string {
  return process.env[name]?.trim() || fallback;
}

export function fromRepoRoot(path: string): string {
  return resolve(repoRoot, path);
}

export const cfg = {
  repoRoot: () => repoRoot,
  creditcoinRpc: () => required('CREDITCOIN_RPC_URL'),
  proofBuilderUrl: () => required('CREDITCOIN_PROOF_BUILDER_URL'),
  privateKey: () => required('CREDITCOIN_WALLET_PRIVATE_KEY'),
  // Evidence submission is permissionless on-chain; this only picks who pays gas.
  submitterPrivateKey: () => process.env.SUBMITTER_PRIVATE_KEY?.trim() || required('CREDITCOIN_WALLET_PRIVATE_KEY'),
  covenantAddress: () => required('COVENANT_CONTRACT_ADDRESS'),
  sourceRpc: () => required('SOURCE_CHAIN_RPC_URL'),
  sourcePrivateKey: () => process.env.SOURCE_WALLET_PRIVATE_KEY?.trim() || required('CREDITCOIN_WALLET_PRIVATE_KEY'),
  sourceChainKey: () => Number(required('SOURCE_CHAIN_KEY')),
  sourceUsdc: () => required('SOURCE_USDC_ADDRESS'),
  txHash: () => required('SOURCE_TX_HASH'),
  proofFile: () => optional('PROOF_FILE', 'evidence/happy-path/proof.json'),
  // 'fresh' (default) rebuilds the proof immediately before submission;
  // 'file' submits an existing artifact after a staleness check.
  proofSource: (): 'fresh' | 'file' => {
    const value = optional('PROOF_SOURCE', 'fresh').toLowerCase();
    if (value !== 'fresh' && value !== 'file') {
      throw new Error(`PROOF_SOURCE must be 'fresh' or 'file', got: ${value}`);
    }
    return value as 'fresh' | 'file';
  },
  proofMaxAgeMs: () => Number(optional('PROOF_MAX_AGE_SECONDS', '900')) * 1000,
  covenantId: () => BigInt(required('DEMO_COVENANT_ID')),
  recipient: () => required('DEMO_PAYMENT_RECIPIENT'),
  requiredUsdcRaw: () => BigInt(optional('DEMO_REQUIRED_USDC', '5000000')),
  // --- adversarial campaign (optional overrides) ---
  altSourcePrivateKey: () => process.env.SOURCE_ALT_PRIVATE_KEY?.trim() || null,
  wrongTokenAddress: () => process.env.SOURCE_WRONG_TOKEN_ADDRESS?.trim() || null,
};
