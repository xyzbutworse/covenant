import { Contract, JsonRpcProvider, formatEther, formatUnits } from 'ethers';

const abi = [
  'function facilities(uint256) view returns (address lender,address borrower,uint256 creditLimit,uint256 trancheSize,uint256 unlocked,uint256 drawn,uint256 activeCovenantId,uint64 maturityCreditcoinBlock,uint8 status)',
  'function covenants(uint256) view returns (uint256 facilityId,uint64 chainKey,address token,address payer,address recipient,uint256 requiredAmount,uint256 verifiedAmount,uint64 startSourceBlock,uint64 endSourceBlock,uint64 proofDeadlineCreditcoinBlock,uint64 freezeFrontierMarginSourceBlocks,uint8 status)',
  'function availableToDraw(uint256) view returns (uint256)',
  'function isFreezable(uint256 covenantId) view returns (bool)',
] as const;

// Canonical ChainInfo precompile at 0x...0FD3 — same selector proven live in
// evidence/network-probe.json. Kept as a raw eth_call so the web bundle needs no SDK.
const CHAIN_INFO_PRECOMPILE = '0x0000000000000000000000000000000000000fD3';
const GET_LATEST_ATTESTATION = '0x809112da'; // get_latest_attestation_height_and_hash(uint64)

async function fetchAttestationFrontier(
  provider: JsonRpcProvider,
  chainKey: bigint,
): Promise<{ latestAttestedHeight: number | null; exists: boolean }> {
  try {
    const data = `${GET_LATEST_ATTESTATION}${chainKey.toString(16).padStart(64, '0')}`;
    const result: string = await provider.send('eth_call', [
      { to: CHAIN_INFO_PRECOMPILE, data },
      'latest',
    ]);
    const bytes = result.slice(2);
    if (bytes.length < 256) return { latestAttestedHeight: null, exists: false };
    const height = Number(BigInt(`0x${bytes.slice(0, 64)}`));
    const exists = BigInt(`0x${bytes.slice(192, 256)}`) !== 0n;
    return { latestAttestedHeight: exists ? height : null, exists };
  } catch {
    return { latestAttestedHeight: null, exists: false };
  }
}

export async function readLiveSnapshot(): Promise<
  LiveSnapshot | { mode: 'error'; reason: string } | null
> {
  const rpc = process.env.CREDITCOIN_RPC_URL;
  const address = process.env.COVENANT_CONTRACT_ADDRESS;
  if (!rpc || !address) return null;
  const facilityId = BigInt(process.env.NEXT_PUBLIC_FACILITY_ID || '1');
  const covenantId = BigInt(process.env.NEXT_PUBLIC_COVENANT_ID || '1');
  try {
    const provider = new JsonRpcProvider(rpc);
    const contract = new Contract(address, abi, provider);
    const [facility, covenant, available, freezable, head] = await Promise.all([
      contract.facilities(facilityId),
      contract.covenants(covenantId),
      contract.availableToDraw(facilityId),
      contract.isFreezable(covenantId),
      provider.getBlockNumber(),
    ]);

    const chainKey = BigInt(covenant.chainKey);
    const frontier = await fetchAttestationFrontier(provider, chainKey);

    const limitRaw = facility.creditLimit as bigint;
    const drawnRaw = facility.drawn as bigint;
    const unlockedRaw = facility.unlocked as bigint;
    const trancheRaw = facility.trancheSize as bigint;
    const endSource = covenant.endSourceBlock as bigint;
    const margin = covenant.freezeFrontierMarginSourceBlocks as bigint;
    const requiredFrontier = endSource + margin;
    const frontierSufficient =
      frontier.latestAttestedHeight !== null &&
      BigInt(frontier.latestAttestedHeight) >= requiredFrontier;

    return {
      mode: 'live' as const,
      ids: { facilityId: facilityId.toString(), covenantId: covenantId.toString() },
      creditcoinHead: head,
      facility: {
        lender: facility.lender as string,
        borrower: facility.borrower as string,
        limit: `${formatEther(limitRaw)} CTC`,
        drawn: `${formatEther(drawnRaw)} CTC`,
        undrawn: `${formatEther(limitRaw - drawnRaw)} CTC`,
        unlocked: `${formatEther(unlockedRaw)} CTC`,
        nextTranche: `${formatEther(trancheRaw > limitRaw - unlockedRaw ? limitRaw - unlockedRaw : trancheRaw)} CTC`,
        available: `${formatEther(available)} CTC`,
        maturity: (facility.maturityCreditcoinBlock as bigint).toString(),
        status: Number(facility.status),
      },
      covenant: {
        chainKey: covenant.chainKey.toString(),
        token: covenant.token as string,
        payer: covenant.payer as string,
        recipient: covenant.recipient as string,
        requiredAmount: formatUnits(covenant.requiredAmount, 6),
        verifiedAmount: formatUnits(covenant.verifiedAmount, 6),
        start: (covenant.startSourceBlock as bigint).toString(),
        end: endSource.toString(),
        deadline: (covenant.proofDeadlineCreditcoinBlock as bigint).toString(),
        blocksToDeadline: Number((covenant.proofDeadlineCreditcoinBlock as bigint) - BigInt(head)),
        freezeFrontierMargin: margin.toString(),
        requiredFrontier: requiredFrontier.toString(),
        freezableNow: freezable as boolean,
        status: Number(covenant.status),
      },
      attestcoin: {
        latestAttestedHeight: frontier.latestAttestedHeight,
        exists: frontier.exists,
        requiredFrontier: requiredFrontier.toString(),
        frontierSufficient,
      },
    };
  } catch (error) {
    // Configured but unreachable/misrouted: surface the reason instead of silently
    // degrading to demo fixtures (a skeptical reviewer must see the difference).
    const msg = error instanceof Error ? error.message : String(error);
    return { mode: 'error' as const, reason: msg.slice(0, 200) };
  }
}

export interface LiveSnapshot {
  mode: 'live';
  ids: { facilityId: string; covenantId: string };
  creditcoinHead: number;
  facility: {
    lender: string;
    borrower: string;
    limit: string;
    drawn: string;
    undrawn: string;
    unlocked: string;
    nextTranche: string;
    available: string;
    maturity: string;
    status: number;
  };
  covenant: {
    chainKey: string;
    token: string;
    payer: string;
    recipient: string;
    requiredAmount: string;
    verifiedAmount: string;
    start: string;
    end: string;
    deadline: string;
    blocksToDeadline: number;
    freezeFrontierMargin: string;
    requiredFrontier: string;
    freezableNow: boolean;
    status: number;
  };
  attestcoin: {
    latestAttestedHeight: number | null;
    exists: boolean;
    requiredFrontier: string;
    frontierSufficient: boolean;
  };
}
