import Link from 'next/link';

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className={`brand ${compact ? 'brandCompact' : ''}`} aria-label="COVENANT home">
      <svg className="brandMark" viewBox="0 0 64 64" role="img" aria-label="COVENANT mark">
        <path d="M13 18L31 7l18 11-8 8-10-6-10 6-8-8Z" />
        <path d="M13 29l9-6 9 6 9-6 11 7v15L31 57 13 46V29Zm10 8v5l8 5 9-5v-5l-9 6-8-6Z" />
      </svg>
      <span>COVENANT</span>
    </Link>
  );
}
