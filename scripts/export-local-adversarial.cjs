#!/usr/bin/env node
/**
 * Exports machine-readable records for COVENANT's DETERMINISTIC LOCAL adversarial tests
 * (Foundry). These complement live-chain attack evidence: they run against an etched
 * 0x…0FD2/0x…0FD3 double and real fixture bytes inside a local EVM — NOT live-chain activity.
 *
 * Every record embeds the observed result of an actual `forge test` invocation, so this file
 * can never claim a test passed that did not.
 */
const { execSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const REPO = path.join(__dirname, '..');
const OUT = path.join(REPO, 'evidence', 'attacks', 'local');
fs.mkdirSync(OUT, { recursive: true });

// Curated metadata for each deterministic local attack scenario.
const MANIFEST = [
  // --- proof-layer attacks that cannot be safely manufactured live ---
  { id: 'P01-invalid-merkle-proof', file: 'CovenantFacilityEvidence.t.sol', test: 'test_InvalidMerkleProofRevertsAndDoesNotConsumeQuery', expected: 'InvalidMerkleProof', invariant: 'Failed verification consumes nothing; cannot censor later valid proof', layer: 'proof-verification' },
  { id: 'P02-verifier-rejects', file: 'CovenantFacilityEvidence.t.sol', test: 'test_VerifierRejectionReverts', expected: 'ProofVerificationFailed', invariant: 'verified==false path reverts without state change', layer: 'proof-verification' },
  { id: 'P03-corrupted-tx-bytes', file: 'CovenantFacilityEvidence.t.sol', test: 'test_CorruptedTransactionDataFailsVerification', expected: 'InvalidMerkleProof', invariant: 'Identity binds exact receipt bytes: one flipped bit breaks inclusion', layer: 'proof-verification' },
  { id: 'P04-unsupported-decoder-type', file: 'CovenantFacilityEvidence.t.sol', test: 'test_UnsupportedDecoderTypeRevertsBeforeDecoding', expected: 'InvalidTerms', invariant: 'Decoder accepts only tx types 0..4, checked before decode', layer: 'decoding' },
  { id: 'P05-wrong-source-chain', file: 'CovenantFacilityEvidence.t.sol', test: 'test_WrongSourceChainReverts', expected: 'WrongSourceChain', invariant: 'chainKey bound to accepted covenant policy', layer: 'policy' },
  { id: 'P06-wrong-emitter', file: 'CovenantFacilityEvidence.t.sol', test: 'test_WrongEmitterReverts', expected: 'NoMatchingPayment', invariant: 'Emitter must equal approved token contract', layer: 'policy' },
  { id: 'P07-wrong-event-signature', file: 'CovenantFacilityEvidence.t.sol', test: 'test_WrongEventSignatureReverts', expected: 'NoMatchingPayment', invariant: 'Only Transfer(address,address,uint256) logs count', layer: 'policy' },
  { id: 'P08-malformed-log', file: 'CovenantFacilityEvidence.t.sol', test: 'test_MalformedLogReverts', expected: 'NoMatchingPayment', invariant: 'Malformed logs skipped, not trusted', layer: 'decoding' },
  { id: 'P09-reverted-source-tx', file: 'CovenantFacilityEvidence.t.sol', test: 'test_RevertedSourceTransactionReverts', expected: 'SourceTransactionFailed', invariant: 'Inclusion alone is insufficient: receiptStatus must be 1', layer: 'policy' },
  { id: 'P10-wrong-payer', file: 'CovenantFacilityEvidence.t.sol', test: 'test_WrongPayerReverts', expected: 'NoMatchingPayment', invariant: 'from == facility.borrower enforced on verified bytes', layer: 'policy' },
  { id: 'P11-wrong-recipient', file: 'CovenantFacilityEvidence.t.sol', test: 'test_WrongRecipientReverts', expected: 'NoMatchingPayment', invariant: 'to == committed recipient enforced on verified bytes', layer: 'policy' },
  { id: 'P12-window-boundary-fuzz', file: 'CovenantFacilityEvidence.t.sol', test: 'test_SourceBlockOutsideWindowReverts', expected: 'SourceBlockOutsideWindow', invariant: 'Only [start,end] blocks are eligible', layer: 'policy' },
  { id: 'P13-sub-threshold-no-unlock', file: 'CovenantFacilityAdversarial.t.sol', test: 'test_SubThresholdPaymentNeverUnlocksCapital', expected: '(state assertion)', invariant: '$X < $requirement never moves capital', layer: 'economic' },
  { id: 'P14-multi-tx-accumulation', file: 'CovenantFacilityAdversarial.t.sol', test: 'test_MultiTransactionAccumulationThenImmediateDraw', expected: '(state assertion)', invariant: 'Multiple txs accumulate to satisfaction', layer: 'economic' },
  { id: 'P15-cross-covenant-replay', file: 'CovenantFacilityAdversarial.t.sol', test: 'test_SourceTransactionCannotServeTwoCovenantsOrTwoFacilities', expected: 'QueryAlreadyProcessed', invariant: 'One source tx identity serves at most one covenant/facility', layer: 'replay' },
  { id: 'P16-stale-period-evidence', file: 'CovenantFacilityAdversarial.t.sol', test: 'test_StalePeriodEvidenceCannotSatisfyCurrentPeriod', expected: 'SourceBlockOutsideWindow', invariant: "Prior period's evidence cannot satisfy current period", layer: 'policy' },
  { id: 'P17-replay-while-pending', file: 'CovenantFacilityAdversarial.t.sol', test: 'test_ReplayRejectedWhilePending', expected: 'QueryAlreadyProcessed', invariant: 'Replay protection active while covenant pending', layer: 'replay' },
  { id: 'P18-resubmission-after-satisfaction', file: 'CovenantFacilityAdversarial.t.sol', test: 'test_ResubmissionAfterSatisfactionRejected', expected: 'CovenantNotPending', invariant: 'No evidence mutation after terminal state', layer: 'replay' },

  // --- expiry / frontier semantics ---
  { id: 'E01-frontier-behind-never-freezes', file: 'CovenantExpiryLifecycle.t.sol', test: 'test_WindowClosedButFrontierBehind_NeverFreezes', expected: 'FrontierNotAdvanced(required, latest)', invariant: 'Borrower never punished while Attestcoin lags', layer: 'expiry' },
  { id: 'E02-no-attestation-data', file: 'CovenantExpiryLifecycle.t.sol', test: 'test_NoAttestationData_NeverFreezes', expected: 'NoAttestationData', invariant: 'No observable frontier -> no freeze', layer: 'expiry' },
  { id: 'E03-last-eligible-block-counts', file: 'CovenantExpiryLifecycle.t.sol', test: 'test_ValidTransactionAtLastEligibleBlockCounts', expected: '(accepted)', invariant: 'Window boundaries inclusive at endSourceBlock', layer: 'expiry' },
  { id: 'E04-late-proof-within-cure', file: 'CovenantExpiryLifecycle.t.sol', test: 'test_ProofArrivesLateWithinCureWindow_Satisfies', expected: '(accepted)', invariant: 'Cure window protects late-but-valid proofs; freeze stays illegal', layer: 'expiry' },
  { id: 'E05-early-freeze-prosecution', file: 'CovenantExpiryLifecycle.t.sol', test: 'test_LenderCannotFreezeEarly', expected: 'ProofDeadlineNotReached', invariant: 'Freeze impossible before deadline even with frontier advanced', layer: 'expiry' },
  { id: 'E06-deterministic-freezable', file: 'CovenantExpiryLifecycle.t.sol', test: 'test_FrontierAdvancesWithoutProof_BecomesDeterministicallyFreezable', expected: '(freeze succeeds)', invariant: 'FREEZABLE is deterministic once both gates pass; permissionless', layer: 'expiry' },
  { id: 'E07-margin-immutable', file: 'CovenantExpiryLifecycle.t.sol', test: 'test_MarginCommittedAndImmutable', expected: '(state assertion)', invariant: 'Frontier margin committed at acceptance', layer: 'expiry' },

  // --- capital / role attacks ---
  { id: 'C01-draw-beyond-commitment', file: 'CovenantFacilityAdversarial.t.sol', test: 'test_BorrowerCannotDrawBeyondCommittedFacility', expected: 'DrawExceedsUnlocked', invariant: 'drawn <= unlocked <= creditLimit', layer: 'capital' },
  { id: 'C02-tranche-not-double-drawable', file: 'CovenantFacilityAdversarial.t.sol', test: 'test_InitialTrancheCapitalNotDoubleDrawable', expected: 'DrawExceedsUnlocked', invariant: 'Tranche capital consumable exactly once in aggregate', layer: 'capital' },
  { id: 'C03-unrelated-facility-isolation', file: 'CovenantFacilityAdversarial.t.sol', test: 'test_FutureTrancheLockedUntilItsOwnCovenantSatisfies', expected: '(state assertion)', invariant: 'Other facilities cannot unlock each other', layer: 'capital' },
  { id: 'C04-lender-early-withdrawal', file: 'CovenantFacilityAdversarial.t.sol', test: 'test_LenderCannotWithdrawUndrawnCommittedCapitalEarly', expected: 'FacilityNotClosable|ActiveCovenantExists', invariant: 'Committed escrow locked until permitted closure', layer: 'capital' },
  { id: 'C05-closure-fund-reconciliation', file: 'CovenantFacilityAdversarial.t.sol', test: 'test_ClosureReconcilesFundsExactlyOnPermittedPaths', expected: '(balance assertions)', invariant: 'Refund == creditLimit - drawn; contract retains nothing after closes', layer: 'capital' },
  { id: 'C06-freeze-preserves-history', file: 'CovenantFacilityAdversarial.t.sol', test: 'test_FreezeBlocksFutureDrawsButPreservesHistory', expected: 'FacilityNotActive on draw', invariant: 'Freeze changes no historical field', layer: 'capital' },
  { id: 'C07-access-control-matrix', file: 'CovenantFacilityAdversarial.t.sol', test: 'test_AccessControlMatrix', expected: 'NotBorrower|NotLender|NotFacilityParty|ProofDeadlineNotReached', invariant: 'Exact role enforcement per function', layer: 'access-control' },
  { id: 'C08-nonsense-configurations', file: 'CovenantFacilityAdversarial.t.sol', test: 'test_NonsensicalConfigurationsRejected', expected: 'InvalidTerms', invariant: 'Zero addresses/values/chains and inverted windows rejected', layer: 'configuration' },
  { id: 'C09-terms-immutability-attackers', file: 'CovenantFacilityAdversarial.t.sol', test: 'test_AcceptedTermsImmutableAcrossAllTransitionsAndAttackers', expected: '(field equality)', invariant: 'No entry point mutates accepted policy fields', layer: 'immutability' },
  { id: 'C10-fuzz-draw-allowance', file: 'CovenantFacilityAdversarial.t.sol', test: 'testFuzz_DrawOnlyWithinAvailableAllowance', expected: 'property holds over 256 runs', invariant: 'Random draws only succeed within allowance by borrower', layer: 'fuzz' },
  { id: 'C11-fuzz-deadline-within-maturity', file: 'CovenantFacilityAdversarial.t.sol', test: 'testFuzz_DeadlineNeverExceedsMaturity', expected: 'property holds over 256 runs', invariant: 'proofDeadline <= facility.maturity always', layer: 'fuzz' },
  { id: 'C12-fuzz-window-enforcement', file: 'CovenantFacilityAdversarial.t.sol', test: 'testFuzz_WindowEnforcement', expected: 'property holds over 256 runs', invariant: 'Height eligibility matches window exactly', layer: 'fuzz' },

  // --- global invariants (handler-driven sequences) ---
  { id: 'G01-balance-equals-escrow', file: 'CovenantFacilityInvariants.t.sol', test: 'invariant_BalanceEqualsUndrawnEscrow', expected: 'holds over fuzzed sequences', invariant: 'balance == sum(creditLimit - drawn) over open facilities', layer: 'global-invariant' },
  { id: 'G02-allowance-bounds', file: 'CovenantFacilityInvariants.t.sol', test: 'invariant_DrawnNeverExceedsUnlockedNeverExceedsLimit', expected: 'holds over fuzzed sequences', invariant: 'drawn <= unlocked <= limit', layer: 'global-invariant' },
  { id: 'G03-unlock-exactness', file: 'CovenantFacilityInvariants.t.sol', test: 'invariant_UnlockedTracksSatisfiedCovenantsExactly', expected: 'holds over fuzzed sequences', invariant: 'unlocked == min(limit, tranche*(1+satisfied))', layer: 'global-invariant' },
  { id: 'G04-dead-facilities-not-drawable', file: 'CovenantFacilityInvariants.t.sol', test: 'invariant_FrozenOrClosedMeansNothingDrawable', expected: 'holds over fuzzed sequences', invariant: 'Frozen/Closed => availableToDraw == 0', layer: 'global-invariant' },
  { id: 'G05-linkage-integrity', file: 'CovenantFacilityInvariants.t.sol', test: 'invariant_CovenantLinkageIntegrity', expected: 'holds over fuzzed sequences', invariant: 'Active covenant pointer bidirectional and valid', layer: 'global-invariant' },
  { id: 'G06-terms-immutable-under-fuzz', file: 'CovenantFacilityInvariants.t.sol', test: 'invariant_AcceptedCovenantTermsAreImmutable', expected: 'holds over fuzzed sequences', invariant: 'Accepted policy fields never change', layer: 'global-invariant' },
  { id: 'G07-deadline-within-maturity', file: 'CovenantFacilityInvariants.t.sol', test: 'invariant_DeadlineWithinMaturity', expected: 'holds over fuzzed sequences', invariant: 'deadline <= maturity for every covenant', layer: 'global-invariant' },
];

function runForge() {
  const out = execSync('forge test -vvv', { cwd: path.join(REPO, 'contracts'), encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  return out;
}

function parseResults(forgeOutput) {
  const results = new Map(); // testName -> {status, gas}
  const gasRe = /\[(PASS|FAIL)(?:[^\]]*)\]\s+(\S+?)\([^)]*\)\s+\(runs:\s*(\d+), μ:\s*(\d+)[^)]*\)/g;
  const fuzzRe = /\[(PASS|FAIL)(?:[^\]]*)\]\s+(testFuzz_\S+)\([^)]*\)\s+\(runs:\s*(\d+)/g;
  let m;
  while ((m = gasRe.exec(forgeOutput)) !== null) {
    // Fuzz rows: [PASS] name(args) (runs: 256, mu: ..., ~: ...)
    results.set(m[2], { status: m[1], signatureArgs: '', gas: `fuzz runs=${m[3]}` });
  }
  const unitRe = /\[(PASS|FAIL)(?:[^\]]*)\]\s+(\S+?)\(\)\s+\(gas:\s*(\d+)\)/g;
  while ((m = unitRe.exec(forgeOutput)) !== null) {
    if (!results.has(m[2])) results.set(m[2], { status: m[1], signatureArgs: '', gas: m[3] });
  }
  const invRe = /\[(PASS|FAIL)\]\s+(invariant_\S+)\(\)\s+\(runs:\s*(\d+), calls:\s*(\d+), reverts:\s*(\d+)\)/g;
  while ((m = invRe.exec(forgeOutput)) !== null) {
    results.set(m[2], { status: m[1], signatureArgs: '', gas: `runs=${m[3]} calls=${m[4]} reverts=${m[5]}` });
  }
  return results;
}

