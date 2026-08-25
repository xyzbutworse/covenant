#!/usr/bin/env node
/**
 * Generates COVENANT Foundry test fixtures from the REAL @gluwa/usc-sdk encoder
 * (encoding.abiEncode) and the SDK's own KeccakMerkleTree, so every fixture is a
 * byte-authentic USC v1 `(uint8, bytes[])` transaction leaf with matching proof paths.
 *
 * Run from the repository root:  node scripts/generate-fixtures.cjs
 * Output: contracts/test/fixtures/fixtures.json
 */
const fs = require('node:fs');
const path = require('node:path');
const { ethers } = require('ethers');
const sdk = require('@gluwa/usc-sdk');

const USDC_SEPOLIA = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238';
const PAYER = '0xB0B0000000000000000000000000000000000001'; // facility borrower
const RECIPIENT = '0xCAFE000000000000000000000000000000000002';
const FAKE_TOKEN = '0xdead000000000000000000000000000000000003';
const OTHER_PAYER = '0x1111000000000000000000000000000000000004';
const OTHER_RECIPIENT = '0x2222000000000000000000000000000000000005';

const TRANSFER_TOPIC = ethers.id('Transfer(address,address,uint256)');
const APPROVAL_TOPIC = ethers.id('Approval(address,address,uint256)');

const AMOUNT_5 = 5_000_000n; // required covenant threshold
const AMOUNT_3 = 3_000_000n; // partial payment
const AMOUNT_2 = 2_000_000n; // completing partial payment

const CHAIN_KEY = 11;
const HEADER_NUMBER = 9_128_468;

function txTemplate(overrides = {}) {
  return {
    formatted: {
      type: 2,
      nonce: 7,
      gasLimit: 65_000n,
      from: PAYER,
      to: overrides.to ?? USDC_SEPOLIA,
      value: 0n,
      data: overrides.data ?? encodeTransferData(overrides.recipient ?? RECIPIENT, overrides.amount ?? AMOUNT_5),
      chainId: 11155111n,
      maxPriorityFeePerGas: 1_000_000_000n,
      maxFeePerGas: 20_000_000_000n,
      accessList: null,
      signature: { yParity: 1, r: ethers.id('r'), s: ethers.id('s'), networkV: null },
      ...overrides.formatted,
    },
    raw: { authorizationList: null },
  };
}

function receiptTemplate(overrides = {}) {
  const logs = overrides.logs ?? [
    {
      address: overrides.emitter ?? USDC_SEPOLIA,
      topics: [TRANSFER_TOPIC, ethers.zeroPadValue(overrides.from ?? PAYER, 32), ethers.zeroPadValue(overrides.to ?? RECIPIENT, 32)],
      data: ethers.AbiCoder.defaultAbiCoder().encode(['uint256'], [overrides.amount ?? AMOUNT_5]),
    },
  ];
  return {
    status: overrides.status ?? 1,
    gasUsed: 51_244n,
    logs,
    logsBloom: ethers.ZeroHash,
    ...overrides.extra,
  };
}

function encodeTransferData(recipient, amount) {
  return ethers.Interface.from(['function transfer(address to,uint256 amount)']).encodeFunctionData('transfer', [recipient, amount]);
}

function buildLeaf(tx, rx) {
  return sdk.encoding.abiEncode(tx, rx, sdk.encoding.EncodingVersion.V1).abi;
}

// Wrap leaves into deterministic per-scenario blocks. 'valid' and 'wrongEmitter' share one
// two-leaf block (distinct transaction indexes) so the suite exercises multi-level sibling
// paths in both directions; every other scenario is its own single-tx block with a UNIQUE
// height, mirroring real distinct source transactions (and therefore distinct query ids).
function attachProof(entry, index, tree, height) {
  const proof = tree.getProof(index);
  entry.chainKey = CHAIN_KEY;
  entry.headerNumber = height;
  entry.merkleProof = {
    root: tree.getRoot(),
    siblingHashes: proof.siblings.map((s) => s.hash),
    siblingIsLeft: proof.siblings.map((s) => s.isLeft),
  };
  entry.continuityProof = {
    lowerEndpointDigest: ethers.keccak256(ethers.toBeArray(height - 1)),
    roots: [ethers.keccak256(ethers.toBeArray(height)), ethers.keccak256(ethers.toBeArray(height + 1))],
  };
  return entry;
}

const sharedLeaves = [
  buildLeaf(txTemplate(), receiptTemplate()), // valid success at index 0
  buildLeaf(
    txTemplate({ formatted: { nonce: 8 } }),
    receiptTemplate({ emitter: FAKE_TOKEN }),
  ), // wrong emitter at index 1
];
const sharedTree = new sdk.proofProvider.merkle.KeccakMerkleTree(sharedLeaves);

function singleLeaf(name, tx, rx, height) {
  const abi = buildLeaf(tx, rx);
  const tree = new sdk.proofProvider.merkle.KeccakMerkleTree([abi]);
  return attachProof({ name, txBytes: abi }, 0, tree, height);
}

