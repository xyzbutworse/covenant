import { Contract, JsonRpcProvider, getAddress } from 'ethers';
import { cfg } from './config.js';
import { erc20Abi } from './abi.js';

const provider = new JsonRpcProvider(cfg.sourceRpc());
const usdc = new Contract(cfg.sourceUsdc(), erc20Abi, provider);
const recipient = getAddress(cfg.recipient());
let cursor = await provider.getBlockNumber();

console.log(`Watching ${cfg.sourceUsdc()} for Transfer(... -> ${recipient}) from source block ${cursor}`);
console.log('When a matching transaction appears, set SOURCE_TX_HASH to it and run `npm run worker:prove && npm run worker:submit`.');

for (;;) {
  const head = await provider.getBlockNumber();
  if (head >= cursor) {
    const filter = usdc.filters.Transfer(null, recipient);
    const logs = await usdc.queryFilter(filter, cursor, head);
    for (const log of logs) {
      if (!('args' in log)) continue;
      console.log({
        txHash: log.transactionHash,
        blockNumber: log.blockNumber,
        from: log.args[0],
        to: log.args[1],
        value: log.args[2]?.toString(),
      });
    }
    cursor = head + 1;
  }
  await new Promise((resolve) => setTimeout(resolve, 12_000));
}
