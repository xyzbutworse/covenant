import Link from 'next/link';
import { Brand } from '../components/Brand';
import { BottomNav } from '../components/BottomNav';
import { DataField } from '../components/DataField';
import { StatusPill } from '../components/StatusPill';

const liveConfigured = Boolean(
  process.env.CREDITCOIN_RPC_URL && process.env.COVENANT_CONTRACT_ADDRESS,
);

export default function Home() {
  return (
    <main className="heroShell">
      <DataField />
      <section className="heroCenter">
        <div className="heroKicker">CROSS-CHAIN CREDIT / ATTESTED PERFORMANCE</div>
        <Brand />
        <h1>
          CREDIT LINES THAT UNLOCK<br />ONLY WHEN OBLIGATIONS<br />ARE PROVEN.
        </h1>
        <p className="heroCopy">
          COVENANT escrows a Creditcoin credit line. The next tranche unlocks only after Attestcoin
          cryptographically proves the borrower completed the agreed external payment on Ethereum
          Sepolia. No oracle dashboard. No trust in a reporter.
        </p>
        <div className="heroFlow" aria-label="Protocol flow">
          <span>DRAW</span><b>→</b><span>PAY THERE</span><b>→</b><span>PROVE</span><b>→</b><span>UNLOCK HERE</span>
        </div>
        <div className="heroActions">
          <Link href="/facility" className="primaryBtn">View live facility</Link>
          <Link href="/proof" className="ghostBtn">How the proof works</Link>
        </div>
        <div className="heroMetaRow">
          <StatusPill tone={liveConfigured ? 'good' : 'violet'}>
            {liveConfigured ? 'LIVE CONTRACT WIRED' : 'AWAITING DEPLOYMENT ENV'}
          </StatusPill>
          <Link href="/judge" className="heroMiniLink">Judge mode: 60-second brief →</Link>
        </div>
      </section>
      <BottomNav />
    </main>
  );
}
