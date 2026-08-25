import { JsonRpcProvider } from 'ethers';
import { chainInfo, proofProvider } from '@gluwa/usc-sdk';

export async function buildProof(params: {
  txHash: string;
  chainKey: number;
  proofBuilderUrl: string;
  creditcoinProvider: JsonRpcProvider;
  sourceProvider: JsonRpcProvider;
}): Promise<proofProvider.ContinuityResponse> {
  const { txHash, chainKey, proofBuilderUrl, creditcoinProvider, sourceProvider } = params;
  const tx = await sourceProvider.getTransaction(txHash);
  if (!tx) throw new Error(`Source transaction not found: ${txHash}`);
  if (tx.blockNumber == null) throw new Error(`Source transaction is not mined: ${txHash}`);

  const info = new chainInfo.PrecompileChainInfoProvider(creditcoinProvider);
  const latest = await info.getLatestAttestedHeightAndHash(chainKey);
  console.log(`[attestcoin] source tx block=${tx.blockNumber}, latest attested=${latest.height}`);

  const builder = new proofProvider.service.ProofBuilder(chainKey, proofBuilderUrl);
  // Mirrors the current official example: conservative 20-minute maximum wait.
  await builder.waitUntilHeightAttested(chainKey, tx.blockNumber, 15_000, 1_200_000);
  // getProof returns { success, data?, error? }; the proof payload itself is in `.data`.
  const result = await builder.getProof(txHash);
  if (!result.success || !result.data) {
    throw new Error(`Proof generation failed: ${result.error ?? 'unknown error'}`);
  }
  return result.data;
}

export function jsonSafe(value: unknown): string {
  return JSON.stringify(value, (_key, item) => (typeof item === 'bigint' ? item.toString() : item), 2);
}
