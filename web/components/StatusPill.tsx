export function StatusPill({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: 'neutral' | 'good' | 'warn' | 'bad' | 'violet' }) {
  return <span className={`statusPill status-${tone}`}>{children}</span>;
}
