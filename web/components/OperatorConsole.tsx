'use client';

import { FormEvent, useMemo, useState } from 'react';
import { BrowserProvider, Contract, parseEther, parseUnits } from 'ethers';

const writeAbi = [
  'function createFacility(address borrower,uint256 trancheSize,uint64 maturityCreditcoinBlock) payable returns (uint256 facilityId)',
  'function acceptCovenant(uint256 covenantId)',
  'function cancelProposedCovenant(uint256 covenantId)',
  'function draw(uint256 facilityId,uint256 amount)',
  'function createCovenant(uint256 facilityId,uint64 chainKey,address token,address recipient,uint256 requiredAmount,uint64 startSourceBlock,uint64 endSourceBlock,uint64 proofDeadlineCreditcoinBlock,uint64 freezeFrontierMarginSourceBlocks) returns (uint256 covenantId)',
  'function submitEvidence(uint256 covenantId,uint64 chainKey,uint64 blockHeight,bytes encodedTransaction,bytes32 merkleRoot,(bytes32 hash,bool isLeft)[] siblings,bytes32 lowerEndpointDigest,bytes32[] continuityRoots) returns (bytes32 queryId,uint256 matchedAmount)',
  'function freezeExpiredCovenant(uint256 covenantId)',
  'function closeFacility(uint256 facilityId)',
  'function availableToDraw(uint256 facilityId) view returns (uint256)',
  'function isFreezable(uint256 covenantId) view returns (bool)',
] as const;

type Action = 'facility' | 'draw' | 'covenant' | 'accept' | 'submit' | 'freeze';

function input(name: string, form: FormData) {
  const value = String(form.get(name) || '').trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

async function getSigner() {
  const injected = (window as unknown as { ethereum?: unknown }).ethereum;
  if (!injected) throw new Error('No injected EVM wallet found.');

  const chainId = process.env.NEXT_PUBLIC_CREDITCOIN_CHAIN_ID;
  if (chainId) {
    const hex = `0x${Number(chainId).toString(16)}`;
    try {
      await (injected as { request(args: { method: string; params?: unknown[] }): Promise<unknown> }).request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: hex }],
      });
    } catch {
      const rpc = process.env.NEXT_PUBLIC_CREDITCOIN_RPC_URL;
      if (!rpc) throw new Error(`Wallet is not on chain ${chainId}; set NEXT_PUBLIC_CREDITCOIN_RPC_URL to enable network add.`);
      await (injected as { request(args: { method: string; params?: unknown[] }): Promise<unknown> }).request({
        method: 'wallet_addEthereumChain',
        params: [{
          chainId: hex,
          chainName: process.env.NEXT_PUBLIC_CREDITCOIN_CHAIN_NAME || 'Creditcoin Attestcoin Testnet',
          nativeCurrency: { name: 'Test CTC', symbol: 'tCTC', decimals: 18 },
          rpcUrls: [rpc],
          blockExplorerUrls: process.env.NEXT_PUBLIC_CREDITCOIN_EXPLORER
            ? [process.env.NEXT_PUBLIC_CREDITCOIN_EXPLORER]
            : [],
        }],
      });
    }
  }

  const provider = new BrowserProvider(injected as never);
  await provider.send('eth_requestAccounts', []);
  return provider.getSigner();
}

