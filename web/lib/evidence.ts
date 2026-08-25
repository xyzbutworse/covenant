import { readFile } from 'node:fs/promises';
import path from 'node:path';

/**
 * Loads real adversarial-evidence records produced by the repository's attack campaign.
 * Live-chain records come from worker/src/attacks.ts runs; local deterministic records
 * are exported from actual `forge test` runs. Missing files degrade to empty lists —
 * never to fabricated data.
 */

export interface AttackRecord {
  id: string;
  kind: 'live-chain' | 'local-foundry-adversarial';
  title?: string;
  outcome?: string;
  invariantDefended?: string;
  revertReason?: string | null;
  rejectionTxHash?: string | null;
  revertedOnChain?: boolean | null;
  inputTransaction?: string | null;
  proofOrCallIdentifier?: string | null;
  facilityId?: string;
  covenantId?: string;
  notes?: string | null;
  observedResult?: string;
  layer?: string;
  sourceSuite?: string;
}

const repoEvidenceDir = path.join(process.cwd(), '..', 'evidence', 'attacks');

async function readJsonSafe<T>(file: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(file, 'utf8')) as T;
  } catch {
    return null;
  }
}

export async function loadLiveAttackRecords(): Promise<AttackRecord[]> {
  if (process.env.NEXT_PUBLIC_EVIDENCE_MODE === 'off') return [];
  const dirListing = await readFile(path.join(repoEvidenceDir, 'index.json'), 'utf8').catch(() => null);
  void dirListing;
  const ids = [
    'L01-replay-consumed-proof',
    'L02-wrong-covenant-evidence',
    'L03-sub-threshold-payment',
    'L04-outside-window-payment',
    'L05-wrong-recipient',
    'L06-wrong-payer',
    'L07-wrong-token-emitter',
    'L08-cross-facility-replay',
    'L09-early-freeze',
    'L10a-cancel-after-acceptance',
    'L10b-repropose-over-active',
    'L11-unauthorized-draw',
    'L12-lender-early-withdrawal',
  ];
  const records: AttackRecord[] = [];
  for (const id of ids) {
    const record = await readJsonSafe<AttackRecord>(path.join(repoEvidenceDir, `${id}.json`));
    if (record) records.push(record);
  }
  return records;
}

export interface LocalAdversarialIndex {
  exported: number;
  missingFromRun: string[];
  totalsLine: string;
  disclaimer: string;
  generatedAtUTC: string;
}

export async function loadLocalAdversarialIndex(): Promise<{
  index: LocalAdversarialIndex | null;
  highlights: AttackRecord[];
}> {
  const index = await readJsonSafe<LocalAdversarialIndex>(path.join(repoEvidenceDir, 'local', 'index.json'));
  const highlightIds = [
    'P01-invalid-merkle-proof',
    'P09-reverted-source-tx',
    'P13-sub-threshold-no-unlock',
    'P15-cross-covenant-replay',
    'E01-frontier-behind-never-freezes',
    'C04-lender-early-withdrawal',
  ];
  const highlights: AttackRecord[] = [];
  for (const id of highlightIds) {
    const record = await readJsonSafe<AttackRecord>(path.join(repoEvidenceDir, 'local', `${id}.json`));
    if (record) highlights.push(record);
  }
  return { index, highlights };
}
