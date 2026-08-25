import { PageChrome } from '../../components/PageChrome';
import { ArrowIcon } from '../../components/LineIcons';

export default function DocsPage() {
  return (
    <PageChrome eyebrow="PROTOCOL NOTES">
      <div className="pageHeading"><div><span className="eyebrow">COVENANT / V2</span><h1>Small surface.<br />Deterministic rules.</h1></div></div>
      <section className="docsGrid">
        <article className="docCard"><b>01</b><h2>Core invariant</h2><p>No covenant-protected tranche becomes drawable until independently verified external evidence satisfies the immutable payment policy.</p></article>
        <article className="docCard"><b>02</b><h2>Attestcoin role</h2><p>The worker only transports proof material. The Creditcoin contract calls the native verifier and derives economic meaning from cryptographically covered receipt bytes.</p></article>
        <article className="docCard"><b>03</b><h2>Source policy</h2><p>Source chain, token emitter, payer, recipient, amount threshold, and source block window are fixed when the covenant is created.</p></article>
        <article className="docCard"><b>04</b><h2>Capital consequence</h2><p>Satisfaction expands the drawable limit by one tranche. Expiry freezes the facility and preserves undrawn escrow for lender recovery.</p></article>
        <article className="docCard"><b>05</b><h2>Replay safety</h2><p>Each Attestcoin transaction identity is accepted once globally. A wrong-policy submission reverts and cannot consume valid evidence.</p></article>
        <article className="docCard"><b>06</b><h2>Non-claims</h2><p>This prototype does not prove current off-chain state, borrower solvency, or universal non-payment. It proves specified historical on-chain obligations.</p></article>
      </section>
      <div className="docsLinks"><a href="https://docs.creditcoin.org/usc" target="_blank" rel="noreferrer">Creditcoin USC docs <ArrowIcon external /></a><a href="https://github.com/gluwa/usc-testnet-bridge-examples" target="_blank" rel="noreferrer">Official examples <ArrowIcon external /></a></div>
    </PageChrome>
  );
}
