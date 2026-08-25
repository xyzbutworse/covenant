'use client';

import { useState } from 'react';
import { CheckIcon, XIcon } from './LineIcons';

const stages = [
  ['OBLIGATION OPEN', '5.00 test USDC due on Ethereum Sepolia', 'violet'],
  ['SOURCE TX FOUND', 'Circle USDC Transfer emitted in the covenant window', 'neutral'],
  ['ATTESTCOIN VERIFIED', 'Merkle inclusion + continuity accepted by 0x0FD2', 'good'],
  ['POLICY MATCHED', 'Token · payer · recipient · amount · source block', 'good'],
  ['COVENANT SATISFIED', 'Next 20 CTC tranche is now drawable', 'good'],
] as const;

export function JudgeDemo() {
  const [step, setStep] = useState(0);
  const [attack, setAttack] = useState(false);

  function advance() {
    setAttack(false);
    setStep((value) => (value + 1) % stages.length);
  }

  return (
    <section className="demoConsole">
      <div className="demoTopline">
        <span>VISUAL REHEARSAL</span>
        <span>LIVE MODE READS DEPLOYED EVIDENCE</span>
      </div>
      <div className="demoMain">
        <div className={`proofOrb proofOrb-${attack ? 'bad' : stages[step][2]}`}>
          <span>{attack ? <XIcon /> : step === stages.length - 1 ? <CheckIcon /> : step + 1}</span>
        </div>
        <div>
          <div className="demoLabel">{attack ? 'REPLAY REJECTED' : stages[step][0]}</div>
          <p>{attack ? 'This source transaction has already been consumed. Capital state does not change.' : stages[step][1]}</p>
        </div>
      </div>
      <div className="demoActions">
        <button className="primaryBtn" onClick={advance}>Advance proof</button>
        <button className="ghostBtn" onClick={() => setAttack(true)}>Try replay attack</button>
      </div>
    </section>
  );
}
