import { Contract, JsonRpcProvider, formatEther } from 'ethers';
import { cfg } from './config.js';
import { resolveDemoIds } from './evidence-files.js';
import { covenantAbi } from './abi.js';

const provider = new JsonRpcProvider(cfg.creditcoinRpc());
const contract = new Contract(cfg.covenantAddress(), covenantAbi, provider);
const { facilityId, covenantId } = await resolveDemoIds();

const [facility, covenant, available, freezable] = await Promise.all([
  contract.facilities(facilityId),
  contract.covenants(covenantId),
  contract.availableToDraw(facilityId),
  contract.isFreezable(covenantId),
]);

console.log({
  facility: {
    lender: facility.lender,
    borrower: facility.borrower,
    creditLimitCTC: formatEther(facility.creditLimit),
    trancheSizeCTC: formatEther(facility.trancheSize),
    unlockedCTC: formatEther(facility.unlocked),
    drawnCTC: formatEther(facility.drawn),
    activeCovenantId: facility.activeCovenantId.toString(),
    status: facility.status.toString(),
  },
  covenant: {
    facilityId: covenant.facilityId.toString(),
    chainKey: covenant.chainKey.toString(),
    token: covenant.token,
    payer: covenant.payer,
    recipient: covenant.recipient,
    requiredAmount: covenant.requiredAmount.toString(),
    verifiedAmount: covenant.verifiedAmount.toString(),
    sourceWindow: [covenant.startSourceBlock.toString(), covenant.endSourceBlock.toString()],
    proofDeadline: covenant.proofDeadlineCreditcoinBlock.toString(),
    freezeFrontierMarginSourceBlocks: covenant.freezeFrontierMarginSourceBlocks.toString(),
    status: covenant.status.toString(),
  },
  availableToDrawCTC: formatEther(available),
  freezableNow: freezable,
});
