import { Brand } from './Brand';
import { BottomNav } from './BottomNav';

export function PageChrome({ children, eyebrow, instrumented = false }: { children: React.ReactNode; eyebrow?: string; instrumented?: boolean }) {
  return (
    <main className={`appShell ${instrumented ? 'appShellInstrumented' : ''}`}>
      <div className="paperField" aria-hidden="true" />
      {!instrumented && (
        <header className="topBar">
          <Brand compact />
          <BottomNav />
          <div className="networkBadge"><i /> {eyebrow || 'ATTESTCOIN / CREDITCOIN'}</div>
        </header>
      )}
      <div className={`appContent ${instrumented ? 'appContentInstrumented' : ''}`}>{children}</div>
      <footer className="siteFooter">
        <Brand compact />
        <span>PUBLIC TESTNET EVIDENCE · ETHEREUM SEPOLIA + CREDITCOIN CC3</span>
      </footer>
    </main>
  );
}
