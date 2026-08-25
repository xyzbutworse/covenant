import { PageChrome } from '../../components/PageChrome';
import { StatusPill } from '../../components/StatusPill';
import { JudgeDemo } from '../../components/JudgeDemo';
import { OperatorConsole } from '../../components/OperatorConsole';
import { demoCovenant, demoFacility } from '../../lib/demo';
import { readLiveSnapshot } from '../../lib/chain';

function short(value: string) {
  return value.length > 14 ? `${value.slice(0, 6)}…${value.slice(-4)}` : value;
}

const COVENANT_LABELS = ['NONE', 'PROPOSED', 'PROOF REQUIRED', 'SATISFIED', 'EXPIRED', 'CANCELLED'];
const FACILITY_LABELS = ['NONE', 'ACTIVE', 'FROZEN', 'CLOSED'];

function isSnapshot(v: unknown): v is NonNullable<Awaited<ReturnType<typeof readLiveSnapshot>>> & { mode: 'live' } {
  return Boolean(v) && typeof v === 'object' && (v as { mode?: string }).mode === 'live';
}

export default async function FacilityPage() {
  const result = await readLiveSnapshot();
  const live = isSnapshot(result) ? result : null;
  const readError = !live && result && result.mode === 'error' ? result.reason : null;
  const f = live?.facility;
  const c = live?.covenant;
  const active = Boolean(live);
  const covenantLabel = !c
    ? 'NONE'
    : COVENANT_LABELS[c.status] || 'UNKNOWN';
  const covenantTone =
    c?.status === 3 ? 'good' : c?.status === 4 ? 'bad' : c?.status === 1 ? 'violet' : 'warn';
  const facilityLabel = f ? FACILITY_LABELS[f.status] || 'UNKNOWN' : '—';
  const evidenceStatus = c
    ? Number(c.status) === 3
      ? 'SATISFIED'
      : `${c.verifiedAmount} / ${c.requiredAmount} USDC`
    : `${demoCovenant.verified} · DEMO FIXTURE`;

  return (
    <PageChrome eyebrow={active ? `LIVE CONTRACT READ / CC3 TESTNET` : 'DEMO FIXTURES / AWAITING DEPLOYMENT'}>
      <div className="pageHeading">
        <div>
          <span className="eyebrow">FACILITY / {live?.ids.facilityId ?? '—'}</span>
          <h1>
            Credit that stays unlocked<br />only when the proof arrives.
          </h1>
        </div>
        <div className="headingPills">
          <StatusPill tone={active ? 'good' : 'warn'}>{active ? 'LIVE ON-CHAIN' : 'DEMO FIXTURES'}</StatusPill>
        </div>
      </div>

      {readError && (
        <section className="truthBox demoNotice">
          <span>LIVE READ UNAVAILABLE</span>
          <p>
            The server is configured for a live contract but the read failed
            (<code className="monoNote">{readError}</code>). Values below are DEMO FIXTURES — not
            chain state. Check CREDITCOIN_RPC_URL / COVENANT_CONTRACT_ADDRESS and that the CC3 RPC
            is reachable from this host.
          </p>
        </section>
      )}
      {!active && !readError && (
        <section className="truthBox demoNotice">
          <span>DEMO FIXTURES</span>
          <p>
            The values below are static demo fixtures, clearly separated from live mode. Set
            CREDITCOIN_RPC_URL and COVENANT_CONTRACT_ADDRESS to read the real deployed facility.
          </p>
        </section>
      )}

      <section className="metricGrid metricGrid5">
        <article className="metricCard featured"><span>CREDIT LIMIT</span><strong>{f?.limit ?? demoFacility.limit}</strong><small>{active ? 'fully escrowed on-chain by lender' : 'fixture value'}</small></article>
        <article className="metricCard"><span>DRAWN</span><strong>{f?.drawn ?? demoFacility.drawn}</strong><small>borrower capital received</small></article>
        <article className="metricCard"><span>UNDRAWN</span><strong>{f?.undrawn ?? demoFacility.remainingEscrow}</strong><small>still escrowed, not yet drawable</small></article>
        <article className="metricCard"><span>NEXT TRANCHE</span><strong>{f?.nextTranche ?? '20 CTC'}</strong><small>covenant-gated unlock size</small></article>
        <article className={`metricCard ${Number(c?.status) === 3 ? 'featuredGood' : ''}`}><span>EVIDENCE STATUS</span><strong className={evidenceStatus.startsWith('SATISFIED') ? '' : ''}>{evidenceStatus.split(' ')[0]}</strong><small>{evidenceStatus.includes('/') ? `${evidenceStatus.split(' ').slice(1).join(' ')} of obligation` : 'obligation proven'}</small></article>
      </section>

      <section className="twoCol">
        <article className="panel covenantPanel">
          <div className="panelTitle">
            <div>
              <span className="eyebrow">CURRENT COVENANT / {live?.ids.covenantId ?? demoCovenant.id}{active ? '' : ' · DEMO FIXTURE'}</span>
              <h2>{active ? `Pay ${c!.requiredAmount} test USDC` : `${demoCovenant.obligation} · DEMO FIXTURE`}</h2>
            </div>
            <StatusPill tone={covenantTone as 'good' | 'bad' | 'violet' | 'warn'}>{covenantLabel}</StatusPill>
          </div>
          <div className="ruleGrid">
            <div><span>SOURCE CHAIN KEY</span><b>{c?.chainKey ?? '1'} · Ethereum Sepolia</b></div>
            <div><span>TOKEN (APPROVED EMITTER)</span><b>{c ? short(c.token) : short(demoCovenant.token)}</b></div>
            <div><span>PAYER (= BORROWER)</span><b>{c ? short(c.payer) : short(demoFacility.borrower)}</b></div>
            <div><span>RECIPIENT</span><b>{c ? short(c.recipient) : short(demoCovenant.recipient)}</b></div>
            <div><span>SOURCE BLOCK RANGE</span><b>{c ? `${c.start} — ${c.end}` : demoCovenant.sourceWindow}</b></div>
            <div><span>FACILITY STATE</span><b>{facilityLabel}</b></div>
          </div>

          <div className="frontierRail">
            <div>
              <span>LATEST ATTESTCOIN FRONTIER</span>
              <b>{live?.attestcoin.latestAttestedHeight ?? 'unavailable'}</b>
              <small>ChainInfo 0x…0FD3 · chainKey {c?.chainKey ?? '1'}</small>
            </div>
            <div>
              <span>FREEZE REQUIRES FRONTIER ≥</span>
              <b>{c?.requiredFrontier ?? '—'}</b>
              <small>window end {c?.end ?? '—'} + margin {c?.freezeFrontierMargin ?? '—'}</small>
            </div>
            <div>
              <span>FREEZE ELIGIBLE NOW</span>
              <b className={c?.freezableNow ? 'redText' : 'mutedText'}>{c ? (c.freezableNow ? 'YES' : 'NO') : '—'}</b>
              <small>cure deadline block {c?.deadline ?? '—'}{typeof c?.blocksToDeadline === 'number' && c.blocksToDeadline > 0 ? ` (${c.blocksToDeadline} blocks away)` : ''}</small>
            </div>
          </div>

          <div className="consequenceRail">
            <div><i className="dot dotViolet" /><span>Valid proof before deadline</span><b>+{f?.nextTranche ?? '20 CTC'} unlocked</b></div>
            <div><i className="dot dotRed" /><span>No proof by deadline AND frontier caught up</span><b>Facility frozen</b></div>
          </div>
        </article>

        <article className="panel mechanismPanel">
          <span className="eyebrow">WHY THIS IS NOT AN ORACLE DASHBOARD</span>
          <h2>The proof changes capital state.</h2>
          <ol className="mechanismList">
            <li><b>01</b><span>Circle test USDC emits the real external payment event.</span></li>
            <li><b>02</b><span>Attestcoin verifies inclusion and continuity inside Creditcoin.</span></li>
            <li><b>03</b><span>COVENANT decodes the receipt and applies the immutable payment policy.</span></li>
            <li><b>04</b><span>Only then does the contract increase drawable credit.</span></li>
          </ol>
          <div className="mechanismFoot">
            A borrower is never frozen merely because Attestcoin has not attested yet — freeze also
            requires the observable frontier to pass window end + margin.
          </div>
        </article>
      </section>

      <JudgeDemo />
      <OperatorConsole />
    </PageChrome>
  );
}