export function OperatorConsole() {
  const [active, setActive] = useState<Action>('facility');
  const [account, setAccount] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('Wallet writes are disabled until you connect.');
  const contractAddress = process.env.NEXT_PUBLIC_COVENANT_CONTRACT_ADDRESS || '';
  const sourceToken = process.env.NEXT_PUBLIC_SOURCE_USDC_ADDRESS || '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238';

  const configured = useMemo(() => /^0x[a-fA-F0-9]{40}$/.test(contractAddress), [contractAddress]);

  async function connect() {
    try {
      const signer = await getSigner();
      const address = await signer.getAddress();
      setAccount(address);
      setMessage('Wallet connected. Transactions below call the deployed COVENANT contract directly.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Wallet connection failed.');
    }
  }

  async function transact(fn: (contract: Contract) => Promise<{ hash: string; wait(): Promise<unknown> }>) {
    if (!configured) {
      setMessage('Set NEXT_PUBLIC_COVENANT_CONTRACT_ADDRESS before sending writes.');
      return;
    }
    setBusy(true);
    try {
      const signer = await getSigner();
      setAccount(await signer.getAddress());
      const contract = new Contract(contractAddress, writeAbi, signer);
      const tx = await fn(contract);
      setMessage(`Submitted ${tx.hash}. Waiting for confirmation…`);
      await tx.wait();
      setMessage(`Confirmed ${tx.hash}. Refresh the facility page to read the new state.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Transaction failed.');
    } finally {
      setBusy(false);
    }
  }

  async function submitFacility(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const borrower = input('borrower', form);
    const limit = parseEther(input('limit', form));
    const tranche = parseEther(input('tranche', form));
    const maturity = BigInt(input('maturity', form));
    await transact((contract) => contract.createFacility(borrower, tranche, maturity, { value: limit }));
  }

  async function submitDraw(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const facilityId = BigInt(input('facilityId', form));
    const amount = parseEther(input('amount', form));
    await transact((contract) => contract.draw(facilityId, amount));
  }

  async function submitCovenant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const args = [
      BigInt(input('facilityId', form)),
      BigInt(input('chainKey', form)),
      input('token', form),
      input('recipient', form),
      parseUnits(input('requiredAmount', form), 6),
      BigInt(input('startSourceBlock', form)),
      BigInt(input('endSourceBlock', form)),
      BigInt(input('proofDeadline', form)),
      BigInt(input('frontierMargin', form) || '50'),
    ] as const;
    await transact((contract) => contract.createCovenant(...args));
  }

  async function submitAccept(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const covenantId = BigInt(input('covenantId', form));
    await transact((contract) => contract.acceptCovenant(covenantId));
  }

  async function submitEvidence(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    type ProofPayload = {
      chainKey: number;
      headerNumber: number;
      txBytes: string;
      merkleProof: { root: string; siblings: Array<{ hash: string; isLeft: boolean }> };
      continuityProof: { lowerEndpointDigest: string; roots: string[] };
    };
    let parsed: ProofPayload;
    try {
      parsed = JSON.parse(String(form.get('proof') || '')) as ProofPayload;
    } catch {
      setMessage('Proof field is not valid JSON.');
      return;
    }
    if (!parsed.txBytes || !parsed.merkleProof?.root || !parsed.continuityProof?.roots) {
      setMessage('Proof JSON is missing required fields (txBytes / merkleProof / continuityProof).');
      return;
    }
    const covenantId = BigInt(input('covenantId', form));
    const args = [
      covenantId,
      BigInt(parsed.chainKey),
      BigInt(parsed.headerNumber),
      parsed.txBytes,
      parsed.merkleProof.root,
      parsed.merkleProof.siblings.map((sib) => ({ hash: sib.hash, isLeft: sib.isLeft })),
      parsed.continuityProof.lowerEndpointDigest,
      parsed.continuityProof.roots,
    ] as const;
    await transact((contract) => contract.submitEvidence(...args, { gasLimit: 800_000 }));
  }

  async function submitFreeze(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const covenantId = BigInt(input('covenantId', form));
    await transact((contract) => contract.freezeExpiredCovenant(covenantId));
  }

  return (
    <section className="operatorConsole">
      <div className="operatorHead">
        <div><span className="eyebrow">LIVE OPERATOR CONSOLE</span><h2>Move the actual protocol.</h2></div>
        <button className="ghostBtn operatorConnect" onClick={connect}>{account ? `${account.slice(0, 6)}…${account.slice(-4)}` : 'Connect wallet'}</button>
      </div>

      <div className="operatorTabs">
        {([['facility', 'Create facility'], ['draw', 'Draw'], ['covenant', 'Propose covenant'], ['accept', 'Accept'], ['submit', 'Submit evidence'], ['freeze', 'Freeze']] as const).map(([id, label]) => (
          <button key={id} className={active === id ? 'active' : ''} onClick={() => setActive(id)}>{label}</button>
        ))}
      </div>

      <div className="operatorBody">
        {active === 'facility' && (
          <form className="operatorForm" onSubmit={submitFacility}>
            <label><span>Borrower EVM address</span><input name="borrower" placeholder="0x…" required /></label>
            <label><span>Credit limit / tCTC</span><input name="limit" type="number" min="0" step="0.001" defaultValue="10" required /></label>
            <label><span>Initial tranche / tCTC</span><input name="tranche" type="number" min="0" step="0.001" defaultValue="2" required /></label>
            <label><span>Creditcoin maturity block</span><input name="maturity" type="number" min="1" required /></label>
            <button className="primaryBtn" disabled={busy}>{busy ? 'Submitting…' : 'Escrow + create facility'}</button>
          </form>
        )}

        {active === 'draw' && (
          <form className="operatorForm" onSubmit={submitDraw}>
            <label><span>Facility ID</span><input name="facilityId" type="number" min="1" defaultValue="1" required /></label>
            <label><span>Draw amount / tCTC</span><input name="amount" type="number" min="0" step="0.001" defaultValue="2" required /></label>
            <button className="primaryBtn" disabled={busy}>{busy ? 'Submitting…' : 'Draw unlocked capital'}</button>
          </form>
        )}

        {active === 'covenant' && (
          <form className="operatorForm operatorFormWide" onSubmit={submitCovenant}>
            <label><span>Facility ID</span><input name="facilityId" type="number" min="1" defaultValue="1" required /></label>
            <label><span>Attestcoin source chain key</span><input name="chainKey" type="number" min="0" placeholder="discover first" required /></label>
            <label><span>Source token</span><input name="token" defaultValue={sourceToken} required /></label>
            <label><span>Required recipient</span><input name="recipient" placeholder="0x…" required /></label>
            <label><span>Required test USDC</span><input name="requiredAmount" type="number" min="0" step="0.000001" defaultValue="5" required /></label>
            <label><span>Start Sepolia block</span><input name="startSourceBlock" type="number" min="1" required /></label>
            <label><span>End Sepolia block</span><input name="endSourceBlock" type="number" min="1" required /></label>
            <label><span>Creditcoin proof-deadline block</span><input name="proofDeadline" type="number" min="1" required /></label>
            <label><span>Frontier margin / source blocks</span><input name="frontierMargin" type="number" min="0" defaultValue="50" required /></label>
            <button className="primaryBtn" disabled={busy}>{busy ? 'Submitting…' : 'Commit immutable covenant'}</button>
          </form>
        )}


        {active === 'accept' && (
          <form className="operatorForm" onSubmit={submitAccept}>
            <label><span>Proposed covenant ID</span><input name="covenantId" type="number" min="1" defaultValue="1" required /></label>
            <div className="operatorWarning">Borrower acceptance makes the proposed evidence policy active and immutable. Verify token, recipient, amount, source window and proof deadline first.</div>
            <button className="primaryBtn" disabled={busy}>{busy ? 'Submitting…' : 'Accept covenant terms'}</button>
          </form>
        )}

        {active === 'submit' && (
          <form className="operatorForm operatorFormWide" onSubmit={submitEvidence}>
            <label className="operatorSpan"><span>Proof JSON from npm run worker:prove</span>
              <textarea
                name="proof"
                rows={8}
                placeholder={'{"chainKey":1,"headerNumber":9128468,"txBytes":"0x…","merkleProof":{"root":"0x…","siblings":[{"hash":"0x…","isLeft":true}]},"continuityProof":{"lowerEndpointDigest":"0x…","roots":["0x…"]}}'}
                required
              />
            </label>
            <label><span>Covenant ID</span><input name="covenantId" type="number" min="1" defaultValue="1" required /></label>
            <div className="operatorWarning">Paste the proof artifact generated by the off-chain worker (npm run worker:prove). The contract verifies inclusion itself; this console only transports bytes. Submission is permissionless — any wallet may relay a valid proof.</div>
            <button className="primaryBtn" disabled={busy}>{busy ? 'Submitting…' : 'Submit Attestcoin proof'}</button>
          </form>
        )}

        {active === 'freeze' && (
          <form className="operatorForm" onSubmit={submitFreeze}>
            <label><span>Covenant ID</span><input name="covenantId" type="number" min="1" defaultValue="1" required /></label>
            <div className="operatorWarning">Freeze is only valid after the covenant&apos;s immutable Creditcoin proof deadline. The contract rejects premature calls.</div>
            <button className="primaryBtn dangerBtn" disabled={busy}>{busy ? 'Submitting…' : 'Freeze expired facility'}</button>
          </form>
        )}
      </div>

      <div className="operatorStatus"><i className={configured ? 'configured' : ''} /><span>{message}</span></div>
      <div className="operatorFoot">CONTRACT {configured ? `${contractAddress.slice(0, 10)}…${contractAddress.slice(-8)}` : 'NOT CONFIGURED'} · ALL VALUES ARE TESTNET ONLY</div>
    </section>
  );
}
