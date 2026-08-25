'use client';

import Link from 'next/link';
import { CSSProperties, PointerEvent, useState } from 'react';
import { BottomNav } from './BottomNav';
import { Brand } from './Brand';
import { ArrowIcon, CheckIcon } from './LineIcons';

export type DossierEvidence = { label: string; detail: string; href: string };

const stageNames = [
  '5 USDC paid',
  'Attestcoin proof',
  'Creditcoin verification',
  'CovenantSatisfied',
  '4 CTC drawn',
  'Replay rejected',
];

function RosetteIcon({ small = false }: { small?: boolean }) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" className={small ? 'rosetteIcon rosetteSmall' : 'rosetteIcon'}>
      <circle cx="32" cy="32" r="28" />
      <circle cx="32" cy="32" r="19" />
      {Array.from({ length: 12 }).map((_, index) => (
        <path key={index} d="M32 5C37 17 37 24 32 32C27 24 27 17 32 5Z" transform={`rotate(${index * 30} 32 32)`} />
      ))}
      <circle cx="32" cy="32" r="5" />
    </svg>
  );
}

function GuillocheField() {
  return (
    <svg className="guillocheField" viewBox="0 0 1000 680" preserveAspectRatio="none" aria-hidden="true">
      <g className="guillocheBlue">
        {Array.from({ length: 12 }).map((_, index) => (
          <ellipse key={`a-${index}`} cx="515" cy="334" rx={190 + index * 20} ry={82 + index * 9} transform={`rotate(${index * 13} 515 334)`} />
        ))}
        {Array.from({ length: 10 }).map((_, index) => (
          <ellipse key={`b-${index}`} cx="515" cy="334" rx={120 + index * 13} ry={170 + index * 7} transform={`rotate(${index * 17} 515 334)`} />
        ))}
      </g>
      <g className="guillocheRed">
        <path d="M24 34C170 95 260-34 410 34S650 95 976 34" />
        <path d="M24 646C170 585 260 714 410 646S650 585 976 646" />
      </g>
    </svg>
  );
}

function ProofSeal() {
  const points = Array.from({ length: 48 }, (_, index) => {
    const radius = index % 2 === 0 ? 48 : 42;
    const angle = (Math.PI * 2 * index) / 48 - Math.PI / 2;
    return `${50 + Math.cos(angle) * radius},${50 + Math.sin(angle) * radius}`;
  }).join(' ');
  return (
    <svg className="proofSeal" viewBox="0 0 100 100" aria-hidden="true">
      <polygon points={points} />
      <circle cx="50" cy="50" r="39" />
      <circle cx="50" cy="50" r="31" />
      <path d="M50 25 58 42 76 50 58 58 50 76 42 58 24 50 42 42Z" />
      <text x="50" y="17">COVENANT</text>
      <text x="50" y="89">VERIFIED PROOF</text>
      <text x="50" y="58" className="sealLetter">C</text>
    </svg>
  );
}

export function SecurityDossier({
  evidence,
  complete,
  heading = 'Credit follows proof.',
  summary = 'Credit lines that unlock only when external obligations are cryptographically proven.',
}: {
  evidence: DossierEvidence[];
  complete: boolean;
  heading?: string;
  summary?: string;
}) {
  const [progress, setProgress] = useState(1);

  function trackPointer(event: PointerEvent<HTMLElement>) {
    if (event.pointerType === 'touch') return;
    const rect = event.currentTarget.getBoundingClientRect();
    setProgress(Math.max(0.08, Math.min(1, (event.clientY - rect.top) / rect.height)));
  }

  const style = { '--proof-progress': progress } as CSSProperties;

  return (
    <section className="securityDossier" aria-label="COVENANT public proof instrument" onPointerMove={trackPointer} onPointerLeave={() => setProgress(1)} style={style}>
      <aside className="dossierLead">
        <div className="dossierMasthead">
          <Brand compact />
          <BottomNav />
        </div>
        <div className="leadOrnament" aria-hidden="true"><RosetteIcon /></div>
        <h1>{heading}</h1>
        <div className="dossierRule" aria-hidden="true"><i /></div>
        <strong>10 CTC FACILITY</strong>
        <p>{summary}</p>
        <Link href="/judge#public-evidence" className="documentAction"><span><ArrowIcon /></span> Public evidence</Link>
        <div className="documentState"><span>{complete ? 'PUBLIC · VERIFIED' : 'PUBLIC · PARTIAL'}</span><i><CheckIcon /></i></div>
      </aside>

      <div className="proofInstrument">
        <GuillocheField />
        <div className="instrumentHeading">
          <span>FACILITY<br /><b>10 CTC</b></span>
          <strong>PROOF INSTRUMENT</strong>
          <span>NETWORK<br /><b>SEP / CC3</b></span>
        </div>
        <div className="securityThread" aria-hidden="true"><i className="threadFill" /><span className="movingSeal"><RosetteIcon small /></span></div>
        <ol className="instrumentStages">
          {stageNames.map((name, index) => {
            const item = evidence[index];
            const reached = progress >= (index + 0.6) / stageNames.length;
            const content = (
              <>
                <b>{String(index + 1).padStart(2, '0')}</b>
                <span>{name}</span>
                <i className={reached ? 'stageRosette stageRosetteReached' : 'stageRosette'}><RosetteIcon /></i>
                <small>{item?.detail || 'Public record pending'}</small>
                <em className={reached ? 'stageReached' : ''}>{item?.href ? 'INSPECT' : 'PENDING'} {item?.href && <ArrowIcon external />}</em>
              </>
            );
            return <li key={name} onFocus={() => setProgress((index + 1) / stageNames.length)}>{item?.href ? <a href={item.href} target="_blank" rel="noreferrer">{content}</a> : <div>{content}</div>}</li>;
          })}
        </ol>
        <div className="instrumentSeal"><ProofSeal /></div>
        <div className="instrumentFooter">
          <span>EVIDENCE STATUS<br /><b>{complete ? 'PUBLIC · VERIFIED' : 'PUBLIC · INCOMPLETE'}</b></span>
          <span>FACILITY<br /><b>10 CTC</b></span>
          <span>DRAWN<br /><b>4 CTC</b></span>
        </div>
      </div>

      <div className="serialLedger" id="public-evidence">
        <span>INDEPENDENTLY INSPECTABLE EVIDENCE</span>
        <div>
          {evidence.map((item, index) => item.href ? (
            <a href={item.href} target="_blank" rel="noreferrer" key={item.label}>
              <i className="serialMedallion"><RosetteIcon small /></i><b>{String.fromCharCode(65 + index)}-{String(index + 1).padStart(4, '0')}</b><span>{item.label}</span><em><ArrowIcon /></em>
            </a>
          ) : (
            <span className="serialMissing" key={item.label}>
              <i className="serialMedallion"><RosetteIcon small /></i><b>{String.fromCharCode(65 + index)}-{String(index + 1).padStart(4, '0')}</b><span>{item.label}</span><em>PENDING</em>
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
