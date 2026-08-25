import { PageChrome } from '../../components/PageChrome';
import { StatusPill } from '../../components/StatusPill';
import { publicEvidence } from '../../lib/public-evidence';

const sourceTx = process.env.NEXT_PUBLIC_SOURCE_TX_HASH || '';
const evidenceTx = process.env.NEXT_PUBLIC_EVIDENCE_TX_HASH || '';
const contract = process.env.NEXT_PUBLIC_COVENANT_CONTRACT_ADDRESS || '';
const sourceBlock = process.env.NEXT_PUBLIC_SOURCE_BLOCK_NUMBER || '';
const sourceExplorer = process.env.NEXT_PUBLIC_SOURCE_EXPLORER || 'https://sepolia.etherscan.io';
const creditExplorer = process.env.NEXT_PUBLIC_CREDITCOIN_EXPLORER || 'https://creditcoin-testnet.blockscout.com';
const proverUrl = process.env.NEXT_PUBLIC_PROOF_BUILDER_URL || 'https://prover.cc3-testnet.creditcoin.network';
const usdc = process.env.NEXT_PUBLIC_SOURCE_USDC_ADDRESS || '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238';
const drawTx = process.env.NEXT_PUBLIC_TRANCHE_DRAW_TX_HASH || '';

function RefLink({ label, href, missing }: { label: string; href: string | null; missing?: string }) {
  if (!href) return <span className="proofRef proofRefMissing">{missing ?? `${label}: awaiting live evidence`}</span>;
  return (
    <a className="proofRef" href={href} target="_blank" rel="noreferrer">
      {label} ↗
    </a>
  );
}

function txLink(base: string, hash?: string, label = 'transaction') {
  return hash ? `${base}/tx/${hash}` : null;
}

export default function ProofPage() {
  const live = Boolean(sourceTx && evidenceTx && contract);
  const chain = [
    {
      n: '01',
      net: 'ETHEREUM SEPOLIA',
      title: 'Circle test USDC payment.',
      body: 'The borrower executes a real USDC transfer. The obligation is an ordinary on-chain transaction — nothing COVENANT-specific.',
      links: (
        <>
          <RefLink label="View payment transaction" href={txLink(sourceExplorer, sourceTx)} />
          <RefLink label="USDC contract" href={`${sourceExplorer}/address/${usdc}`} />
        </>
      ),
    },
    {
      n: '02',
      net: 'SOURCE BLOCK',
      title: 'The transaction lands in a block inside the covenant window.',
      body: `The covenant fixes [startSourceBlock, endSourceBlock] at acceptance. Only receipts mined inside that immutable range can ever count.${sourceBlock ? ` This payment landed in block ${sourceBlock}.` : ''}`,
      links: sourceBlock ? <RefLink label={`Block ${sourceBlock}`} href={`${sourceExplorer}/block/${sourceBlock}`} /> : null,
    },
    {
      n: '03',
      net: 'ATTESTCOIN PROOF',
      title: 'Attestcoin attests the block; a fresh Merkle + continuity proof is built.',
      body: 'The proof builder service returns the encoded transaction bytes plus inclusion and continuity material. Continuity proofs are generated immediately before submission — they are fresh data, not artifacts.',
      links: (
        <>
          <RefLink label="Proof builder service" href={proverUrl} />
          <RefLink label="Proof metadata" href={publicEvidence.proofMetadataUrl || null} />
        </>
      ),
    },
    {
      n: '04',
      net: 'NATIVE VERIFIER 0x…0FD2',
      title: 'Creditcoin verifies inclusion on-chain.',
      body: 'COVENANT calls verifyAndEmit() on the native BlockProver precompile. If Merkle or continuity verification fails, the submission reverts before any economic field is read.',
      links: <RefLink label="Verifier precompile" href={`${creditExplorer}/address/0x0000000000000000000000000000000000000fD2`} />,
    },
    {
      n: '05',
      net: 'DECODED TRANSFER EVENT',
      title: 'COVENANT decodes the verified receipt bytes.',
      body: 'EvmV1Decoder extracts receipt status and logs from the proof-covered bytes. The worker never supplies token, payer, recipient, amount, block or success — all are read from verified data only.',
      links: <RefLink label="Approved emitter (USDC)" href={`${sourceExplorer}/address/${usdc}`} />,
    },
    {
      n: '06',
      net: 'POLICY CHECKS',
      title: 'Deterministic policy, committed at covenant acceptance.',
      body: 'receiptStatus == 1 · emitter == approved USDC · Transfer.from == borrower · Transfer.to == recipient · amount accumulates toward the requirement · block within window · query identity consumed once globally. Any miss reverts with no state change.',
      links: null,
    },
    {
      n: '07',
      net: 'COVENANT STATE TRANSITION',
      title: 'EvidenceAccepted → CovenantSatisfied.',
      body: 'Only after every check passes does the contract mark the covenant satisfied and expand drawable credit by exactly one tranche.',
      links: <RefLink label="Evidence settlement transaction" href={txLink(creditExplorer, evidenceTx)} />,
    },
    {
      n: '08',
      net: 'TRANCHE UNLOCKED',
      title: 'Next tranche becomes drawable.',
      body: 'availableToDraw() increases on-chain. Anyone can verify it moved as a direct consequence of the proof transaction above.',
      links: (
        <>
          <RefLink label="Tranche draw transaction" href={txLink(creditExplorer, drawTx)} />
          <RefLink label="COVENANT facility" href={contract ? `${creditExplorer}/address/${contract}` : null} missing="Facility address: awaiting deployment" />
        </>
      ),
    },
  ];

  return (
    <PageChrome eyebrow="PROOF CAUSAL CHAIN">
      <div className="pageHeading">
        <div>
          <span className="eyebrow">FOLLOW THE MONEY / THEN FOLLOW THE PROOF</span>
          <h1>Every hop links to something<br />you can check yourself.</h1>
        </div>
        <StatusPill tone={live ? 'good' : 'warn'}>{live ? 'EVIDENCE WIRED' : 'AWAITING LIVE TXS'}</StatusPill>
      </div>

      <section className="proofStack">
        {chain.map((step) => (
          <article className="proofStep" key={step.n}>
            <b>{step.n}</b>
            <div>
              <span>{step.net}</span>
              <h2>{step.title}</h2>
              <p>{step.body}</p>
              {step.links}
            </div>
          </article>
        ))}
      </section>

      <section className="truthBox">
        <span>HONEST CLAIM</span>
        <p>
          COVENANT proves completion of a specified historical external obligation. Missing evidence
          means the covenant was not cryptographically satisfied by the agreed deadline under the
          observable Attestcoin frontier — it is not proof that no payment ever happened.
        </p>
      </section>
    </PageChrome>
  );
}
