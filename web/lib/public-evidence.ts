const sourceExplorer = process.env.NEXT_PUBLIC_SOURCE_EXPLORER || 'https://sepolia.etherscan.io';
const creditExplorer = process.env.NEXT_PUBLIC_CREDITCOIN_EXPLORER || 'https://creditcoin-testnet.blockscout.com';

const sourceTx = process.env.NEXT_PUBLIC_SOURCE_TX_HASH || '';
const evidenceTx = process.env.NEXT_PUBLIC_EVIDENCE_TX_HASH || '';
const drawTx = process.env.NEXT_PUBLIC_TRANCHE_DRAW_TX_HASH || '';
const replayTx = process.env.NEXT_PUBLIC_REPLAY_REJECTION_TX_HASH || '';
const proofMetadataUrl = process.env.NEXT_PUBLIC_PROOF_METADATA_URL || '';

export const publicEvidence = {
  sourceExplorer,
  creditExplorer,
  sourceTx,
  evidenceTx,
  drawTx,
  replayTx,
  proofMetadataUrl,
  complete: Boolean(sourceTx && evidenceTx && drawTx && replayTx && proofMetadataUrl),
  links: [
    {
      label: 'Sepolia payment tx',
      detail: '5 USDC paid by the covenant payer',
      href: sourceTx ? `${sourceExplorer}/tx/${sourceTx}` : '',
    },
    {
      label: 'Attestcoin proof metadata',
      detail: 'Fresh proof input and source coordinates',
      href: proofMetadataUrl,
    },
    {
      label: 'Creditcoin verification tx',
      detail: 'Native verifier call and evidence acceptance',
      href: evidenceTx ? `${creditExplorer}/tx/${evidenceTx}` : '',
    },
    {
      label: 'CovenantSatisfied event',
      detail: 'Settlement receipt event log',
      href: evidenceTx ? `${creditExplorer}/tx/${evidenceTx}?tab=logs` : '',
    },
    {
      label: 'Tranche draw tx',
      detail: 'Borrower draws the proof-conditioned tranche',
      href: drawTx ? `${creditExplorer}/tx/${drawTx}` : '',
    },
    {
      label: 'Replay rejection tx',
      detail: 'QueryAlreadyProcessed on-chain rejection',
      href: replayTx ? `${creditExplorer}/tx/${replayTx}` : '',
    },
  ],
};
