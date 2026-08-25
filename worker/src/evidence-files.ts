import { readFile } from 'node:fs/promises';
import { fromRepoRoot } from './config.js';

export async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(fromRepoRoot(path), 'utf8')) as T;
}

export async function resolveSourceTxHash(): Promise<string> {
  const env = process.env.SOURCE_TX_HASH?.trim();
  if (env && /^0x[0-9a-fA-F]{64}$/.test(env)) return env;
  const source = await readJson<{ txHash: string }>('evidence/happy-path/source-payment.json');
  if (!/^0x[0-9a-fA-F]{64}$/.test(source.txHash)) throw new Error('source-payment.json contains an invalid transaction hash.');
  return source.txHash;
}

export async function resolveDemoIds(): Promise<{ facilityId: bigint; covenantId: bigint }> {
  const facilityEnv = process.env.DEMO_FACILITY_ID?.trim();
  const covenantEnv = process.env.DEMO_COVENANT_ID?.trim();
  if (facilityEnv && covenantEnv) return { facilityId: BigInt(facilityEnv), covenantId: BigInt(covenantEnv) };
  const setup = await readJson<{ facilityId: string; covenantId: string }>('evidence/happy-path/demo-setup.json');
  return { facilityId: BigInt(facilityEnv || setup.facilityId), covenantId: BigInt(covenantEnv || setup.covenantId) };
}
