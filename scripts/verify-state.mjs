#!/usr/bin/env node
/**
 * Wallet-free verification of COVENANT's recorded happy-path evidence against the live chain.
 *
 * Reads evidence/deployments.json (+ .env overrides) and, when a deployment exists:
 *   1. re-reads facility/covenant state via read-only eth_call;
 *   2. recomputes the consumed query identity from the recorded proof artifact and checks
 *      processedQueries(queryId) == true on-chain;
 *   3. cross-checks recorded post-state claims (EvidenceAccepted/CovenantSatisfied present,
 *      unlocked increased) against what the chain reports now.
 * When nothing is deployed yet it says exactly that and verifies what IS verifiable
 * (evidence file integrity + live Attestcoin environment reachability).
 *
 * This script never signs or broadcasts anything.
 */
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { JsonRpcProvider, Contract, keccak256, solidityPacked, zeroPadValue, toBeArray } from 'ethers';

const REPO = new URL('..', import.meta.url).pathname;

// Minimal .env loader (no dependency on worker/config so this stays wallet-free).
async function loadEnvFile() {
  try {
    const raw = await readFile(`${REPO}.env`, 'utf8');
    for (const line of raw.split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && process.env[m[1]] === undefined && !line.trim().startsWith('#')) {
        process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
      }
    }
  } catch {
    /* no .env — fine */
  }
}

const ok = (name, detail) => console.log(`  [PASS] ${name}${detail ? ` — ${detail}` : ''}`);
const fail = (name, detail) => console.log(`  [FAIL] ${name}${detail ? ` — ${detail}` : ''}`);
const info = (name, detail) => console.log(`  [INFO] ${name}${detail ? ` — ${detail}` : ''}`);

