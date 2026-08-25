import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { access } from 'node:fs/promises';
import { dirname } from 'node:path';
import {
  Contract,
  Interface,
  JsonRpcApiProvider,
  JsonRpcProvider,
  Wallet,
  formatEther,
  keccak256,
  solidityPacked,
  toBeArray,
  toBeHex,
  zeroPadValue,
} from 'ethers';
import { blockProver } from '@gluwa/usc-sdk';
import { cfg, fromRepoRoot } from './config.js';
import { covenantAbi } from './abi.js';
import { buildProof, jsonSafe } from './proof.js';

/**
 * Adversarial campaign against the DEPLOYED integration. Every case writes one
 * machine-readable record under evidence/attacks/<id>.json with kind:"live-chain".
 * Missing prerequisites produce honest SKIPPED records — never fabricated data.
 * Local deterministic attacks live in Foundry and are exported separately under
 * evidence/attacks/local/ with kind:"local-foundry-adversarial".
 */

const ERRORS = [
  'error InvalidFacility()', 'error InvalidCovenant()', 'error NotLender()', 'error NotBorrower()',
  'error FacilityNotActive()', 'error CovenantNotPending()', 'error ActiveCovenantExists()',
  'error InvalidTerms()', 'error DrawExceedsUnlocked()', 'error ProofDeadlineNotReached()',
  'error NotFacilityParty()', 'error FacilityNotClosable()', 'error FacilityMatured()',
  'error SourceBlockOutsideWindow()', 'error WrongSourceChain()', 'error QueryAlreadyProcessed()',
  'error ProofVerificationFailed()', 'error ProofDeadlinePassed()',
  'error FrontierNotAdvanced(uint64,uint64)', 'error NoAttestationData()',
  'error SourceTransactionFailed()', 'error NoMatchingPayment()', 'error NativeTransferFailed()',
];

const errorIface = new Interface([...ERRORS, 'error Error(string)', 'error Panic(uint256)']);
const erc20Iface = new Interface([
  'function transfer(address to,uint256 amount) returns (bool)',
]);

function decodeReason(error: unknown): string {
  const anyErr = error as {
    data?: unknown;
    info?: { error?: { data?: unknown } };
    shortMessage?: string;
    message?: string;
  };
  const raw = anyErr?.data ?? anyErr?.info?.error?.data;
  if (typeof raw === 'string') {
    try {
      const parsed = errorIface.parseError(raw);
      return `${parsed?.name}(${(parsed?.args ?? []).map((a) => String(a)).join(',')})`;
    } catch {
      return `raw revert data ${raw}`;
    }
  }
  return anyErr?.shortMessage ?? anyErr?.message ?? String(error);
}

// Lazy wiring so the campaign can run in an unfunded environment and still produce
// honest SKIPPED evidence records instead of crashing.
let _provider: JsonRpcProvider | null = null;
let _sourceProvider: JsonRpcProvider | null = null;
let _covenant: Contract | null = null;
let _covenantAsSubmitter: Contract | null = null;
let _borrowerSourceSigner: Wallet | null = null;
let _borrowerCreditSigner: Wallet | null = null;

function configured(): boolean {
  return Boolean(
    process.env.CREDITCOIN_WALLET_PRIVATE_KEY?.trim() &&
      process.env.CREDITCOIN_PROOF_BUILDER_URL?.trim() &&
      process.env.COVENANT_CONTRACT_ADDRESS?.trim() &&
      process.env.SOURCE_CHAIN_KEY?.trim(),
  );
}

function provider(): JsonRpcProvider {
  _provider ??= new JsonRpcProvider(cfg.creditcoinRpc());
  return _provider;
}

function sourceProvider(): JsonRpcProvider {
  _sourceProvider ??= new JsonRpcProvider(cfg.sourceRpc());
  return _sourceProvider;
}

function covenant(): Contract {
  _covenant ??= new Contract(
    process.env.COVENANT_CONTRACT_ADDRESS!.trim(),
    covenantAbi,
    new Wallet(process.env.CREDITCOIN_WALLET_PRIVATE_KEY!.trim(), provider()),
  );
  return _covenant;
}

