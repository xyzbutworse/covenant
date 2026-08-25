export function ArrowIcon({ external = false }: { external?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="lineIcon">
      <path d={external ? 'M7 17 17 7M9 7h8v8' : 'M5 12h13M14 7l5 5-5 5'} />
    </svg>
  );
}

export function CheckIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true" className="lineIcon"><path d="m6 12 4 4 8-9" /></svg>;
}

export function XIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true" className="lineIcon"><path d="m7 7 10 10M17 7 7 17" /></svg>;
}
