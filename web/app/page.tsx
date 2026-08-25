import Link from 'next/link';
import { PageChrome } from '../components/PageChrome';
import { SecurityDossier } from '../components/SecurityDossier';
import { publicEvidence } from '../lib/public-evidence';

export default function Home() {
  return (
    <PageChrome eyebrow="ETHEREUM SEPOLIA / CREDITCOIN CC3" instrumented>
      <SecurityDossier evidence={publicEvidence.links} complete={publicEvidence.complete} />
      <section className="homeClose">
        <p>
          COVENANT escrows a Creditcoin credit line, verifies a real external payment through
          Attestcoin, and changes drawable capital only after the proof passes immutable policy.
        </p>
        <div>
          <Link href="/judge" className="primaryBtn">Read the 60-second brief</Link>
          <Link href="/facility" className="ghostBtn">Open live facility</Link>
        </div>
      </section>
    </PageChrome>
  );
}