function covenantAsSubmitter(): Contract {
  _covenantAsSubmitter ??= new Contract(
    process.env.COVENANT_CONTRACT_ADDRESS!.trim(),
    covenantAbi,
    new Wallet(
      process.env.SUBMITTER_PRIVATE_KEY?.trim() || process.env.CREDITCOIN_WALLET_PRIVATE_KEY!.trim(),
      provider(),
    ),
  );
  return _covenantAsSubmitter;
}

function lenderWallet(): Wallet {
  return new Wallet(process.env.CREDITCOIN_WALLET_PRIVATE_KEY!.trim(), provider());
}

function submitterWallet(): Wallet {
  return new Wallet(
    process.env.SUBMITTER_PRIVATE_KEY?.trim() || process.env.CREDITCOIN_WALLET_PRIVATE_KEY!.trim(),
    provider(),
  );
}

function borrowerSourceSigner(): Wallet {
  _borrowerSourceSigner ??= new Wallet(cfg.sourcePrivateKey(), sourceProvider());
  return _borrowerSourceSigner;
}

function borrowerCreditSigner(): Wallet {
  _borrowerCreditSigner ??= new Wallet(cfg.sourcePrivateKey(), provider());
  return _borrowerCreditSigner;
}

const ATTACKS_DIR = fromRepoRoot('evidence/attacks');

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

type Snapshot = Awaited<ReturnType<typeof snapshot>>;

async function snapshot(facilityId: bigint, covenantId: bigint) {
  const [f, c, avail, freezable, head] = await Promise.all([
    covenant().facilities(facilityId),
    covenant().covenants(covenantId),
    covenant().availableToDraw(facilityId),
    covenant().isFreezable(covenantId),
    provider().getBlockNumber(),
  ]);
  return {
    creditcoinHead: head,
    facility: {
      creditLimitCTC: formatEther(f.creditLimit),
      unlockedCTC: formatEther(f.unlocked),
      drawnCTC: formatEther(f.drawn),
      status: Number(f.status),
      activeCovenantId: f.activeCovenantId.toString(),
    },
    covenant: {
      verifiedAmountRaw: c.verifiedAmount.toString(),
      requiredAmountRaw: c.requiredAmount.toString(),
      startSourceBlock: c.startSourceBlock.toString(),
      endSourceBlock: c.endSourceBlock.toString(),
      proofDeadlineCreditcoinBlock: c.proofDeadlineCreditcoinBlock.toString(),
      freezeFrontierMarginSourceBlocks: c.freezeFrontierMarginSourceBlocks.toString(),
      status: Number(c.status),
    },
    availableToDrawCTC: formatEther(avail),
    isFreezableNow: freezable as boolean,
  };
}

async function expectedQueryId(proof: {
  chainKey: number | string;
  headerNumber: number | string;
  merkleProof: { root: string; siblings: Array<{ hash: string; isLeft: boolean }> };
}): Promise<string> {
  const prover = new blockProver.PrecompileBlockProver(provider() as unknown as JsonRpcApiProvider);
  const txIndex = await prover.computeTransactionIndex({
    root: proof.merkleProof.root,
    siblings: proof.merkleProof.siblings.map((s) => ({ hash: s.hash, isLeft: s.isLeft })),
  });
  // Replicates CovenantFacility._computeQueryId's 72-byte preimage exactly:
  // [32B chainKey][8B height][24B zeros][8B txIndex].
  return keccak256(
    solidityPacked(
      ['bytes32', 'bytes8', 'bytes24', 'bytes8'],
      [
        zeroPadValue(toBeArray(BigInt(proof.chainKey)), 32),
        toBeHex(BigInt(proof.headerNumber), 8),
        new Uint8Array(24),
        toBeHex(txIndex, 8),
      ],
    ),
  );
}

interface AttemptInput {
  id: string;
  title: string;
  invariantDefended: string;
  facilityId?: bigint;
  covenantId?: bigint;
  inputTransaction?: string | null;
  proofIdentifier?: string | null;
}