async function main() {
  await loadEnvFile();
  console.log('\nCOVENANT judge replay — read-only verification\n==============================================\n');

  let failures = 0;

  // ---------------------------------------------------------------- evidence integrity
  console.log('[1/3] Evidence artifact integrity');
  const requiredFiles = [
    ['deployments.json', 'deployment record'],
    ['network-probe.json', 'live environment probe'],
    ['attacks/local/index.json', 'local adversarial index'],
  ];
  for (const [rel, why] of requiredFiles) {
    const p = `${REPO}evidence/${rel}`;
    if (!existsSync(p)) {
      fail(rel, `missing (${why})`);
      failures += 1;
      continue;
    }
    try {
      JSON.parse(await readFile(p, 'utf8'));
      ok(rel);
    } catch (e) {
      fail(rel, `invalid JSON: ${e.message}`);
      failures += 1;
    }
  }

  const happyDir = `${REPO}evidence/happy-path`;
  const hasHappy =
    existsSync(`${happyDir}/demo-setup.json`) &&
    existsSync(`${happyDir}/source-payment.json`) &&
    existsSync(`${happyDir}/proof.json`) &&
    existsSync(`${happyPathSubmission()}`);
  if (hasHappy) ok('happy-path/*.json', 'full causal-loop artifacts present');
  else info('happy-path artifacts', 'not captured yet — deployment pending');

  // ------------------------------------------------------------- environment liveness
  console.log('\n[2/3] Live Attestcoin environment');
  const probe = JSON.parse(await readFile(`${REPO}evidence/network-probe.json`, 'utf8'));
  const rpc = process.env.CREDITCOIN_RPC_URL || probe.creditcoin.rpc;
  try {
    const provider = new JsonRpcProvider(rpc);
    const net = await provider.getNetwork();
    if (Number(net.chainId) !== probe.creditcoin.chainId) {
      fail('CC3 RPC chainId', `expected ${probe.creditcoin.chainId}, got ${net.chainId}`);
      failures += 1;
    } else {
      ok('CC3 RPC reachable', `chainId ${net.chainId}`);
    }

    // ChainInfo frontier via the exact selector proven compatible (0x809112da).
    const sepoliaKey = BigInt(probe.supportedSourceChains.find((c) => c.chainId === 11155111)?.key ?? 1);
    const data = `0x809112da${sepoliaKey.toString(16).padStart(64, '0')}`;
    const result = await provider.send('eth_call', [
      { to: probe.creditcoin.chainInfoPrecompile, data },
      'latest',
    ]);
    const bytes = result.slice(2);
    const height = Number(BigInt(`0x${bytes.slice(0, 64)}`));
    const exists = BigInt(`0x${bytes.slice(192, 256)}`) !== 0n;
    if (exists && height >= 11_000_000) {
      ok('Attestcoin frontier advancing', `Sepolia(key=${sepoliaKey}) attested height ${height}`);
    } else {
      fail('Attestcoin frontier', `unexpected response (exists=${exists}, height=${height})`);
      failures += 1;
    }
  } catch (e) {
    fail('environment', e.message);
    failures += 1;
  }

  // ------------------------------------------------------- on-chain state verification
  console.log('\n[3/3] Deployed contract state');
  const address =
    process.env.COVENANT_CONTRACT_ADDRESS ||
    JSON.parse(await readFile(`${REPO}evidence/deployments.json`, 'utf8'))?.creditcoin?.covenantFacility;

  if (!address || address === 'null') {
    info('no deployment yet', 'COVENANT_CONTRACT_ADDRESS is unset and deployments.json records status "not-deployed-yet".');
    console.log(
      '\nNothing on-chain to verify is an HONEST result for this repository right now.\n' +
        'After funding keys and running ./scripts/deploy-contracts.sh + ./scripts/run-happy-path.sh,\n' +
        'this same command verifies the winning proof end-to-end without a wallet.\n',
    );
  } else {
    const provider = new JsonRpcProvider(rpc);
    const abi = [
      'function facilities(uint256) view returns (address lender,address borrower,uint256 creditLimit,uint256 trancheSize,uint256 unlocked,uint256 drawn,uint256 activeCovenantId,uint64 maturityCreditcoinBlock,uint8 status)',
      'function covenants(uint256) view returns (uint256 facilityId,uint64 chainKey,address token,address payer,address recipient,uint256 requiredAmount,uint256 verifiedAmount,uint64 startSourceBlock,uint64 endSourceBlock,uint64 proofDeadlineCreditcoinBlock,uint64 freezeFrontierMarginSourceBlocks,uint8 status)',
      'function processedQueries(bytes32) view returns (bool)',
      'function availableToDraw(uint256) view returns (uint256)',
    ];
    const contract = new Contract(address, abi, provider);
    const setup = hasHappy ? JSON.parse(await readFile(`${happyDir}/demo-setup.json`, 'utf8')) : null;
    const facilityId = BigInt(process.env.NEXT_PUBLIC_FACILITY_ID || setup?.facilityId || '1');
    const covenantId = BigInt(process.env.NEXT_PUBLIC_COVENANT_ID || setup?.covenantId || '1');

    const [f, c] = await Promise.all([contract.facilities(facilityId), contract.covenants(covenantId)]);

    // Covenant status enum: 3 == Satisfied
    if (Number(c.status) === 3) ok('covenant status', 'Satisfied (3)');
    else {
      fail('covenant status', `expected Satisfied(3), got ${c.status}`);
      failures += 1;
    }

    // Consumed query identity recomputed from the recorded proof artifact.
    const proof = JSON.parse(await readFile(`${happyPathProof()}`, 'utf8'));
    const prover = new Contract(
      '0x0000000000000000000000000000000000000fD2',
      ['function calculateTxIndex((bytes32,(bytes32,bool)[])) view returns (uint64)'],
      provider,
    );
    const txIndex = await prover.calculateTxIndex({
      root: proof.merkleProof.root,
      siblings: proof.merkleProof.siblings,
    });
    const queryId = keccak256(
      solidityPacked(
        ['bytes32', 'bytes8', 'bytes24', 'bytes8'],
        [
          zeroPadValue(toBeArray(BigInt(proof.chainKey)), 32),
          zeroPadValue(toBeArray(BigInt(proof.headerNumber)), 32).slice(0, 8),
          new Uint8Array(24),
          zeroPadValue(toBeArray(txIndex), 32).slice(24),
        ],
      ),
    );
    const consumed = await contract.processedQueries(queryId);
    if (consumed) ok('processedQueries(queryId)', `identity ${queryId} marked consumed`);
    else {
      fail('processedQueries(queryId)', `${queryId} not consumed`);
      failures += 1;
    }

    // Unlocked strictly greater than a single tranche implies satisfaction had economic effect.
    const tranche = f.trancheSize;
    const unlocked = f.unlocked;
    if (unlocked >= tranche * 2n) ok('unlocked expanded', `${unlocked} wei >= 2 tranches — proof moved capital`);
    else {
      fail('unlocked expansion', `unlocked=${unlocked}, tranche=${tranche}`);
      failures += 1;
    }

    const submission = JSON.parse(await readFile(happyPathSubmission(), 'utf8'));
    info('recorded settlement tx', submission.creditcoinTxHash ?? 'n/a');
    info('explorer', `${process.env.NEXT_PUBLIC_CREDITCOIN_EXPLORER || probe.creditcoin.explorer || 'https://creditcoin-testnet.blockscout.com'}/tx/${submission.creditcoinTxHash ?? ''}`);
  }

  console.log('\n----------------------------------------------');
  if (failures === 0) console.log('RESULT: all verifiable checks passed.');
  else console.log(`RESULT: ${failures} check(s) FAILED — investigate before trusting the record.`);
  process.exitCode = failures === 0 ? 0 : 1;

  function happyPathSubmission() {
    return `${happyDir}/attestcoin-submission.json`;
  }
  function happyPathProof() {
    return `${happyDir}/proof.json`;
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
