import { PageChrome } from '../../components/PageChrome';
import { StatusPill } from '../../components/StatusPill';
import { attacks } from '../../lib/demo';
import { loadLiveAttackRecords, loadLocalAdversarialIndex } from '../../lib/evidence';

const creditExplorer = process.env.NEXT_PUBLIC_CREDITCOIN_EXPLORER || 'https://creditcoin-testnet.blockscout.com';
const sourceExplorer = process.env.NEXT_PUBLIC_SOURCE_EXPLORER || 'https://sepolia.etherscan.io';

function explorerForHash(hash: string | null | undefined): string | null {
  if (!hash) return null;
  if (hash.length === 66) {
    // Heuristic: attack txs on CC3 vs source payments — both explorers linked side by side.
    return `${creditExplorer}/tx/${hash}`;
  }
  return null;
}

export default async function AttacksPage() {
  const liveRecords = await loadLiveAttackRecords();
  const { index, highlights } = await loadLocalAdversarialIndex();
  const rejected = liveRecords.filter((r) => r.outcome === 'rejected');
  const partial = liveRecords.filter((r) => r.outcome === 'accepted-as-partial');
  const skipped = liveRecords.filter((r) => r.outcome === 'skipped' || r.outcome === 'blocked-unexpected-success');

  return (
    <PageChrome eyebrow="ADVERSARIAL EVIDENCE">
      <div className="pageHeading">
        <div>
          <span className="eyebrow">BREAK THE INVARIANT / SHOW THE RECEIPTS</span>
          <h1>
            If fake evidence can unlock capital,<br />the protocol is dead.
          </h1>
        </div>
        <div className="attackCount">
          {liveRecords.length + (index?.exported ?? 0)}
          <br />
          <span>recorded attacks</span>
        </div>
      </div>

      {/* ---------------- LIVE CHAIN EVIDENCE ---------------- */}
      <section className="evidenceBand">
        <div className="bandHead">
          <StatusPill tone={rejected.length > 0 ? 'good' : 'warn'}>
            {rejected.length > 0 ? `LIVE-CHAIN EVIDENCE · ${liveRecords.length} RECORDS` : 'LIVE-CHAIN CAMPAIGN ARMED'}
          </StatusPill>
          <span className="bandNote">
            Real rejected transactions broadcast to Creditcoin CC3 testnet. Every record carries
            input transaction, proof identifier, rejection hash, revert reason and before/after state.
          </span>
        </div>

        {liveRecords.length === 0 && (
          <div className="truthBox"><span>NO RECORDS</span><p>No evidence directory found next to the app. Run the campaign via `npm run worker:attacks`.</p></div>
        )}

        {liveRecords.map((record) => (
          <article className="attackRow attackRowLive" key={record.id}>
            <span><b>{record.id}</b>{record.title}</span>
            <strong className={
              record.outcome === 'rejected' ? 'redText'
                : record.outcome === 'accepted-as-partial' ? 'violetText'
                  : 'mutedText'
            }>
              {record.outcome === 'rejected' ? 'REJECTED ON-CHAIN'
                : record.outcome === 'accepted-as-partial' ? 'ACCEPTED · PARTIAL ONLY'
                  : record.outcome?.toUpperCase()}
            </strong>
            <span className="attackDetail">
              {record.revertReason && <em>{record.revertReason}</em>}
              {record.rejectionTxHash && (
                <>
                  {' '}
                  <a href={`${creditExplorer}/tx/${record.rejectionTxHash}`} target="_blank" rel="noreferrer" className="proofRef">
                    rejection tx ↗
                  </a>
                </>
              )}
              {!record.rejectionTxHash && !record.revertReason && (
                <>{record.notes}</>
              )}
              {record.invariantDefended ? <i> · defends: {record.invariantDefended}</i> : null}
            </span>
          </article>
        ))}

        {skipped.length > 0 && (
          <div className="truthBox">
            <span>CAMPAIGN STATUS</span>
            <p>
              {skipped.length} case{skipped.length === 1 ? '' : 's'} awaiting funded keys / completed
              happy path. Prerequisites are stated per-record. Nothing here is simulated — empty
              means not yet executed, never faked.
            </p>
          </div>
        )}
        {partial.length > 0 && (
          <div className="truthBox">
            <span>PARTIAL PAYMENTS</span>
            <p>
              Sub-threshold payments are accepted as evidence by design — and unlock nothing until
              accumulation reaches the requirement. State snapshots in each record prove it.
            </p>
          </div>
        )}
      </section>

      {/* ---------------- LOCAL DETERMINISTIC EVIDENCE ---------------- */}
      <section className="evidenceBand">
        <div className="bandHead">
          <StatusPill tone="violet">
            DETERMINISTIC TEST EVIDENCE · {index?.exported ?? highlights.length} RECORDS
          </StatusPill>
          <span className="bandNote">
            Foundry attacks against etched precompile doubles with official SDK fixtures. These are
            NOT chain activity — they cover proof-layer cases that cannot be safely manufactured
            live (invalid Merkle proofs, corrupted bytes, decoder abuse).
          </span>
        </div>

        <div className="attackTable">
          <div className="attackHead"><span>LOCAL ATTACK</span><span>OBSERVED</span><span>LAYER</span></div>
          {(highlights.length > 0 ? highlights : []).map((record) => (
            <div className="attackRow" key={record.id}>
              <span><b>{record.id}</b>{record.title ?? record.id}</span>
              <strong className="violetText">{record.observedResult === 'attack-defended' ? 'DEFENDED' : record.observedResult}</strong>
              <span>{record.layer}</span>
            </div>
          ))}
        </div>

        {index && (
          <div className="truthBox">
            <span>FULL SUITE</span>
            <p>
              {index.exported} exported records across proof, policy, economic, expiry, capital,
              fuzz and global-invariant layers. {index.totalsLine}. Full per-case files in
              evidence/attacks/local/.
            </p>
          </div>
        )}
      </section>

      {/* ---------------- STATIC POLICY MATRIX ---------------- */}
      <section className="evidenceBand">
        <div className="bandHead">
          <StatusPill tone="neutral">POLICY MATRIX · WHAT THE CONTRACT REJECTS BY CONSTRUCTION</StatusPill>
        </div>
        <div className="attackTable">
          <div className="attackHead"><span>ATTACK</span><span>EXPECTED</span><span>WHY</span></div>
          {attacks.map(([name, result, why], idx) => (
            <div className="attackRow" key={name}>
              <span><b>{String(idx + 1).padStart(2, '0')}</b>{name}</span>
              <strong className={result === 'REJECT' || result === 'FREEZE' ? 'redText' : 'violetText'}>{result}</strong>
              <span>{why}</span>
            </div>
          ))}
        </div>
      </section>
    </PageChrome>
  );
}