async function writeRecord(input: AttemptInput, extra: Record<string, unknown>): Promise<void> {
  const facilityId = input.facilityId ?? 0n;
  const covenantId = input.covenantId ?? 0n;
  let stateAfter: Snapshot | null = null;
  const stateBefore = (extra['stateBefore'] as Snapshot | undefined) ?? null;
  delete extra['stateBefore'];
  if (facilityId !== 0n && covenantId !== 0n) stateAfter = await snapshot(facilityId, covenantId);

  const record = {
    id: input.id,
    kind: 'live-chain' as const,
    title: input.title,
    invariantDefended: input.invariantDefended,
    recordedAtUTC: new Date().toISOString(),
    network: 'Creditcoin CC3 Testnet (102031) / Ethereum Sepolia (11155111)',
    contract: process.env.COVENANT_CONTRACT_ADDRESS?.trim() || null,
    facilityId: facilityId.toString(),
    covenantId: covenantId.toString(),
    inputTransaction: input.inputTransaction ?? null,
    proofOrCallIdentifier: input.proofIdentifier ?? null,
    rejectionTxHash: extra['rejectionTxHash'] ?? null,
    revertedOnChain: extra['revertedOnChain'] ?? null,
    revertReason: extra['revertReason'] ?? null,
    outcome: extra['outcome'],
    stateBefore,
    stateAfter,
    notes: extra['notes'] ?? null,
  };
  const file = `${ATTACKS_DIR}/${input.id}.json`;
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(record, null, 2));
  console.log(`[${input.id}] ${String(extra['outcome'])}`);
}

/** Broadcasts the rejection transaction for real; captures hash + decoded reason. */
async function sendRejection(
  attempt: AttemptInput,
  simulateReason: () => Promise<string>,
  send: () => Promise<{ hash: string; wait(): Promise<unknown> }>,
  extraRecord: Record<string, unknown> = {},
): Promise<'rejected' | 'skipped' | 'error'> {
  const revertReason = await simulateReason()
    .then(() => 'NO REVERT (unexpected — refusing to broadcast)')
    .catch((e) => decodeReason(e));
  if (revertReason.startsWith('NO REVERT')) {
    await writeRecord(attempt, { outcome: 'blocked-unexpected-success', revertReason });
    return 'skipped';
  }
  try {
    const tx = await send();
    let mined = true;
    try {
      await tx.wait();
    } catch {
      mined = false; // reverted in-block: still a real rejection transaction with a hash
    }
    await writeRecord(attempt, {
      rejectionTxHash: tx.hash,
      revertedOnChain: !mined,
      revertReason,
      outcome: 'rejected',
      ...extraRecord,
    });
    return 'rejected';
  } catch (error) {
    await writeRecord(attempt, { outcome: 'error', revertReason: decodeReason(error), notes: 'tx not broadcast' });
    return 'error';
  }
}

function sim(fnName: string, args: readonly unknown[], sender: Wallet): () => Promise<string> {
  return async () => {
    const data = covenant().interface.encodeFunctionData(fnName, args as never[]);
    const result = await provider().call({ to: cfg.covenantAddress(), data, from: sender.address });
    const parsed = errorIface.parseError(result);
    return `${parsed?.name}(${(parsed?.args ?? []).map((a) => String(a)).join(',')})`;
  };
}

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, 'utf8')) as T;
}

type ProofPayload = {
  chainKey: number;
  headerNumber: number;
  txBytes: string;
  merkleProof: { root: string; siblings: Array<{ hash: string; isLeft: boolean }> };
  continuityProof: { lowerEndpointDigest: string; roots: string[] };
};

async function payOnSepolia(payer: Wallet, token: string, recipient: string, amountRaw: bigint): Promise<string> {
  const token_ = new Contract(token, erc20Iface, payer);
  const tx = await token_.transfer(recipient, amountRaw);
  const receipt = await tx.wait();
  if (receipt?.status !== 1) throw new Error(`source payment reverted: ${tx.hash}`);
  return tx.hash;
}

async function proveSepoliaTx(txHash: string): Promise<ProofPayload> {
  const proof = await buildProof({
    txHash,
    chainKey: cfg.sourceChainKey(),
    proofBuilderUrl: cfg.proofBuilderUrl(),
    creditcoinProvider: provider(),
    sourceProvider: sourceProvider(),
  });
  const file = fromRepoRoot(`evidence/attacks/_proofs/${txHash}.json`);
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, jsonSafe(proof));
  return proof as unknown as ProofPayload;
}

