'use client';

const rows = [
  'USDC 5.00  SEP  ETH  0x1C7D  BLOCK 9128401  CTC 20.0  PROOF 0x0FD2  TRANSFER  VERIFIED  MERKLE  ROOT  8F2A  CONTINUITY  19',
  'COV-001  PAYER 0xB0B  RECIPIENT 0xCAFE  WINDOW 9128200—9128500  STATUS PENDING  ATTEST  HEIGHT 9128468  CTC 80 LOCKED',
  'QUERY 7D31  RX_STATUS 1  TOPIC0 DDF252AD  TOKEN 1C7D4B  AMOUNT 5000000  TRANCHE 2  UNLOCK 20 CTC  FACILITY ACTIVE',
  'ETHEREUM SEPOLIA  CREDITCOIN  COVENANT  PROOF  PAYMENT  OBLIGATION  EVIDENCE  BLOCK  RECEIPT  FINALITY  REPLAY REJECTED',
  'LENDER 0xA11CE  BORROWER 0xB0B  LIMIT 100 CTC  DRAWN 20 CTC  AVAILABLE 0 CTC  NEXT TRANCHE 20 CTC  COVENANT #01',
  'ATTESTCOIN  MERKLE  CONTINUITY  SOURCE EVENT  ERC20 TRANSFER  FROM  TO  VALUE  VERIFIED  SETTLE  UNLOCK  FREEZE  DRAW',
  '0x0FD2  102033  102031  CHAINKEY  SOURCE HEIGHT  TX INDEX  QUERY ID  DEDUPE  POLICY  EXACT EMITTER  EXACT RECIPIENT',
  'CREDIT LINE  OBLIGATION  5 USDC  PROVE NEXT  CAPITAL MOVES  NO PDF  NO API ORACLE  NO MANUAL ETHERSCAN  CRYPTOGRAPHIC FACT',
];

export function DataField() {
  return (
    <div className="dataField" aria-hidden="true">
      {Array.from({ length: 15 }).map((_, index) => (
        <div
          key={index}
          className={`dataRow ${index % 4 === 2 ? 'dataRowHot' : ''}`}
          style={{ ['--row-speed' as string]: `${34 + (index % 5) * 7}s`, ['--row-shift' as string]: `${-10 - (index % 6) * 6}%` }}
        >
          <span>{rows[index % rows.length]} · {rows[(index + 3) % rows.length]} · {rows[(index + 5) % rows.length]}</span>
        </div>
      ))}
      <div className="dataFade" />
    </div>
  );
}
