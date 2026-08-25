import { JsonRpcProvider } from 'ethers';
import { chainInfo } from '@gluwa/usc-sdk';
import { cfg } from './config.js';

const provider = new JsonRpcProvider(cfg.creditcoinRpc());
const network = await provider.getNetwork();
console.log(`Creditcoin RPC chainId: ${network.chainId}`);
console.log('Probing ChainInfo precompile for supported chain keys 0..20...');

const info = new chainInfo.PrecompileChainInfoProvider(provider);
let found = 0;
for (let key = 0; key <= 20; key += 1) {
  try {
    const chain = await info.getSupportedChainByKey(key);
    // Unsupported keys resolve to null instead of reverting.
    if (!chain) continue;
    const latest = await info.getLatestAttestedHeightAndHash(key);
    console.log(JSON.stringify({ key, chain, latest }, (_k, v) => (typeof v === 'bigint' ? v.toString() : v)));
    found += 1;
  } catch {
    // Precompile calls may also revert on unsupported keys.
  }
}

if (!found) {
  console.error('No supported chains discovered. Check that this RPC exposes the current 0x0FD3 ChainInfo precompile.');
  process.exitCode = 1;
}