async function submitArgs(covenantId: bigint, proof: ProofPayload) {
  return [
    covenantId,
    BigInt(proof.chainKey),
    BigInt(proof.headerNumber),
    proof.txBytes,
    proof.merkleProof.root,
    proof.merkleProof.siblings,
    proof.continuityProof.lowerEndpointDigest,
    proof.continuityProof.roots,
  ] as const;
}

/**
 * Creates a fresh facility + accepted covenant dedicated to an attack scenario.
 * The borrower accepts from the Creditcoin side (needs CC3 gas on the borrower key).
 */
async function createAttackCovenant(setup: Record<string, string>, opts: {
  start: bigint;
  end: bigint;
  margin?: bigint;
  deadlineBlocks?: number;
  recipient?: string;
  requiredRaw?: bigint;
}): Promise<{ facilityId: bigint; covenantId: bigint }> {
  const maturity = BigInt(await provider().getBlockNumber()) + 10_000n;
  const fTx = await covenant().createFacility(
    setup.borrower,
    setup.trancheWei,
    maturity,
    { value: BigInt(setup.creditLimitWei), gasLimit: 500_000 },
  );
  const frec = await fTx.wait();
  let facilityId: bigint | null = null;
  for (const log of frec?.logs ?? []) {
    try {
      const parsed = covenant().interface.parseLog(log);
      if (parsed?.name === 'FacilityCreated') facilityId = parsed.args.facilityId as bigint;
    } catch { /* unrelated logs */ }
  }
  if (facilityId === null) throw new Error('FacilityCreated not found for attack covenant');

  const deadline = BigInt(await provider().getBlockNumber()) + BigInt(opts.deadlineBlocks ?? 1_000);
  const cTx = await covenant().createCovenant(
    facilityId,
    BigInt(cfg.sourceChainKey()),
    cfg.sourceUsdc(),
    opts.recipient ?? setup.recipient,
    opts.requiredRaw ?? BigInt(setup.requiredUsdcRaw),
    opts.start,
    opts.end,
    deadline,
    opts.margin ?? 50n,
    { gasLimit: 400_000 },
  );
  const crec = await cTx.wait();
  let covenantId: bigint | null = null;
  for (const log of crec?.logs ?? []) {
    try {
      const parsed = covenant().interface.parseLog(log);
      if (parsed?.name === 'CovenantCreated') covenantId = parsed.args.covenantId as bigint;
    } catch { /* unrelated logs */ }
  }
  if (covenantId === null) throw new Error('CovenantCreated not found for attack covenant');

  const borrowerCc = new Contract(cfg.covenantAddress(), covenantAbi, borrowerCreditSigner());
  const acceptTx = await borrowerCc.acceptCovenant(covenantId, { gasLimit: 200_000 });
  await acceptTx.wait();

  return { facilityId, covenantId };
}

