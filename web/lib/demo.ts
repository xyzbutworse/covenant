export const demoFacility = {
  id: '001',
  lender: '0xA11C…091F',
  borrower: '0xB0B0…8B71',
  limit: '100 CTC',
  drawn: '20 CTC',
  unlocked: '20 CTC',
  remainingEscrow: '80 CTC',
};

export const demoCovenant = {
  id: '01',
  obligation: 'Pay 5.00 test USDC',
  chain: 'Ethereum Sepolia',
  token: 'Circle test USDC',
  recipient: '0xCAFE…C0DE',
  sourceWindow: '9,128,200 — 9,128,500',
  verified: '0 / 5.00 USDC',
};

export const attacks = [
  ['Forged Merkle proof', 'REJECT', '0x0FD2 proof verification'],
  ['Wrong source chain', 'REJECT', 'chainKey bound to covenant'],
  ['Fake USDC emitter', 'REJECT', 'exact token contract required'],
  ['Failed source transaction', 'REJECT', 'receipt status must be 1'],
  ['Wrong payer', 'REJECT', 'Transfer.from must equal borrower'],
  ['Wrong recipient', 'REJECT', 'Transfer.to must equal covenant recipient'],
  ['Partial payment', 'ACCUMULATE', 'does not unlock until threshold'],
  ['Pre-window payment', 'REJECT', 'source block outside immutable window'],
  ['Proof replay', 'REJECT', 'query identity consumed once'],
  ['No proof by deadline', 'FREEZE', 'undrawn capital becomes unavailable'],
] as const;