const fixtures = [
  attachProof({ name: 'valid', txBytes: sharedLeaves[0] }, 0, sharedTree, HEADER_NUMBER),
  attachProof({ name: 'wrongEmitter', txBytes: sharedLeaves[1] }, 1, sharedTree, HEADER_NUMBER),
  singleLeaf(
    'wrongPayer',
    txTemplate({ formatted: { nonce: 9 } }),
    receiptTemplate({ from: OTHER_PAYER }),
    HEADER_NUMBER + 1,
  ),
  singleLeaf(
    'wrongRecipient',
    txTemplate({ formatted: { nonce: 10 } }),
    receiptTemplate({ to: OTHER_RECIPIENT }),
    HEADER_NUMBER + 2,
  ),
  singleLeaf(
    'wrongEvent',
    txTemplate({ formatted: { nonce: 11 } }),
    receiptTemplate({
      logs: [
        {
          address: USDC_SEPOLIA,
          topics: [APPROVAL_TOPIC, ethers.zeroPadValue(PAYER, 32), ethers.zeroPadValue(RECIPIENT, 32)],
          data: ethers.AbiCoder.defaultAbiCoder().encode(['uint256'], [AMOUNT_5]),
        },
      ],
    }),
    HEADER_NUMBER + 3,
  ),
  singleLeaf(
    // Transfer with only two indexed topics instead of three: COVENANT must skip it.
    'malformedLog',
    txTemplate({ formatted: { nonce: 12 } }),
    receiptTemplate({
      logs: [
        {
          address: USDC_SEPOLIA,
          topics: [TRANSFER_TOPIC, ethers.zeroPadValue(PAYER, 32)],
          data: ethers.AbiCoder.defaultAbiCoder().encode(['uint256'], [AMOUNT_5]),
        },
      ],
    }),
    HEADER_NUMBER + 4,
  ),
  singleLeaf(
    'revertedSourceTx',
    txTemplate({ formatted: { nonce: 13 } }),
    receiptTemplate({ status: 0 }),
    HEADER_NUMBER + 5,
  ),
  singleLeaf(
    // Decoder-ambiguity prosecution: multiple Transfer logs in ONE receipt; only the
    // payer->recipient log may count toward the requirement.
    'multiLog',
    txTemplate({ formatted: { nonce: 16 } }),
    receiptTemplate({
      logs: [
        {
          address: USDC_SEPOLIA,
          topics: [TRANSFER_TOPIC, ethers.zeroPadValue(PAYER, 32), ethers.zeroPadValue(OTHER_RECIPIENT, 32)],
          data: ethers.AbiCoder.defaultAbiCoder().encode(['uint256'], [AMOUNT_5]),
        },
        {
          address: FAKE_TOKEN,
          topics: [TRANSFER_TOPIC, ethers.zeroPadValue(PAYER, 32), ethers.zeroPadValue(RECIPIENT, 32)],
          data: ethers.AbiCoder.defaultAbiCoder().encode(['uint256'], [AMOUNT_5]),
        },
        {
          address: USDC_SEPOLIA,
          topics: [TRANSFER_TOPIC, ethers.zeroPadValue(PAYER, 32), ethers.zeroPadValue(RECIPIENT, 32)],
          data: ethers.AbiCoder.defaultAbiCoder().encode(['uint256'], [AMOUNT_5]),
        },
      ],
    }),
    HEADER_NUMBER + 8,
  ),
  singleLeaf(
    'partialA',
    txTemplate({ recipient: RECIPIENT, amount: AMOUNT_3, formatted: { nonce: 14 } }),
    receiptTemplate({ amount: AMOUNT_3 }),
    HEADER_NUMBER + 6,
  ),
  singleLeaf(
    'partialB',
    txTemplate({ recipient: RECIPIENT, amount: AMOUNT_2, formatted: { nonce: 15 } }),
    receiptTemplate({ amount: AMOUNT_2 }),
    HEADER_NUMBER + 7,
  ),
];

const outDir = path.join(__dirname, '..', 'contracts', 'test', 'fixtures');
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, 'fixtures.json');

const scenarios = {};
for (const fixture of fixtures) scenarios[fixture.name] = fixture;

const meta = {
  usdc: USDC_SEPOLIA,
  payer: PAYER,
  recipient: RECIPIENT,
  fakeToken: FAKE_TOKEN,
  otherPayer: OTHER_PAYER,
  otherRecipient: OTHER_RECIPIENT,
  transferTopic: TRANSFER_TOPIC,
  approvalTopic: APPROVAL_TOPIC,
  chainKey: CHAIN_KEY,
  headerNumber: HEADER_NUMBER,
  requiredAmount: AMOUNT_5.toString(),
  partialAmounts: [AMOUNT_3.toString(), AMOUNT_2.toString()],
};
fs.writeFileSync(outPath, JSON.stringify({ meta, scenarios }, null, 2));
console.log(`Wrote ${fixtures.length} fixtures -> ${outPath}`);
