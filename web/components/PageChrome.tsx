import { Brand } from './Brand';
import { BottomNav } from './BottomNav';
import { DataField } from './DataField';

export function PageChrome({ children, eyebrow }: { children: React.ReactNode; eyebrow?: string }) {
  return (
    <main className="appShell">
      <DataField />
      <header className="topBar">
        <Brand compact />
        <div className="networkBadge"><i /> {eyebrow || 'ATTESTCOIN / CREDITCOIN'}</div>
      </header>
      <div className="appContent">{children}</div>
      <BottomNav />
    </main>
  );
}
