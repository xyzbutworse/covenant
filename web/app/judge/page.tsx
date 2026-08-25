import Link from 'next/link';
import { PageChrome } from '../../components/PageChrome';
import { StatusPill } from '../../components/StatusPill';
import { Brand } from '../../components/Brand';

/**
 * JUDGE MODE — canonical demo scenario figures are the product's fixed narrative constants
 * (the same numbers used across FORGE.md and the runbooks). They describe the demo scenario,
 * not live chain state; live state lives on /facility.
 */
const SCENARIO = {
  facility: '$100,000',
  drawn: '$20,000',
  obligation: '$5,000',
  nextTranche: '$20,000',
};

export default function JudgePage() {
  return (
    <PageChrome eyebrow="JUDGE MODE · NO WALLET REQUIRED">
      <div className="pageHeading">
        <div>
          <span className="eyebrow">THE WHOLE PROJECT IN ONE MINUTE</span>
          <h1>Read this once.<br />You understand COVENANT.</h1>
        </div>
        <StatusPill tone="violet">60-SECOND BRIEF</StatusPill>
      </div>

      <section className="judgeHero">
        <Brand compact />
        <p className="judgeOneLiner">
          Credit lines that unlock only when external obligations are cryptographically proven.
        </p>
      </section>

      <section className="judgeFlow">
        <article className="judgeCard">
          <b>01</b>
          <span>THE FACILITY</span>
          <h2>{SCENARIO.facility} credit line</h2>
          <p>
            A lender escrows the full line in native test CTC on Creditcoin. The borrower can draw
            only the currently unlocked tranche — <b>{SCENARIO.drawn} initially</b>. The other
            $80,000 is locked in the contract, untouchable by either side.
          </p>
        </article>

        <article className="judgeCard">
          <b>02</b>
          <span>THE CONDITION</span>
          <h2>{SCENARIO.obligation} external obligation</h2>
          <p>
            The lender proposes a covenant: pay {SCENARIO.obligation} of Circle test USDC to a fixed
            recipient inside a fixed Sepolia block window. The borrower explicitly accepts. After
            that, terms are immutable — neither side can change them.
          </p>
        </article>

        <article className="judgeCard">
          <b>03</b>
          <span>THE PROOF</span>
          <h2>Attestcoin verifies it</h2>
          <p>
            The payment is proven into Creditcoin through the native verifier at 0x…0FD2: Merkle
            inclusion plus continuity over the exact receipt bytes. COVENANT then decodes those
            bytes itself — token, payer, recipient, amount, block, success — trusting no reporter.
          </p>
        </article>

        <article className="judgeCard judgeCardGood">
          <b>04</b>
          <span>THE CONSEQUENCE</span>
          <h2>Next {SCENARIO.nextTranche} unlocked</h2>
          <p>
            CovenantSatisfied fires and drawable credit grows by exactly one tranche — a direct,
            verifiable consequence of the proof transaction. That is the entire product.
          </p>
        </article>
      </section>

      <section className="judgeNegative">
        <div className="panelTitle">
          <div>
            <span className="eyebrow">AND THE NEGATIVE CASE</span>
            <h2>Fake evidence does nothing.</h2>
          </div>
          <StatusPill tone="bad">REJECTED ON-CHAIN SHAPE</StatusPill>
        </div>
        <ul className="mechanismList judgeNegList">
          <li><b>R1</b><span><b>Replay:</b> the same proof submitted twice reverts QueryAlreadyProcessed — one source transaction can never serve two covenants or two facilities.</span></li>
          <li><b>R2</b><span><b>Insufficient payment:</b> a partial transfer is accepted as evidence and still unlocks nothing until accumulation reaches the full requirement.</span></li>
          <li><b>R3</b><span><b>Early freeze:</b> a lender cannot punish the borrower while Attestcoin has not yet attested past the covenant window — freeze needs BOTH the deadline and the observable frontier.</span></li>
        </ul>
        <Link href="/attacks" className="ghostBtn">Inspect the adversarial evidence →</Link>
      </section>

      <section className="judgeLinks">
        <Link href="/facility" className="primaryBtn">Open live facility</Link>
        <Link href="/proof" className="ghostBtn">Follow the proof chain</Link>
        <Link href="/docs" className="ghostBtn">Protocol notes</Link>
      </section>

      <section className="evidenceBand">
        <div className="bandHead">
          <StatusPill tone="neutral">INDEPENDENT INSPECTION · NO WALLET NEEDED</StatusPill>
        </div>
        <ul className="mechanismList judgeNegList">
          <li><b>I1</b><span><b>Chain state:</b> CC3 testnet RPC + ChainInfo frontier — verified live by <code className="monoNote">./scripts/replay-demo.sh</code> (read-only).</span></li>
          <li><b>I2</b><span><b>Contracts &amp; txs:</b> addresses, deployment hashes and settlement links land in <code className="monoNote">evidence/deployments.json</code> and the explorer links on /proof once deployed.</span></li>
          <li><b>I3</b><span><b>Adversarial records:</b> every rejection with revert reason and before/after state under <code className="monoNote">evidence/attacks/</code>, mirrored on /attacks.</span></li>
        </ul>
      </section>

      <section className="truthBox">
        <span>HONEST SCOPE</span>
        <p>
          The figures above are the canonical demo scenario used across this repository&apos;s
          runbooks; live contract state is on the facility page. COVENANT proves completion of
          specified historical obligations — it never claims a borrower did not pay somewhere else.
        </p>
      </section>
    </PageChrome>
  );
}