async function main() {
  console.log('Running forge test to capture observed results...');
  const forgeOut = runForge();
  const results = parseResults(forgeOut);
  const suiteSummaryMatch = [...forgeOut.matchAll(/Ran (\d+) tests? for test\/([^:]+):(\S+)/g)];

  let exported = 0;
  const missing = [];
  for (const meta of MANIFEST) {
    const r = results.get(meta.test);
    if (!r) {
      missing.push(`${meta.file}::${meta.test}`);
      continue;
    }
    const record = {
      id: meta.id,
      kind: 'local-foundry-adversarial',
      title: meta.test,
      sourceSuite: `contracts/test/${meta.file}`,
      observedResult: r.status === 'PASS' ? 'attack-defended' : 'ATTACK-SUCCEEDED-OR-TEST-FAILED',
      gasUsed: r.gas,
      expectedBehaviour: meta.expected,
      invariantDefended: meta.invariant,
      layer: meta.layer,
      environment: {
        evm: 'local (foundry)',
        verifier: 'MockNativeQueryVerifier etched at 0x...0FD2',
        chainInfo: 'MockChainInfo etched at 0x...0FD3',
        fixtures: 'contracts/test/fixtures/fixtures.json (official @gluwa/usc-sdk encoder output)',
        note: 'DETERMINISTIC TEST EVIDENCE — this is NOT live-chain activity.',
      },
      capturedAtUTC: new Date().toISOString(),
    };
    fs.writeFileSync(path.join(OUT, `${meta.id}.json`), JSON.stringify(record, null, 2));
    exported += 1;
  }

  const index = {
    kind: 'local-foundry-adversarial-index',
    forgeRun: {
      suites: suiteSummaryMatch.length,
      rawSummaryLines: (forgeOut.match(/Suite result:.*/g) ?? []).map((l) => l.trim()),
      totalsLine: (forgeOut.match(/Ran \d+ test suites[\s\S]*?\n/gm) ?? [''])[0].trim(),
    },
    exported,
    missingFromRun: missing,
    disclaimer:
      'These are deterministic local Foundry attacks against behavior-faithful doubles of the 0x…0FD2/0x…0FD3 precompiles. They are NOT live-chain evidence. Live negative-path records live beside this folder as ../L*.json with kind:"live-chain".',
    generatedAtUTC: new Date().toISOString(),
  };
  fs.writeFileSync(path.join(OUT, 'index.json'), JSON.stringify(index, null, 2));
  console.log(`Exported ${exported} local adversarial records; missing: ${missing.length}`);
  if (missing.length > 0) {
    console.error('MISSING (tests did not appear in forge output):', missing);
    process.exitCode = 1;
  }
}

main();
