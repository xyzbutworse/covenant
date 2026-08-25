import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'COVENANT — Proof-conditioned credit',
  description: 'Cross-chain credit lines whose next tranche unlocks only after Attestcoin verifies the obligation.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <template
          data-design-contract
          dangerouslySetInnerHTML={{
            __html: `<!--
THESIS: COVENANT is a living proof dossier where external payment evidence changes drawable capital. It refuses the generic crypto dashboard and card-grid hero.
OWN-WORLD: Ivory security stock, midnight navy ink, cobalt security thread, oxblood seal, mint verification marks, guilloche fields, serial entries, and engraved dividers.
STORY: Visitors understand the obligation, inspect the Attestcoin and Creditcoin proof chain, see the capital consequence, and open public evidence or operate the facility.
FIRST VIEWPORT: An editorial left column occupies thirty percent. A six-stage proof instrument fills the right. The serial evidence ledger spans the bottom. Public evidence sits in the left column.
FORM: Proof Dossier, third composition in the Security Print Instrument direction. Seed f49137cd.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, and DESIGN.md
-->`,
          }}
        />
        {children}
      </body>
    </html>
  );
}
