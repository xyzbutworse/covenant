import Link from 'next/link';

const items = [
  ['Facility', '/facility'],
  ['Proof', '/proof'],
  ['Attacks', '/attacks'],
  ['Judge', '/judge'],
  ['Docs', '/docs'],
] as const;

export function BottomNav() {
  return (
    <nav className="bottomNav" aria-label="Primary navigation">
      {items.map(([label, href]) => (
        <Link key={href} href={href} className="navItem">
          <span>{label}</span>
        </Link>
      ))}
    </nav>
  );
}