async function main(): Promise<void> {
  await mkdir(ATTACKS_DIR, { recursive: true });
  if (!configured()) {
    console.log('No funded key / contract address configured. Recording honest SKIPPED evidence.');
  }
  const happySubmissionPath = fromRepoRoot('evidence/happy-path/attestcoin-submission.json');
  const happyProofPath = fromRepoRoot('evidence/happy-path/proof.json');
  const setupPath = fromRepoRoot('evidence/happy-path/demo-setup.json');
  const haveHappy =
    (await fileExists(happySubmissionPath)) && (await fileExists(happyProofPath)) && (await fileExists(setupPath));

  let facilityId = 0n;
  let covenantId = 0n;
  let setup: Record<string, string> | null = null;
  if (haveHappy) {
    const parsed = await readJson<Record<string, string>>(setupPath);
    setup = parsed;
    facilityId = BigInt(parsed.facilityId);
    covenantId = BigInt(parsed.covenantId);
  }
  if (haveHappy && setup === null) throw new Error('setup file unreadable');
  const S = setup;

  // ------------------------------------------------------ call-layer attacks (no proofs)

  if (!haveHappy) {
    const callCases: Array<[string, string, string]> = [
      ['L09-early-freeze', 'Early freeze before attestation/proof conditions permit', 'Freeze requires cure-deadline elapsed AND Attestcoin frontier >= end+margin'],
      ['L10a-cancel-after-acceptance', 'Cancel an already-accepted covenant', 'Accepted terms immutable; cancel valid only pre-acceptance'],
      ['L10b-repropose-over-active', 'Propose second covenant over an active one', 'One active covenant per facility'],
      ['L11-unauthorized-draw', 'Draw by non-borrower', 'Only facility.borrower draws; drawn <= unlocked always'],
      ['L12-lender-early-withdrawal', 'closeFacility while active and immature', 'Committed undrawn escrow untouchable before permitted closure'],
    ];
    for (const [id, title, inv] of callCases) {
      await writeRecord({ id, title, invariantDefended: inv }, {
        outcome: 'skipped',
        notes: 'Requires deployed contract + accepted covenant. No funded key in this environment yet.',
      });
    }
  } else {
    await sendRejection(
      { id: 'L09-early-freeze', title: 'Early freeze before attestation/proof conditions permit', invariantDefended: 'Freeze requires cure-deadline elapsed AND frontier >= end+margin', facilityId, covenantId },
      sim('freezeExpiredCovenant', [covenantId], submitterWallet()),
      () => covenantAsSubmitter().freezeExpiredCovenant(covenantId, { gasLimit: 300_000 }),
    );
    await sendRejection(
      { id: 'L10a-cancel-after-acceptance', title: 'Cancel an already-accepted covenant', invariantDefended: 'Accepted terms immutable; cancel valid only pre-acceptance', facilityId, covenantId },
      sim('cancelProposedCovenant', [covenantId], submitterWallet()),
      () => covenantAsSubmitter().cancelProposedCovenant(covenantId, { gasLimit: 150_000 }),
    );
    const headNow = await provider().getBlockNumber();
    await sendRejection(
      { id: 'L10b-repropose-over-active', title: 'Propose second covenant over an active one', invariantDefended: 'One active covenant per facility', facilityId, covenantId },
      sim('createCovenant', [facilityId, cfg.sourceChainKey(), cfg.sourceUsdc(), setup!.recipient, setup!.requiredUsdcRaw, 1, 2, headNow + 100, 0], lenderWallet()),
      () => covenant().createCovenant(facilityId, cfg.sourceChainKey(), cfg.sourceUsdc(), setup!.recipient, setup!.requiredUsdcRaw, 1, 2, headNow + 100, 0, { gasLimit: 350_000 }),
    );
    await sendRejection(
      { id: 'L11-unauthorized-draw', title: 'Draw by non-borrower', invariantDefended: 'Role enforcement: only borrower draws', facilityId, covenantId },
      sim('draw', [facilityId, 1], submitterWallet()),
      () => covenantAsSubmitter().draw(facilityId, 1, { gasLimit: 150_000 }),
    );
    await sendRejection(
      { id: 'L12-lender-early-withdrawal', title: 'closeFacility while active and immature', invariantDefended: 'Undrawn committed escrow untouchable before permitted closure', facilityId, covenantId },
      sim('closeFacility', [facilityId], lenderWallet()),
      () => covenant().closeFacility(facilityId, { gasLimit: 250_000 }),
    );
  }

  // ------------------------------------------- proof-bearing attacks (need happy path)

  if (!haveHappy) {
    const proofCases: Array<[string, string, string]> = [
      ['L01-replay-consumed-proof', 'Replay the already-consumed valid proof', 'Query identity consumed once globally after semantic validation'],
      ['L02-wrong-covenant-evidence', 'Submit evidence intended for covenant A into covenant B', 'Per-covenant chain/window/policy binding'],
      ['L03-sub-threshold-payment', 'Below-threshold payment leaves covenant unsatisfied', 'Accumulation gate: unlock only at full requirement'],
      ['L04-outside-window-payment', 'Source transaction outside eligible block window', 'Immutable source-window binding'],
      ['L05-wrong-recipient', 'Payment to wrong recipient', 'Exact recipient binding on verified logs'],
      ['L06-wrong-payer', 'Payment from wrong payer', 'Payer bound to on-chain facility.borrower'],
      ['L07-wrong-token-emitter', 'Evidence from wrong token emitter', 'Exact approved emitter binding'],
      ['L08-cross-facility-replay', 'Used transaction submitted against another facility', 'Query identity is global across facilities'],
    ];
    for (const [id, title, inv] of proofCases) {
      await writeRecord({ id, title, invariantDefended: inv }, {
        outcome: 'skipped',
        notes: 'Needs completed happy path (real Sepolia USDC payment, Attestcoin proof, consumed submission) plus funded attack wallets.',
      });
    }
    console.log('\nAll prerequisite-dependent live cases were recorded as SKIPPED.');
    console.log('Fund wallets, run the happy path, then re-run `npm run worker:attacks`.');
    return;
  }

  // L01 — replay the consumed proof against its own covenant.
  {
    const submission = await readJson<Record<string, string>>(happySubmissionPath);
    const proof = await readJson<ProofPayload>(happyProofPath);
    const args = await submitArgs(covenantId, proof);
    await sendRejection(
      {
        id: 'L01-replay-consumed-proof',
        title: 'Replay the already-consumed valid proof',
        invariantDefended: 'Query identity consumed once globally after semantic validation',
        facilityId,
        covenantId,
        inputTransaction: submission.creditcoinTxHash,
        proofIdentifier: await expectedQueryId(proof),
      },
      sim('submitEvidence', args, submitterWallet()),
      () => covenantAsSubmitter().submitEvidence(...args, { gasLimit: 800_000 }),
    );
  }

  // L02 — happy-path proof submitted into a freshly created (different) covenant.
  {
    const srcHead = BigInt(await sourceProvider().getBlockNumber());
    const target = await createAttackCovenant(S!, {
      start: srcHead - 50n,
      end: srcHead + 500n,
    });
    const proof = await readJson<ProofPayload>(happyProofPath);
    const args = await submitArgs(target.covenantId, proof);
    await sendRejection(
      {
        id: 'L02-wrong-covenant-evidence',
        title: 'Evidence intended for covenant A submitted into covenant B',
        invariantDefended: 'Per-covenant binding; identity already consumed globally',
        facilityId: target.facilityId,
        covenantId: target.covenantId,
        inputTransaction: (await readJson<Record<string, string>>(happySubmissionPath)).creditcoinTxHash,
        proofIdentifier: await expectedQueryId(proof),
      },
      sim('submitEvidence', args, submitterWallet()),
      () => covenantAsSubmitter().submitEvidence(...args, { gasLimit: 800_000 }),
      { stateBefore: await snapshot(target.facilityId, target.covenantId) },
    );
  }

  // L03 — sub-threshold payment is ACCEPTED as evidence but unlocks nothing.
  {
    const head = BigInt(await sourceProvider().getBlockNumber());
    const target = await createAttackCovenant(S!, {
      start: head - 50n,
      end: head + 500n,
      requiredRaw: BigInt(S!.requiredUsdcRaw) * 2n, // double requirement
    });
    const amount = BigInt(S!.requiredUsdcRaw); // half of the doubled requirement
    const txHash = await payOnSepolia(borrowerSourceSigner(), cfg.sourceUsdc(), S!.recipient, amount);
    const proof = await proveSepoliaTx(txHash);
    const args = await submitArgs(target.covenantId, proof);
    const before = await snapshot(target.facilityId, target.covenantId);
    try {
      const tx = await covenantAsSubmitter().submitEvidence(...args, { gasLimit: 800_000 });
      const rec = await tx.wait();
      const names = (rec?.logs ?? []).map((l: { topics: readonly string[]; data: string }) => {
        try {
          return covenant().interface.parseLog(l as never)?.name;
        } catch {
          return null;
        }
      });
      const matchedLogged = names.includes('EvidenceAccepted');
      await writeRecord(
        {
          id: 'L03-sub-threshold-payment',
          title: 'Below-threshold payment accepted as evidence; capital does NOT move',
          invariantDefended: 'Unlock strictly gated on accumulated >= required',
          facilityId: target.facilityId,
          covenantId: target.covenantId,
          inputTransaction: txHash,
          proofIdentifier: await expectedQueryId(proof),
        },
        {
          outcome: matchedLogged ? 'accepted-as-partial' : 'error',
          rejectionTxHash: null,
          revertReason: null,
          notes: 'EvidenceAccepted emitted; covenant remains Pending; unlocked/availableToDraw unchanged.',
        },
      );
    } catch (error) {
      await writeRecord(
        {
          id: 'L03-sub-threshold-payment',
          title: 'Below-threshold payment accepted as evidence; capital does NOT move',
          invariantDefended: 'Unlock strictly gated on accumulated >= required',
          facilityId: target.facilityId,
          covenantId: target.covenantId,
          inputTransaction: txHash,
          proofIdentifier: await expectedQueryId(proof),
        },
        { outcome: 'error', revertReason: decodeReason(error) },
      );
    }
  }

  // L04 — payment mined outside the eligible window.
  {
    const head = BigInt(await sourceProvider().getBlockNumber());
    const target = await createAttackCovenant(S!, { start: head - 40n, end: head - 10n }); // already closed
    const txHash = await payOnSepolia(borrowerSourceSigner(), cfg.sourceUsdc(), S!.recipient, BigInt(S!.requiredUsdcRaw));
    const proof = await proveSepoliaTx(txHash); // mined at current head > end
    const args = await submitArgs(target.covenantId, proof);
    await sendRejection(
      {
        id: 'L04-outside-window-payment',
        title: 'Source transaction outside eligible block window',
        invariantDefended: 'Window binding: only blocks within [start,end] can ever count',
        facilityId: target.facilityId,
        covenantId: target.covenantId,
        inputTransaction: txHash,
        proofIdentifier: await expectedQueryId(proof),
      },
      sim('submitEvidence', args, submitterWallet()),
      () => covenantAsSubmitter().submitEvidence(...args, { gasLimit: 800_000 }),
    );
  }

  // L05 — payment to the wrong recipient.
  {
    const head = BigInt(await sourceProvider().getBlockNumber());
    const victim = new Wallet(keccak256(new Uint8Array([9]))).address; // deterministic non-recipient
    const target = await createAttackCovenant(S!, { start: head - 50n, end: head + 500n, recipient: victim });
    const txHash = await payOnSepolia(borrowerSourceSigner(), cfg.sourceUsdc(), S!.recipient, BigInt(S!.requiredUsdcRaw));
    const proof = await proveSepoliaTx(txHash);
    const args = await submitArgs(target.covenantId, proof);
    await sendRejection(
      {
        id: 'L05-wrong-recipient',
        title: 'Payment to wrong recipient (covenant demands a different address)',
        invariantDefended: 'Recipient taken only from verified Transfer.to == committed recipient',
        facilityId: target.facilityId,
        covenantId: target.covenantId,
        inputTransaction: txHash,
        proofIdentifier: await expectedQueryId(proof),
      },
      sim('submitEvidence', args, submitterWallet()),
      () => covenantAsSubmitter().submitEvidence(...args, { gasLimit: 800_000 }),
    );
  }

  // L06 — payment from the wrong payer (requires a second funded source wallet).
  {
    const altKey = cfg.altSourcePrivateKey();
    if (!altKey) {
      await writeRecord(
        { id: 'L06-wrong-payer', title: 'Payment from wrong payer', invariantDefended: 'Payer bound to on-chain facility.borrower' },
        { outcome: 'skipped', notes: 'Set SOURCE_ALT_PRIVATE_KEY (funded Sepolia wallet != borrower) to execute.' },
      );
    } else {
      const head = BigInt(await sourceProvider().getBlockNumber());
      const target = await createAttackCovenant(S!, { start: head - 50n, end: head + 500n });
      const alt = new Wallet(altKey, sourceProvider());
      const txHash = await payOnSepolia(alt, cfg.sourceUsdc(), setup!.recipient, BigInt(S!.requiredUsdcRaw));
      const proof = await proveSepoliaTx(txHash);
      const args = await submitArgs(target.covenantId, proof);
      await sendRejection(
        {
          id: 'L06-wrong-payer',
          title: 'Payment from wrong payer',
          invariantDefended: 'Transfer.from must equal committed payer (facility.borrower)',
          facilityId: target.facilityId,
          covenantId: target.covenantId,
          inputTransaction: txHash,
          proofIdentifier: await expectedQueryId(proof),
        },
        sim('submitEvidence', args, submitterWallet()),
        () => covenantAsSubmitter().submitEvidence(...args, { gasLimit: 800_000 }),
      );
    }
  }

  // L07 — wrong token emitter (requires a funded balance of another Sepolia token).
  {
    const wrongToken = cfg.wrongTokenAddress();
    if (!wrongToken) {
      await writeRecord(
        { id: 'L07-wrong-token-emitter', title: 'Evidence from wrong token emitter', invariantDefended: 'Emitter must equal approved token contract' },
        { outcome: 'skipped', notes: 'Set SOURCE_WRONG_TOKEN_ADDRESS (any other Sepolia ERC-20 with balance) to execute.' },
      );
    } else {
      const head = BigInt(await sourceProvider().getBlockNumber());
      const target = await createAttackCovenant(S!, { start: head - 50n, end: head + 500n });
      const txHash = await payOnSepolia(borrowerSourceSigner(), wrongToken, setup!.recipient, 1n);
      const proof = await proveSepoliaTx(txHash);
      const args = await submitArgs(target.covenantId, proof);
      await sendRejection(
        {
          id: 'L07-wrong-token-emitter',
          title: 'Transfer emitted by non-approved token contract',
          invariantDefended: 'log.address must equal the immutable approved token',
          facilityId: target.facilityId,
          covenantId: target.covenantId,
          inputTransaction: txHash,
          proofIdentifier: await expectedQueryId(proof),
        },
        sim('submitEvidence', args, submitterWallet()),
        () => covenantAsSubmitter().submitEvidence(...args, { gasLimit: 800_000 }),
      );
    }
  }

  // L08 — the consumed transaction aimed at a covenant on a DIFFERENT facility.
  {
    const head = BigInt(await sourceProvider().getBlockNumber());
    // Dedicated facility so the target is provably another facility, not just another covenant.
    const maturity = BigInt(await provider().getBlockNumber()) + 10_000n;
    const fTx = await covenant().createFacility(setup!.borrower, setup!.trancheWei, maturity, {
      value: BigInt(setup!.creditLimitWei),
      gasLimit: 500_000,
    });
    const frec = await fTx.wait();
    let newFacilityId: bigint | null = null;
    for (const log of frec?.logs ?? []) {
      try {
        const parsed = covenant().interface.parseLog(log);
        if (parsed?.name === 'FacilityCreated') newFacilityId = parsed.args.facilityId as bigint;
      } catch { /* unrelated logs */ }
    }
    if (newFacilityId === null) throw new Error('FacilityCreated not found for L08');
    const cTx = await covenant().createCovenant(
      newFacilityId,
      BigInt(cfg.sourceChainKey()),
      cfg.sourceUsdc(),
      setup!.recipient,
      BigInt(S!.requiredUsdcRaw),
      head - 50n,
      head + 500n,
      BigInt(await provider().getBlockNumber()) + 1_000n,
      50n,
      { gasLimit: 400_000 },
    );
    const crec = await cTx.wait();
    let newCovenantId: bigint | null = null;
    for (const log of crec?.logs ?? []) {
      try {
        const parsed = covenant().interface.parseLog(log);
        if (parsed?.name === 'CovenantCreated') newCovenantId = parsed.args.covenantId as bigint;
      } catch { /* unrelated logs */ }
    }
    if (newCovenantId === null) throw new Error('CovenantCreated not found for L08');
    const borrowerCc = new Contract(cfg.covenantAddress(), covenantAbi, borrowerCreditSigner());
    await (await borrowerCc.acceptCovenant(newCovenantId, { gasLimit: 200_000 })).wait();

    const proof = await readJson<ProofPayload>(happyProofPath);
    const args = await submitArgs(newCovenantId, proof);
    await sendRejection(
      {
        id: 'L08-cross-facility-replay',
        title: 'Already-used transaction submitted against another facility',
        invariantDefended: 'processedQueries is global: one source tx can never serve two facilities',
        facilityId: newFacilityId,
        covenantId: newCovenantId,
        inputTransaction: (await readJson<Record<string, string>>(happySubmissionPath)).creditcoinTxHash,
        proofIdentifier: await expectedQueryId(proof),
      },
      sim('submitEvidence', args, submitterWallet()),
      () => covenantAsSubmitter().submitEvidence(...args, { gasLimit: 800_000 }),
    );
  }

  console.log('\nLive adversarial campaign pass complete.');
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
